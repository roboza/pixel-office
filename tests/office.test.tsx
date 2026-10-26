import { expect, mock, test } from 'claude-code/testing'
import type { AgentInfo } from 'claude-code'

const PANE = {
  plugin: 'pixel-office',
  component: 'Pane',
  requestId: 'pixel-office',
  props: {
    title: 'Office',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

/** What the engine fills in on a spawn the model asked for. */
const SPAWN = {
  tool_use_id: 'toolu_1',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: false,
  fork: false,
} as const

test('an agent is hired, works, finishes and walks out', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const listed: AgentInfo[] = []
  on('command.register', () => ({ value: { command: 'office' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.id', () => ({ value: 'session-1' }))
  on('session.cwd', () => ({ value: '/work/claude-office' }))
  on('agent.list', () => ({ value: listed }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'agent-1' }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ ...SPAWN, prompt: 'Find the auth code', description: 'Find auth', subagentType: 'Explore' })
  listed.push({ id: 'agent-1', description: 'Find auth', type: 'Explore', status: 'running' })
  await $.tool.call({ tool: 'Read', file_path: '/work/src/auth/login.ts', agentId: 'agent-1' })
  await $.tool.call({ tool: 'Edit', file_path: '/work/src/auth/session.ts', old_string: 'a', new_string: 'b', agentId: 'agent-1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  expect(JSON.stringify(svg)).toContain('Ellie')
  expect(JSON.stringify(svg)).toContain('login.ts')
  expect(JSON.stringify(svg)).toContain('session.ts')

  await ui.press({ key: 'pick:agent-1' })
  expect((await ui.find({ type: 'Text', text: /Find auth/ }))?.text).toContain('Task: Find auth')
  expect((await ui.find({ type: 'Text', text: /IN \(read\)/ }))?.text).toContain('auth/login.ts')

  // The engine reports it done: a check mark, then the walk out, then a free desk.
  listed[0] = { ...listed[0]!, status: 'completed' }
  await clock.advance(1500)
  expect((await ui.find({ type: 'Button', text: /Ellie/ }))?.text).toContain('✓')
  await clock.advance(6000)
  expect(await ui.find({ type: 'Button', text: /Ellie/ })).toBeUndefined()
  await ui.unmount()
})

test('the terminal gets a roster instead of the picture', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: { command: 'office' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'agent-2' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ ...SPAWN, prompt: 'Plan it', description: 'Plan', subagentType: 'Plan' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', text: /Pat/ }))?.text).toContain('Planner')
  await ui.unmount()
})
