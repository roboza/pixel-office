import { atom, read, update } from 'claude-code'
import type { ElementConstructor, EngineInterface, Register, TextProps } from 'claude-code'

import type { OfficeAgent, OfficeAgentKind, OfficeMain, OfficePeer } from '../types'
import { LEAVE_MS, drawOffice, toolLabel } from './office-svg'

const PANE = 'pixel-office'
const TITLE = 'Office'

const agentsA = atom({ plugin: 'pixel-office', key: 'agents' } as const, [])
const mainA = atom({ plugin: 'pixel-office', key: 'main' } as const, {
  waiting: false,
  toolCount: 0,
  filesIn: [],
  filesOut: [],
  since: 0,
})
const peersA = atom({ plugin: 'pixel-office', key: 'peers' } as const, [])
const selectedA = atom({ plugin: 'pixel-office', key: 'selected' } as const, '')

/** A persistent name, a plate role and a shirt colour per agent type. */
const CAST: Record<string, [string, string, string]> = {
  'Explore': ['Ellie', 'Explorer', '#3f9e9a'],
  'Plan': ['Pat', 'Planner', '#8a64b8'],
  'general-purpose': ['Gus', 'Generalist', '#4f7fc0'],
  'claude': ['Clay', 'Assistant', '#c96a4a'],
  'claude-code-guide': ['Gail', 'Guide', '#c0954f'],
  'web-fetch': ['Wes', 'Web Fetcher', '#4aa0d8'],
  'statusline-setup': ['Stu', 'Statusline', '#7a8a99'],
  'fork': ['Felix', 'Fork', '#c05f7a'],
  'teammate': ['Tess', 'Teammate', '#6aa86a'],
}
const SPARE_NAMES = ['Ada', 'Bo', 'Cyd', 'Dot', 'Eli', 'Fay', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lou', 'Max', 'Ned', 'Oli', 'Rue', 'Sam', 'Tia', 'Vic', 'Zed']
const SPARE_SHIRTS = ['#b85c5c', '#5c8cb8', '#7aa35a', '#b8925c', '#8e6bb0', '#4fa3a0', '#c27a3a', '#6b7fa3']

const FILES_KEPT = 40
const PEER_TTL_MS = 15_000
const PEER_KEY = 'peer:'

// Module state: lost on a hot reload, which only costs a stale bubble.
const running = new Map<string, string[]>() // owner -> tools in flight
const asks = new Set<string>() // owners blocked on a permission prompt
let lastActivity = 0
let ticks = 0

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function castFor(type: string, name?: string): { name: string; role: string; shirt: string } {
  const known = CAST[type]
  const h = hash(type)
  const role = known?.[1] ?? titleCase(type).slice(0, 14)
  const base = name ? titleCase(name) : (known?.[0] ?? SPARE_NAMES[h % SPARE_NAMES.length] ?? 'Sam')
  return { name: base, role, shirt: known?.[2] ?? SPARE_SHIRTS[h % SPARE_SHIRTS.length] ?? '#5c8cb8' }
}

function titleCase(text: string): string {
  return text
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** `Ellie`, or `Ellie 2` while another Ellie is at her desk. */
function uniqueName(base: string, list: OfficeAgent[]): string {
  const taken = new Set(list.map(a => a.name))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`
}

function freeDesk(list: OfficeAgent[]): number {
  const used = new Set(list.map(a => a.desk))
  let desk = 0
  while (used.has(desk)) desk++
  return desk
}

function shortPath(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean)
  return parts.slice(-2).join('/')
}

function pushFile(list: string[], path: string): string[] {
  const short = shortPath(path)
  return [...list.filter(p => p !== short), short].slice(-FILES_KEPT)
}

type Hire = {
  id: string
  kind: OfficeAgentKind
  type: string
  name?: string
  description: string
  prompt: string
  background: boolean
  now: number
}

function hire(list: OfficeAgent[], h: Hire): OfficeAgent[] {
  const existing = list.find(a => a.id === h.id)
  if (existing) {
    // A resumed agent or a teammate woken again: back to work at the same desk.
    return list.map((a): OfficeAgent => (a === existing ? { ...a, status: 'working', endedAt: undefined, outcome: undefined } : a))
  }
  const cast = castFor(h.type, h.name)
  const agent: OfficeAgent = {
    id: h.id,
    kind: h.kind,
    type: h.type,
    name: uniqueName(cast.name, list),
    role: h.kind === 'workflow' ? `WF ${cast.role}`.slice(0, 14) : cast.role,
    desk: freeDesk(list),
    description: h.description,
    prompt: h.prompt.slice(0, 600),
    status: 'working',
    spawnedAt: h.now,
    toolCount: 0,
    filesIn: [],
    filesOut: [],
    look: hash(h.id),
    shirt: cast.shirt,
    background: h.background,
  }
  return [...list, agent]
}

function finish(list: OfficeAgent[], id: string, outcome: 'ok' | 'failed', now: number): OfficeAgent[] {
  return list.map((a): OfficeAgent =>
    a.id === id && a.status !== 'done'
      ? { ...a, status: 'done', outcome, endedAt: now, tool: undefined }
      : a,
  )
}

/** The file a call reads (IN) or writes (OUT), if it is one of those. */
function fileOf(tool: string, input: Record<string, unknown>): { dir: 'in' | 'out'; path: string } | undefined {
  const path = (input.file_path ?? input.notebook_path) as unknown
  if (typeof path !== 'string' || !path) return undefined
  if (tool === 'Read' || tool === 'NotebookRead') return { dir: 'in', path }
  if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' || tool === 'NotebookEdit') return { dir: 'out', path }
  return undefined
}

async function toolStarted($: EngineInterface, owner: string, tool: string, input: Record<string, unknown>) {
  lastActivity = await $.clock.now()
  running.set(owner, [...(running.get(owner) ?? []), tool])
  asks.delete(owner)
  const file = fileOf(tool, input)
  const apply = <T extends { tool?: string; toolCount: number; filesIn: string[]; filesOut: string[] }>(o: T): T => ({
    ...o,
    tool,
    toolCount: o.toolCount + 1,
    filesIn: file?.dir === 'in' ? pushFile(o.filesIn, file.path) : o.filesIn,
    filesOut: file?.dir === 'out' ? pushFile(o.filesOut, file.path) : o.filesOut,
  })
  if (owner === 'main') {
    await update($, mainA, m => ({ ...apply(m), waiting: false }))
  } else {
    await update($, agentsA, list =>
      list.map((a): OfficeAgent => (a.id === owner && a.status !== 'done' ? { ...apply(a), status: 'working' } : a)),
    )
  }
}

async function toolEnded($: EngineInterface, owner: string, tool: string) {
  const left = [...(running.get(owner) ?? [])]
  const at = left.lastIndexOf(tool)
  if (at >= 0) left.splice(at, 1)
  running.set(owner, left)
  asks.delete(owner)
  const current = left[left.length - 1]
  if (owner === 'main') {
    await update($, mainA, m => ({ ...m, tool: current, waiting: false }))
  } else {
    await update($, agentsA, list =>
      list.map((a): OfficeAgent =>
        a.id === owner && a.status !== 'done' ? { ...a, tool: current, status: 'working' } : a,
      ),
    )
  }
}

async function markWaiting($: EngineInterface, owner: string) {
  asks.add(owner)
  if (owner === 'main') await update($, mainA, m => ({ ...m, waiting: true }))
  else
    await update($, agentsA, list =>
      list.map((a): OfficeAgent => (a.id === owner && a.status === 'working' ? { ...a, status: 'waiting' } : a)),
    )
}

/** Reconciles desks with the engine's agent list, clears the leavers, beats the heart. */
async function tick($: EngineInterface) {
  const now = await $.clock.now()
  const listed = await $.agent.list().catch(() => [])
  const byId = new Map(listed.map(info => [info.id, info]))
  const before = await read($, agentsA)

  const needsWork =
    before.some(a => {
      const info = byId.get(a.id)
      if (a.status === 'done') return now > (a.endedAt ?? now) + LEAVE_MS + 400
      if (!info) return false
      if (info.status === 'completed' || info.status === 'failed' || info.status === 'killed') return true
      if (info.status === 'idle' && a.kind === 'teammate') return true
      if (info.status === 'waiting' && a.status === 'working') return true
      return info.status === 'running' && a.status === 'waiting' && !asks.has(a.id)
    }) ||
    listed.some(
      info =>
        (info.status === 'running' || info.status === 'waiting') && !before.some(a => a.id === info.id),
    )

  if (needsWork) {
    await update($, agentsA, list => {
      let next = list.map((a): OfficeAgent => {
        const info = byId.get(a.id)
        if (!info || a.status === 'done') return a
        if (info.status === 'completed') return { ...a, status: 'done', outcome: 'ok', endedAt: now, tool: undefined }
        if (info.status === 'failed' || info.status === 'killed')
          return { ...a, status: 'done', outcome: 'failed', endedAt: now, tool: undefined }
        if (info.status === 'idle' && a.kind === 'teammate')
          return { ...a, status: 'done', outcome: 'ok', endedAt: now, tool: undefined }
        if (info.status === 'waiting') return { ...a, status: 'waiting' }
        if (info.status === 'running' && a.status === 'waiting' && !asks.has(a.id)) return { ...a, status: 'working' }
        return a
      })
      next = next.filter(a => !(a.status === 'done' && now > (a.endedAt ?? now) + LEAVE_MS + 400))
      // Agents the spawn hook missed (started before a reload, say) still get a desk.
      for (const info of listed) {
        if ((info.status === 'running' || info.status === 'waiting') && !next.some(a => a.id === info.id)) {
          next = hire(next, {
            id: info.id,
            kind: info.teammateId ? 'teammate' : 'sub',
            type: info.type,
            name: info.teammateId ? info.name : undefined,
            description: info.description,
            prompt: '',
            background: true,
            now,
          })
        }
      }
      return next
    })
  }

  if (ticks++ % 3 === 0) await heartbeat($, now)
}

/** Other sessions of this mod meet in `$.store`: each writes its own key and reads the rest. */
async function heartbeat($: EngineInterface, now: number) {
  const id = await $.session.id()
  const cwd = await $.session.cwd()
  const agents = (await read($, agentsA)).filter(a => a.status !== 'done').length
  const label = cwd.split(/[\\/]+/).filter(Boolean).pop() ?? 'session'
  await $.store.set(PEER_KEY + id, { label, agents, isActive: now - lastActivity < PEER_TTL_MS, lastSeen: now })

  const peers: OfficePeer[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(PEER_KEY) || key === PEER_KEY + id) continue
    const beat = (await $.store.get(key)) as { label?: string; agents?: number; isActive?: boolean; lastSeen?: number } | undefined
    const seen = beat?.lastSeen ?? 0
    if (now - seen > 3_600_000) await $.store.delete(key)
    if (now - seen > PEER_TTL_MS) continue
    peers.push({ id: key.slice(PEER_KEY.length), label: beat?.label ?? 'session', agents: beat?.agents ?? 0, isActive: !!beat?.isActive })
  }
  peers.sort((a, b) => a.id.localeCompare(b.id))
  if (JSON.stringify(peers) !== JSON.stringify(await read($, peersA))) await update($, peersA, () => peers)
}

function since(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function statusLine(status: OfficeAgent['status'] | 'idle', tool: string | undefined, outcome?: string): string {
  if (status === 'waiting') return 'Waiting for permission'
  if (status === 'done') return outcome === 'failed' ? 'Stopped' : 'Finished, heading out'
  if (status === 'idle') return 'At the desk'
  return tool ? `Working: ${toolLabel(tool)}` : 'Working: thinking'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'office',
      description: 'Open the pixel office that shows the agents of this session',
    })
    const now = await $.clock.now()
    await update($, mainA, m => (m.since ? m : { ...m, since: now }))
    $.clock.every(1500, () => void tick($).catch(() => undefined))
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await $.store.delete(PEER_KEY + (await $.session.id())).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'office' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'The office is open.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    const agentId = (result as { agentId?: string }).agentId
    if (agentId) {
      const now = await $.clock.now()
      await update($, agentsA, list =>
        hire(list, {
          id: agentId,
          kind: e.workflow ? 'workflow' : e.isTeammate ? 'teammate' : 'sub',
          type: e.subagentType || 'agent',
          name: e.isTeammate ? e.name : undefined,
          description: e.description,
          prompt: e.prompt,
          background: e.background,
          now,
        }),
      )
    }

    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) {
      const now = await $.clock.now()
      const id = e.agentId
      running.delete(id)
      asks.delete(id)
      await update($, agentsA, list => finish(list, id, e.reason === 'answer' ? 'ok' : 'failed', now))
    } else {
      running.delete('main')
      asks.delete('main')
      await update($, mainA, m => ({ ...m, tool: undefined, waiting: false }))
    }

    return result
  })

  on('tool.call', async ($, e, next) => {
    const owner = e.agentId ?? 'main'
    const tool = String(e.tool)
    await toolStarted($, owner, tool, e as unknown as Record<string, unknown>)
    try {
      return await next(e)
    } finally {
      await toolEnded($, owner, tool)
    }
  }).catch(($, e, next) => next(e))

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id) await markWaiting($, e.agentId ?? 'main')

    return verdict
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const [agents, main, peers, selected] = await Promise.all([
      read($, agentsA),
      read($, mainA),
      read($, peersA),
      read($, selectedA),
    ])
    const now = await $.clock.now()
    // The pane's width in CSS pixels, from its cells of the code font (about
    // 7.6px each); desks per row are picked so the art draws about 2.2x.
    const paneWidth = Math.max(240, Math.round((e.props.bodyColumns ?? 60) * 7.6))
    const cols = Math.max(2, Math.min(6, Math.floor((paneWidth / 2.2 - 32) / 72)))
    const { Box, Text, Button } = $.ui.resolve(e)

    const pick = (id: string) => () => update($, selectedA, s => (s === id ? '' : id))
    const glyph = (s: OfficeAgent['status']) => (s === 'waiting' ? '✋' : s === 'done' ? '✓' : '●')
    const roster = (
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        <Button key="pick:main" plain onPress={pick('main')}>
          {main.waiting ? '✋' : '★'} Claude <Text dimColor>Manager</Text>
        </Button>
        {agents.map(a => (
          <Button key={`pick:${a.id}`} plain onPress={pick(a.id)}>
            {glyph(a.status)} {a.name} <Text dimColor>{a.role}</Text>
          </Button>
        ))}
      </Box>
    )

    const agent = agents.find(a => a.id === selected)
    const details = agent ? (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>
          {agent.name} · {agent.role}{' '}
          <Text dimColor>
            ({agent.type}
            {agent.kind === 'workflow' ? ', workflow' : agent.kind === 'teammate' ? ', teammate' : ''}
            {agent.background ? ', background' : ''})
          </Text>
        </Text>
        <Text>{statusLine(agent.status, agent.tool, agent.outcome)}</Text>
        <Text>Task: {agent.description || '—'}</Text>
        <Text dimColor>
          On the clock {since((agent.endedAt ?? now) - agent.spawnedAt)} · {agent.toolCount} tool calls
        </Text>
        {fileList(Text, 'IN (read)', agent.filesIn)}
        {fileList(Text, 'OUT (written)', agent.filesOut)}
        {agent.prompt ? <Text dimColor>Brief: {agent.prompt.slice(0, 280)}{agent.prompt.length > 280 ? '…' : ''}</Text> : null}
      </Box>
    ) : selected === 'main' ? (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>Claude · Manager <Text dimColor>(main session)</Text></Text>
        <Text>{main.waiting ? 'Waiting for permission' : statusLine(main.tool ? 'working' : 'idle', main.tool)}</Text>
        <Text dimColor>
          In the office {since(now - (main.since || now))} · {main.toolCount} tool calls ·{' '}
          {agents.filter(a => a.status !== 'done').length} agents at desks
        </Text>
        {fileList(Text, 'IN (read)', main.filesIn)}
        {fileList(Text, 'OUT (written)', main.filesOut)}
      </Box>
    ) : null

    if (e.surface === 'terminal') {
      return (
        <Box flexDirection="column">
          <Text dimColor>The pixel office draws in the desktop app; here is the roster.</Text>
          {roster}
          {details}
        </Box>
      )
    }

    const { Svg } = $.ui.resolve(e)
    const office = drawOffice({ agents, main, peers, selected, now, cols })
    const busy = agents.filter(a => a.status !== 'done').length

    return (
      <Box flexDirection="column" gap={1}>
        <Svg
          source={office.svg}
          width={paneWidth}
          height={Math.round((paneWidth * office.height) / office.width)}
          alt={`Pixel office: Claude the manager and ${busy} agent${busy === 1 ? '' : 's'} at their desks`}
          isInteractive
        />
        {roster}
        {details ?? <Text dimColor>Pick someone above to see their task, trays and progress.</Text>}
      </Box>
    )
  })
}

function fileList(Text: ElementConstructor<TextProps>, label: string, files: string[]) {
  if (files.length === 0) return <Text dimColor>{label}: empty</Text>
  const shown = files.slice(-6).reverse()
  return (
    <Text>
      {label} ({files.length}): <Text dimColor>{shown.join(', ')}{files.length > 6 ? ', …' : ''}</Text>
    </Text>
  )
}
