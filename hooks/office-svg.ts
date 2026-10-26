// Draws the office as one SVG document. Time is the caller's `now`: every
// one-shot animation (walking in, walking out) is started with a negative
// delay, so a redraw mid-walk picks the walk up where it stands.

import type { OfficeAgent, OfficeMain, OfficePeer } from '../types'
import { ARM_UP, BUBBLE, HAND, HEADS, ICONS, LEGS_A, LEGS_B, PLANT, TORSO, WALK_BODY, paths } from './sprites'

export const WALK_MS = 2600
export const CHECK_MS = 2000
export const LEAVE_MS = CHECK_MS + WALK_MS

const CELL_W = 72
const CELL_H = 64
const LEFT = 20
const TOP = 124
const DOOR_X = 7
const SCALE = 3

const HAIRS = ['#2b1d16', '#5a3a22', '#8b5a2b', '#c98b3c', '#e3c16f', '#a33b2a', '#3a3a48', '#d9d4cc']
const SKINS = ['#f6d2b4', '#eab38e', '#c98e63', '#9a6643', '#6b4429']
const PANTS = ['#3d4a6b', '#4a3b33', '#2f3b3f', '#5b4a6b']
const PEER_SHIRTS = ['#6b8fb8', '#b8806b', '#7fa36b', '#a36b9a', '#6ba3a0']
const CODE = ['#7fe0a0', '#ffd479', '#8ecbff', '#f29b9b']

export type OfficeModel = {
  agents: OfficeAgent[]
  main: OfficeMain
  peers: OfficePeer[]
  selected: string
  now: number
  cols: number
}

type Point = [number, number]

/** The item at `i`, wrapping round the list. */
const pick = <T,>(list: readonly T[], i: number): T => list[i % list.length] as T

const r = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`

function esc(text: string): string {
  return text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
}

function cut(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => c(v).toString(16).padStart(2, '0')).join('')}`
}

function lookStyle(look: number, shirt: string): string {
  return `--hair:${pick(HAIRS, look)};--skin:${pick(SKINS, look >>> 3)};--shirt:${shirt};--shirt2:${shade(shirt, 0.75)};--pants:${pick(PANTS, look >>> 6)}`
}

const hairStyle = (look: number) => (look >>> 9) % HEADS.length

/** Which bubble icon a tool shows. */
export function toolKind(tool?: string): string {
  if (!tool) return 'think'
  if (tool === 'Read' || tool === 'NotebookRead') return 'read'
  if (tool === 'Grep' || tool === 'Glob' || tool === 'LS' || tool === 'ToolSearch') return 'search'
  if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' || tool === 'NotebookEdit') return 'write'
  if (tool === 'Bash' || tool === 'PowerShell' || tool === 'Monitor') return 'shell'
  if (tool === 'WebFetch' || tool === 'WebSearch' || /browser|chrome/i.test(tool)) return 'web'
  if (tool === 'Agent' || tool === 'Task' || tool === 'Workflow' || tool === 'SendMessage') return 'team'
  if (tool === 'TodoWrite' || /update_plan/.test(tool)) return 'list'
  if (tool === 'AskUserQuestion') return 'ask'
  return 'gear'
}

/** What a tool reads as in a sentence: `Grep` is "searching code". */
export function toolLabel(tool: string): string {
  const words: Record<string, string> = {
    Read: 'reading a file',
    Grep: 'searching code',
    Glob: 'finding files',
    Edit: 'editing a file',
    MultiEdit: 'editing a file',
    Write: 'writing a file',
    NotebookEdit: 'editing a notebook',
    Bash: 'running a command',
    PowerShell: 'running a command',
    WebFetch: 'reading a web page',
    WebSearch: 'searching the web',
    Agent: 'delegating to an agent',
    Workflow: 'running a workflow',
    TodoWrite: 'updating the plan',
    AskUserQuestion: 'asking you a question',
  }
  return words[tool] ?? `using ${tool.startsWith('mcp__') ? tool.split('__').pop() : tool}`
}

const STYLE = `
.tA{animation:tap .26s steps(1) infinite}
.tB{animation:tap .26s steps(1) infinite;animation-delay:-.13s}
@keyframes tap{50%{transform:translateY(-1px)}}
.bob{animation:tap 1.4s steps(1) infinite}
.wave{animation:wave .6s steps(1) infinite}
@keyframes wave{50%{transform:translateY(-2px)}}
.scr{animation:scr 2.4s steps(4) infinite}
@keyframes scr{to{transform:translateY(-8px)}}
.blink{animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.lA{animation:blink .36s steps(1) infinite}
.lB{animation:blink .36s steps(1) infinite;animation-delay:-.18s}
.drift{animation:drift 46s linear infinite}
@keyframes drift{from{transform:translateX(-34px)}to{transform:translateX(44px)}}
.rise{animation:rise 2.2s steps(6) infinite}
@keyframes rise{to{transform:translateY(-6px)}}
.ants{animation:ants .8s linear infinite}
@keyframes ants{to{stroke-dashoffset:-5}}
@keyframes show{from{opacity:0}to{opacity:1}}
@keyframes hide{from{opacity:1}to{opacity:0}}
@keyframes fadein{0%{opacity:0}12%{opacity:1}100%{opacity:1}}
@keyframes fadeout{0%{opacity:1}85%{opacity:1}100%{opacity:0}}
text{font-family:ui-monospace,Consolas,monospace}
`

function defs(): string {
  let s = '<defs>'
  HEADS.forEach((head, i) => {
    s += `<g id="seat${i}">${paths(head)}${paths(TORSO, 0, 9)}</g>`
    s += `<g id="walk${i}">${paths(head)}${paths(WALK_BODY, 0, 9)}</g>`
  })
  s += `<g id="legA">${paths(LEGS_A, 0, 15)}</g><g id="legB">${paths(LEGS_B, 0, 15)}</g>`
  s += `<g id="hand">${paths(HAND)}</g><g id="armup">${paths(ARM_UP)}</g>`
  s += `<g id="bubble">${paths(BUBBLE)}</g><g id="plant">${paths(PLANT)}</g>`
  for (const [kind, grid] of Object.entries(ICONS)) s += `<g id="i-${kind}">${paths(grid)}</g>`

  // The chair, drawn behind the person.
  s += '<g id="chair">'
  s += r(28, 9, 16, 11, '#2b1d16') + r(27, 10, 18, 10, '#2b1d16')
  s += `<rect x="29" y="10" width="14" height="10" style="fill:var(--chair,#3f6b5a)"/>`
  s += `<rect x="28" y="11" width="16" height="9" style="fill:var(--chair,#3f6b5a)"/>`
  s += r(30, 11, 12, 1, '#ffffff33')
  s += '</g>'

  // The desk, drawn in front: top, monitor case, keyboard, mug, tray bodies, front panel.
  s += '<g id="desk">'
  s += `<rect x="5" y="47" width="62" height="3" fill="#000" fill-opacity=".14"/>`
  s += r(6, 18, 60, 15, '#3b2a20') + r(7, 19, 58, 13, '#b5763f') + r(7, 19, 58, 1, '#cf9056')
  s += r(12, 24, 10, 1, '#a8693a') + r(40, 30, 14, 1, '#a8693a') + r(24, 28, 6, 1, '#a8693a')
  s += r(9, 7, 16, 13, '#3b2a20') + r(10, 8, 14, 11, '#e8dfc8') + r(10, 18, 14, 1, '#cbbf9f')
  s += r(15, 20, 4, 2, '#cbbf9f') + r(13, 22, 8, 1, '#3b2a20')
  s += r(29, 24, 14, 4, '#3b2a20') + r(30, 25, 12, 2, '#d9d4cc')
  s += r(31, 25, 1, 1, '#a9a39b') + r(34, 25, 1, 1, '#a9a39b') + r(37, 25, 1, 1, '#a9a39b') + r(40, 25, 1, 1, '#a9a39b')
  s += r(9, 26, 4, 4, '#3b2a20') + r(10, 27, 2, 2, '#e8e2d4') + r(13, 27, 1, 2, '#3b2a20')
  for (const tx of [45, 56]) {
    s += r(tx, 27, 10, 4, '#3b2a20') + r(tx + 1, 27, 8, 3, '#9aa3ad')
  }
  s += r(45, 29, 10, 2, '#3b2a20') + r(46, 29, 8, 1, '#5aa05a')
  s += r(56, 29, 10, 2, '#3b2a20') + r(57, 29, 8, 1, '#d9773e')
  s += r(6, 33, 60, 14, '#3b2a20') + r(7, 33, 58, 13, '#8f5a30') + r(7, 45, 58, 1, '#6e4424')
  s += r(13, 34, 46, 10, '#d4a845') + r(14, 35, 44, 8, '#3b2a20')
  s += '</g>'

  s += `<pattern id="planks" width="32" height="16" patternUnits="userSpaceOnUse">`
  s += r(0, 0, 32, 16, '#c98d5a') + r(0, 7, 32, 1, '#a86f43') + r(0, 15, 32, 1, '#a86f43')
  s += r(10, 0, 1, 7, '#a86f43') + r(26, 8, 1, 7, '#a86f43')
  s += r(2, 2, 5, 1, '#d39a66') + r(15, 11, 6, 1, '#bd8150') + r(20, 3, 4, 1, '#bd8150')
  s += '</pattern>'
  s += `<pattern id="paper" width="8" height="8" patternUnits="userSpaceOnUse">`
  s += r(0, 0, 8, 8, '#f1e3c8') + r(0, 0, 1, 8, '#e9d7b4') + r(4, 3, 1, 1, '#e2cfa9')
  s += '</pattern>'
  s += '</defs>'
  return s
}

function windowPane(x: number, w: number, seed: number): string {
  let s = r(x - 1, 5, w + 2, 20, '#d9c7a4') + r(x, 6, w, 18, '#fdf6e3')
  s += `<svg x="${x + 2}" y="8" width="${w - 4}" height="14">`
  s += r(0, 0, w - 4, 14, '#9fd3e6') + r(0, 0, w - 4, 5, '#bfe4f0')
  s += `<g class="drift" style="animation-delay:-${seed % 46}s">`
  s += r(6, 4, 9, 2, '#fff') + r(8, 3, 4, 1, '#fff') + r(22, 8, 7, 2, '#fff') + r(24, 7, 3, 1, '#fff')
  s += '</g>'
  s += r(0, 11, w - 4, 3, '#8cc49a')
  s += '</svg>'
  s += r(x + w / 2 - 1, 8, 2, 14, '#fdf6e3') + r(x + 2, 14, w - 4, 1, '#fdf6e3')
  s += r(x - 2, 24, w + 4, 2, '#e2cfa9')
  return s
}

function clock(x: number, now: number): string {
  const d = new Date(now)
  const cx = x + 5.5
  const cy = 13.5
  const min = d.getMinutes() * 6
  const hour = (d.getHours() % 12) * 30 + d.getMinutes() / 2
  let s = r(x, 8, 11, 11, '#3b2a20') + r(x + 1, 9, 9, 9, '#fdf6e3')
  s += r(x + 5, 9, 1, 1, '#c96a4a') + r(x + 5, 17, 1, 1, '#c96a4a') + r(x + 1, 13, 1, 1, '#c96a4a') + r(x + 9, 13, 1, 1, '#c96a4a')
  s += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 4}" stroke="#3b2a20" stroke-width=".8" transform="rotate(${min} ${cx} ${cy})"/>`
  s += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 2.6}" stroke="#3b2a20" stroke-width="1.1" transform="rotate(${hour} ${cx} ${cy})"/>`
  return s
}

function backdrop(W: number, H: number, now: number): string {
  let s = `<rect width="${W}" height="${H}" fill="url(#planks)"/>`
  s += `<rect width="${W}" height="40" fill="url(#paper)"/>`
  s += r(0, 26, W, 12, '#a0673f') + r(0, 26, W, 1, '#c98d5a')
  for (let x = 8; x < W; x += 16) s += r(x, 28, 1, 9, '#8a5532')
  s += r(0, 38, W, 2, '#5e3a22') + `<rect y="40" width="${W}" height="2" fill="#000" fill-opacity=".12"/>`

  // The front door, top left, where everyone comes in.
  s += r(3, 9, 20, 31, '#5e3a22') + r(5, 11, 16, 29, '#8a5532')
  s += r(7, 13, 12, 10, '#9a6440') + r(7, 26, 12, 11, '#9a6440') + r(18, 25, 2, 2, '#f2c14e')
  s += r(6, 4, 14, 4, '#2f7a4a') + r(7, 5, 12, 2, '#5fcf8a')
  s += r(3, 40, 20, 4, '#7a5a8a') + r(3, 41, 20, 1, '#9a7aaa') + r(3, 43, 20, 1, '#5e4470')

  // Windows along the back wall, a clock, a poster over the manager's office.
  let x = 32
  let seed = 7
  while (x + 40 <= W - 58) {
    s += windowPane(x, 40, seed)
    seed += 13
    x += 52
  }
  if (x + 11 <= W - 58) s += clock(x, now)
  if (W >= 170) {
    const px = W - 50
    s += r(px, 6, 38, 18, '#3b2a20') + r(px + 1, 7, 36, 16, '#c96a4a') + r(px + 2, 8, 34, 14, '#e98b66')
    s += `<text x="${px + 19}" y="17.5" font-size="6" font-weight="bold" fill="#fffaf0" text-anchor="middle">SHIP IT</text>`
  }
  return s
}

function decor(W: number): string {
  const room = W - 116
  let s = ''
  // Water cooler, with a bubble rising in the bottle.
  s += r(27, 29, 12, 24, '#3b2a20') + r(28, 38, 10, 14, '#dfe7ee') + r(28, 38, 10, 1, '#f5f9fb')
  s += r(29, 22, 8, 16, '#3b2a20') + r(30, 23, 6, 14, '#8ecbff') + r(31, 24, 1, 12, '#c2e4ff')
  s += `<g class="rise">${r(33, 33, 1, 1, '#e8f6ff')}</g>`
  s += r(31, 42, 4, 2, '#3b2a20') + r(32, 43, 2, 2, '#5aa7d8') + `<rect x="27" y="53" width="12" height="2" fill="#000" fill-opacity=".14"/>`
  if (room >= 60) s += `<use href="#plant" x="44" y="44"/>`
  if (room >= 96) {
    // Printer on a cabinet.
    s += r(60, 42, 28, 14, '#3b2a20') + r(61, 43, 26, 12, '#8f5a30') + r(62, 48, 24, 1, '#6e4424') + r(72, 45, 4, 1, '#d4a845') + r(72, 51, 4, 1, '#d4a845')
    s += r(62, 33, 24, 10, '#3b2a20') + r(63, 34, 22, 8, '#d9d4cc') + r(63, 34, 22, 2, '#b8b0a8') + r(66, 31, 14, 3, '#fffaf0') + r(81, 39, 2, 1, '#7fe0a0')
  }
  if (room >= 136) {
    // Bookshelf against the wall.
    s += r(96, 14, 32, 34, '#3b2a20') + r(97, 15, 30, 32, '#6e4424')
    const books = ['#c96a4a', '#4f7fc0', '#e3c16f', '#5aa05a', '#8a64b8', '#d9d4cc', '#3f9e9a']
    for (const [row, y] of [[0, 16], [1, 26], [2, 36]] as const) {
      for (let i = 0; i < 7; i++) {
        const h = 7 + ((i * 3 + row) % 3)
        s += r(98 + i * 4, y + 9 - h, 3, h, pick(books, i + row * 2))
      }
      s += r(97, y + 9, 30, 1, '#4a2e1a')
    }
  }
  if (room >= 186) {
    // A couch and a coffee table.
    s += r(136, 50, 42, 16, '#3b2a20') + r(137, 51, 40, 6, '#a34d4d') + r(137, 57, 40, 8, '#b85c5c')
    s += r(138, 58, 18, 1, '#cf7a7a') + r(158, 58, 18, 1, '#cf7a7a') + r(156, 57, 2, 8, '#a34d4d')
    s += r(146, 70, 22, 8, '#3b2a20') + r(147, 71, 20, 5, '#b5763f') + r(150, 69, 3, 3, '#fffaf0') + r(160, 70, 4, 2, '#4f7fc0')
  }
  if (room >= 230) s += `<use href="#plant" x="${W - 136}" y="44"/>`
  return s
}

type Who = { look: number; shirt: string; chair?: string; mark?: boolean }
type Mood = 'type' | 'idle' | 'wait'

function person(x: number, y: number, who: Who, mood: Mood, phase: number): { body: string; hands: string } {
  const style = lookStyle(who.look, who.shirt)
  const sx = x + 30
  const sy = y + 3
  let body = `<g transform="translate(${sx} ${sy})" style="${style}"><use href="#seat${hairStyle(who.look)}"/>`
  if (who.mark) body += r(5, 10, 2, 2, '#fffaf0')
  if (mood === 'wait') body += `<g class="wave"><use href="#armup" x="10" y="-4"/></g>`
  body += '</g>'
  const delay = `animation-delay:-${(phase % 260) / 1000}s`
  let hands = `<g style="${style}">`
  if (mood === 'type') {
    hands += `<g class="tA" style="${delay}"><use href="#hand" x="${x + 30}" y="${y + 22}"/></g>`
    hands += `<g class="tB" style="${delay}"><use href="#hand" x="${x + 39}" y="${y + 22}"/></g>`
  } else {
    hands += `<use href="#hand" x="${x + 30}" y="${y + 22}"/>`
    if (mood === 'idle') hands += `<use href="#hand" x="${x + 39}" y="${y + 22}"/>`
  }
  hands += '</g>'
  return { body, hands }
}

function screen(x: number, y: number, state: 'on' | 'idle' | 'off', seed: number): string {
  if (state === 'off') return r(x + 11, y + 9, 12, 8, '#152224') + r(x + 22, y + 18, 1, 1, '#5a5a5a')
  let s = `<svg x="${x + 11}" y="${y + 9}" width="12" height="8">` + r(0, 0, 12, 8, '#1f3a3d')
  if (state === 'on') {
    s += `<g class="scr" style="animation-delay:-${(seed % 2400) / 1000}s">`
    // Lines repeat every four, so the 8px scroll loops without a seam.
    for (let i = 0; i < 8; i++) {
      const k = i % 4
      const w = 3 + ((seed >>> k) % 7)
      const indent = (seed >>> (k + 3)) % 3
      s += r(1 + indent, 1 + i * 2, w, 1, pick(CODE, seed >>> (k * 2)))
    }
    s += '</g>'
  } else {
    s += `<g class="blink">${r(1, 1, 2, 1, '#7fe0a0')}</g>`
  }
  s += '</svg>' + r(x + 22, y + 18, 1, 1, state === 'on' ? '#7fe0a0' : '#c9a227')
  return s
}

function tray(x: number, y: number, label: string, files: string[]): string {
  const n = Math.min(files.length, 6)
  let s = `<g><title>${esc(`${label} (${files.length})${files.length ? '\n' + files.slice(-12).reverse().join('\n') : ''}`)}</title>`
  s += `<rect x="${x}" y="${y}" width="10" height="10" fill="#000" fill-opacity="0"/>`
  for (let i = 0; i < n; i++) s += r(x + 1, y + 5 - i, 8, 1, i % 2 ? '#efe7d6' : '#fffaf0')
  if (n > 0) s += r(x + 2, y + 5 - (n - 1), 4, 1, '#c9c0ae')
  s += '</g>'
  return s
}

function plate(x: number, y: number, name: string, role: string, dim: boolean): string {
  const cx = x + 36
  return (
    `<text x="${cx}" y="${y + 39.4}" font-size="4.6" font-weight="bold" fill="${dim ? '#8a7a5a' : '#f7e7b6'}" text-anchor="middle">${esc(cut(name, 13))}</text>` +
    `<text x="${cx}" y="${y + 42.6}" font-size="2.9" fill="${dim ? '#6e5f45' : '#d4a845'}" text-anchor="middle">${esc(cut(role.toUpperCase(), 18))}</text>`
  )
}

function bubble(x: number, y: number, kind: string): string {
  const fill = kind === 'wait' ? '#ffe9a0' : kind === 'done' ? '#d8f5d0' : kind === 'fail' ? '#ffd6d0' : '#fffaf0'
  return `<g transform="translate(${x + 41} ${y - 5})"><g class="bob" style="--bub:${fill}"><use href="#bubble"/><use href="#i-${kind}" x="2" y="1"/></g></g>`
}

function keyframes(name: string, pts: Point[]): string {
  const dist: number[] = []
  let total = 0
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[i - 1] ?? [x, y]
    total += Math.abs(x - px) + Math.abs(y - py)
    dist.push(total)
  })
  const frames = pts.map(([x, y], i) => `${(((dist[i] ?? 0) / (total || 1)) * 100).toFixed(2)}%{transform:translate(${x}px,${y}px)}`)
  return `@keyframes ${name}{${frames.join('')}}`
}

function walkerSprite(who: Who): string {
  return (
    `<g style="${lookStyle(who.look, who.shirt)}"><use href="#walk${hairStyle(who.look)}"/>` +
    `<g class="lA"><use href="#legA"/></g><g class="lB"><use href="#legB"/></g></g>`
  )
}

type Desk = { x: number; y: number }

function deskAt(index: number, cols: number): Desk {
  return { x: LEFT + (index % cols) * CELL_W, y: TOP + Math.floor(index / cols) * CELL_H }
}

function pathTo(d: Desk): Point[] {
  const aisle = d.y - 15
  return [
    [DOOR_X, 16],
    [DOOR_X, aisle],
    [d.x + 30, aisle],
    [d.x + 30, d.y + 3],
  ]
}

function occupantTitle(a: OfficeAgent): string {
  const status =
    a.status === 'waiting'
      ? 'Waiting for permission'
      : a.status === 'done'
        ? a.outcome === 'failed'
          ? 'Stopped'
          : 'Finished'
        : a.tool
          ? toolLabel(a.tool)
          : 'Thinking'
  return `${a.name} · ${a.role} (${a.type})\n${status}\n${a.description}`
}

export function drawOffice(m: OfficeModel): { svg: string; width: number; height: number } {
  const { cols, now } = m
  const W = LEFT + cols * CELL_W + 12
  const live = m.agents.filter(a => !(a.status === 'done' && now - (a.endedAt ?? now) >= LEAVE_MS))
  const top = live.reduce((n, a) => Math.max(n, a.desk + 1), 0)
  const rows = Math.max(2, Math.ceil(top / cols))
  const peerY = TOP + rows * CELL_H
  const peerRows = Math.ceil(m.peers.length / cols)
  const H = m.peers.length ? peerY + 12 + peerRows * CELL_H : peerY + 2

  let css = STYLE
  let floor = ''
  let above = ''
  let walkers = ''

  // The manager's glass office, top right.
  const mx = W - 110
  const my = 42
  floor += r(mx + 3, my, 104, 58, '#5e7a68') + r(mx + 5, my + 2, 100, 54, '#6f8f7a')
  floor += r(mx + 9, my + 6, 92, 46, '#7d9e88')
  const mainMood: Mood = m.main.waiting ? 'wait' : m.main.tool ? 'type' : 'idle'
  const boss: Who = { look: 9, shirt: '#d97757', mark: true }
  const md = { x: mx + 16, y: my + 2 }
  const mp = person(md.x, md.y, boss, mainMood, 77)
  floor += `<g><title>${esc(`Claude · Manager (main session)\n${m.main.waiting ? 'Waiting for permission' : m.main.tool ? toolLabel(m.main.tool) : 'At the desk'}`)}</title>`
  floor += `<use href="#chair" x="${md.x}" y="${md.y}" style="--chair:#6b3f2a"/>` + mp.body + `<use href="#desk" x="${md.x}" y="${md.y}"/>`
  floor += screen(md.x, md.y, m.main.tool ? 'on' : 'idle', 4242) + mp.hands
  floor += tray(md.x + 45, md.y + 21, 'IN: files read', m.main.filesIn) + tray(md.x + 56, md.y + 21, 'OUT: files written', m.main.filesOut)
  floor += plate(md.x, md.y, 'Claude', 'Manager', false) + '</g>'
  floor += `<use href="#plant" x="${mx + 93}" y="${my + 40}"/>`
  if (m.main.waiting) above += bubble(md.x, md.y, 'wait')
  else if (m.main.tool) above += bubble(md.x, md.y, toolKind(m.main.tool))
  // Glass: the left wall and the front wall, with the doorway left open.
  const glass = (x: number, y: number, w: number, h: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#bfe6f2" fill-opacity=".45"/>`
  let walls = glass(mx, my - 2, 3, 63) + r(mx, my - 2, 1, 63, '#5b6b76') + r(mx + 3, my - 2, 1, 63, '#5b6b76')
  walls += glass(mx + 24, my + 58, W - mx - 24, 3) + r(mx + 24, my + 58, W - mx - 24, 1, '#5b6b76') + r(mx + 24, my + 61, W - mx - 24, 1, '#5b6b76')
  walls += r(mx + 1, my + 4, 1, 6, '#ffffff99') + r(mx + 40, my + 59, 6, 1, '#ffffff99') + r(mx + 70, my + 59, 3, 1, '#ffffff99')
  if (m.selected === 'main') walls += selection(md)

  // Agent desks.
  for (let i = 0; i < rows * cols; i++) {
    const d = deskAt(i, cols)
    const a = live.find(one => one.desk === i)
    if (!a) {
      floor += `<g><title>Vacant desk</title><use href="#chair" x="${d.x}" y="${d.y}"/><use href="#desk" x="${d.x}" y="${d.y}"/>`
      floor += screen(d.x, d.y, 'off', i) + plate(d.x, d.y, 'Vacant', 'desk', true) + '</g>'
      continue
    }
    const who: Who = { look: a.look, shirt: a.shirt }
    const mood: Mood = a.status === 'waiting' ? 'wait' : a.status === 'done' ? 'idle' : 'type'
    const p = person(d.x, d.y, who, mood, a.look)
    const kind = a.status === 'waiting' ? 'wait' : a.status === 'done' ? (a.outcome === 'failed' ? 'fail' : 'done') : toolKind(a.tool)

    // Timing of the walk in and the walk out.
    const sinceSpawn = now - a.spawnedAt
    const sinceEnd = a.status === 'done' ? now - (a.endedAt ?? now) : -1
    const id = `w${a.look.toString(36)}${a.desk}`
    let wrapOpen = ''
    if (sinceEnd >= 0) {
      const at = CHECK_MS - sinceEnd
      wrapOpen = `<g style="animation:hide 1ms steps(1,end) ${at}ms forwards">`
      css += keyframes(`${id}o`, [...pathTo(d)].reverse())
      walkers +=
        `<g style="animation:${id}o ${WALK_MS}ms linear ${at}ms both"><g style="animation:show 1ms steps(1,end) ${at}ms both">` +
        `<g style="animation:fadeout ${WALK_MS}ms linear ${at}ms both">${walkerSprite(who)}</g></g></g>`
    } else if (sinceSpawn < WALK_MS) {
      const at = WALK_MS - sinceSpawn
      wrapOpen = `<g style="animation:show 1ms steps(1,end) ${at}ms both">`
      css += keyframes(`${id}i`, pathTo(d))
      walkers +=
        `<g style="animation:${id}i ${WALK_MS}ms linear ${-sinceSpawn}ms both"><g style="animation:hide 1ms steps(1,end) ${at}ms forwards">` +
        `<g style="animation:fadein ${WALK_MS}ms linear ${-sinceSpawn}ms both">${walkerSprite(who)}</g></g></g>`
    }
    const wrapClose = wrapOpen ? '</g>' : ''

    floor += `<g><title>${esc(occupantTitle(a))}</title><use href="#chair" x="${d.x}" y="${d.y}"/>`
    floor += wrapOpen + p.body + wrapClose
    floor += `<use href="#desk" x="${d.x}" y="${d.y}"/>`
    floor += screen(d.x, d.y, a.status === 'working' ? 'on' : 'idle', a.look)
    floor += wrapOpen + p.hands + wrapClose
    floor += tray(d.x + 45, d.y + 21, 'IN: files read', a.filesIn) + tray(d.x + 56, d.y + 21, 'OUT: files written', a.filesOut)
    floor += plate(d.x, d.y, a.name, a.role, false) + '</g>'
    above += wrapOpen + bubble(d.x, d.y, kind) + wrapClose
    if (m.selected === a.id) above += selection(d)
  }

  // Colleagues in other sessions, behind a low partition.
  if (m.peers.length) {
    floor += r(0, peerY + 1, W, 5, '#3b2a20') + r(0, peerY + 2, W, 3, '#8f5a30') + r(0, peerY + 2, W, 1, '#cf9056')
    floor += r(LEFT, peerY - 2, 64, 9, '#3b2a20') + r(LEFT + 1, peerY - 1, 62, 7, '#2f4a3a')
    floor += `<text x="${LEFT + 32}" y="${peerY + 4.2}" font-size="4.4" font-weight="bold" fill="#f7e7b6" text-anchor="middle">OTHER SESSIONS</text>`
    m.peers.forEach((peer, i) => {
      const d = { x: LEFT + (i % cols) * CELL_W, y: peerY + 12 + Math.floor(i / cols) * CELL_H }
      let look = 0
      for (const ch of peer.id) look = (look * 31 + ch.charCodeAt(0)) >>> 0
      const who: Who = { look, shirt: pick(PEER_SHIRTS, look) }
      const p = person(d.x, d.y, who, peer.isActive ? 'type' : 'idle', look)
      const role = peer.agents ? `${peer.agents} agent${peer.agents === 1 ? '' : 's'}` : peer.isActive ? 'busy' : 'idle'
      floor += `<g><title>${esc(`Session in ${peer.label}\n${role}`)}</title><use href="#chair" x="${d.x}" y="${d.y}" style="--chair:#4a5a7a"/>`
      floor += p.body + `<use href="#desk" x="${d.x}" y="${d.y}"/>` + screen(d.x, d.y, peer.isActive ? 'on' : 'idle', look) + p.hands
      floor += plate(d.x, d.y, peer.label, role, false) + '</g>'
      if (peer.agents) above += bubble(d.x, d.y, 'team')
    })
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}" shape-rendering="crispEdges" style="display:block;width:100%;height:auto">` +
    `<style>${css}</style>${defs()}${backdrop(W, H, now)}${decor(W)}${floor}${walls}${walkers}${above}</svg>`
  return { svg, width: W, height: H }
}

function selection(d: Desk): string {
  return `<rect x="${d.x + 3.5}" y="${d.y - 1.5}" width="65" height="52" fill="none" stroke="#ffd54a" stroke-width="1" stroke-dasharray="3 2" class="ants"/>`
}
