// Pixel sprites as strings, one character a pixel; `.` is transparent.
// Upper-case H, K, S, s and P are recoloured per person through CSS variables.

export const PALETTE: Record<string, string> = {
  k: '#3b2a20', // outline
  e: '#241812', // eyes
  w: '#fffaf0',
  H: 'var(--hair)',
  K: 'var(--skin)',
  S: 'var(--shirt)',
  s: 'var(--shirt2)',
  P: 'var(--pants)',
  p: '#e8998a', // blush
  B: '#4a3426', // shoes
  F: 'var(--bub)', // bubble fill
  Y: '#f2c14e',
  q: '#e88d9a',
  g: '#1f3a3d',
  G: '#7fe0a0',
  b: '#5aa7d8',
  n: '#4f9a52',
  N: '#3a7a40',
  r: '#d9534f',
  l: '#b8c0c8',
  d: '#6b7b86',
  f: '#eab38e',
  c: '#c0603a',
  C: '#96462a',
}

/** One `<path>` per colour, a horizontal run per subpath, offset by (dx, dy). */
export function paths(grid: readonly string[], dx = 0, dy = 0): string {
  const runs = new Map<string, string[]>()
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row.charAt(x)
      if (ch === '.' || ch === ' ') {
        x++
        continue
      }
      let n = 1
      while (row.charAt(x + n) === ch) n++
      const list = runs.get(ch) ?? []
      list.push(`M${x + dx} ${y + dy}h${n}v1h-${n}z`)
      runs.set(ch, list)
      x += n
    }
  })
  return [...runs].map(([ch, d]) => `<path style="fill:${PALETTE[ch] ?? ch}" d="${d.join('')}"/>`).join('')
}

const HEAD_SHORT = [
  '...kkkkkk...',
  '..kHHHHHHk..',
  '.kHHHHHHHHk.',
  '.kHHHHHHHHk.',
  '.kHKKKKKKHk.',
  '.kKKeKKeKKk.',
  '.kpKKKKKKpk.',
  '..kKKKKKKk..',
  '...kkKKkk...',
]

const HEAD_LONG = [
  '...kkkkkk...',
  '..kHHHHHHk..',
  '.kHHHHHHHHk.',
  'kHHHHHHHHHHk',
  'kHHKKKKKKHHk',
  'kHKKeKKeKKHk',
  'kHpKKKKKKpHk',
  'kHHKKKKKKHHk',
  'kHHkkKKkkHHk',
]

const HEAD_BUN = [
  '....kkkk....',
  '...kHHHHk...',
  '..kkHHHHkk..',
  '.kHHHHHHHHk.',
  '.kHKKKKKKHk.',
  '.kKKeKKeKKk.',
  '.kpKKKKKKpk.',
  '..kKKKKKKk..',
  '...kkKKkk...',
]

export const HEADS = [HEAD_SHORT, HEAD_LONG, HEAD_BUN]

export const TORSO = [
  '.kSSSKKSSSk.',
  'kSSSSSSSSSSk',
  'kSsSSSSSSsSk',
  'kSsSSSSSSsSk',
]

export const WALK_BODY = [
  '.kSSSKKSSSk.',
  'kSSSSSSSSSSk',
  'kKsSSSSSSsKk',
  'kKsSSSSSSsKk',
  '.kSSSSSSSSk.',
  '.kPPPPPPPPk.',
]

export const LEGS_A = [
  '.kPPk..kPPk.',
  '.kPPk..kPPk.',
  '.kBBk...kk..',
  '..kk........',
]

export const LEGS_B = [
  '.kPPk..kPPk.',
  '.kPPk..kPPk.',
  '..kk...kBBk.',
  '........kk..',
]

export const HAND = ['kKk', 'kKk']

export const ARM_UP = ['.kk.', 'kKKk', 'kKKk', 'kSSk', 'kSSk', 'kSSk', 'kSSk']

export const BUBBLE = [
  '.kkkkkkkkk.',
  'kFFFFFFFFFk',
  'kFFFFFFFFFk',
  'kFFFFFFFFFk',
  'kFFFFFFFFFk',
  'kFFFFFFFFFk',
  'kFFFFFFFFFk',
  'kFFFFFFFFFk',
  '.kkkkkkkkk.',
  '..kFk......',
  '..kk.......',
]

export const PLANT = [
  '....nn......',
  '..n.nNn.n...',
  '.nNnnNnnNn..',
  'nNNnNNnNNn..',
  '.nNnnNnNnn..',
  '..nNNNNNn...',
  '...cccccc...',
  '...cCCCCc...',
  '....cCCc....',
]

/** Bubble icons, 7x7. */
export const ICONS: Record<string, readonly string[]> = {
  search: ['.kkk...', 'kwbwk..', 'kbwbk..', 'kwbwk..', '.kkkk..', '....kk.', '.....kk'],
  read: ['kkkkk..', 'kwwwkk.', 'kwkkwk.', 'kwwwwk.', 'kwkkwk.', 'kwwwwk.', 'kkkkkk.'],
  write: ['.....kk', '....kYk', '...kYk.', '..kYk..', '.kYk...', 'kqk....', 'kk.....'],
  shell: ['kkkkkkk', 'kgggggk', 'kGggggk', 'kgGgggk', 'kGgGGgk', 'kgggggk', 'kkkkkkk'],
  web: ['..kkk..', '.kbnbk.', 'kbnnbbk', 'kbbnnbk', 'knbbbnk', '.kbnbk.', '..kkk..'],
  team: ['.kk.kk.', 'kffkffk', '.kk.kk.', 'kbbkrrk', 'kbbkrrk', 'kbbkrrk', '.......'],
  list: ['n......', 'nn.kkkk', '.n.....', 'n......', 'nn.kkkk', '.n.....', '.......'],
  gear: ['..k.k..', '.kkkkk.', 'kkldlkk', '.kdwdk.', 'kkldlkk', '.kkkkk.', '..k.k..'],
  think: ['.......', '.......', '.......', '.k.k.k.', '.......', '.......', '.......'],
  ask: ['..kkk..', '.k...k.', '.....k.', '...kk..', '...k...', '.......', '...k...'],
  wait: ['...k...', '..kkk..', '..kkk..', '...k...', '...k...', '.......', '...k...'],
  done: ['.......', '......n', '.....nn', 'n...nn.', 'nn.nn..', '.nnn...', '..n....'],
  fail: ['r.....r', '.r...r.', '..r.r..', '...r...', '..r.r..', '.r...r.', 'r.....r'],
}
