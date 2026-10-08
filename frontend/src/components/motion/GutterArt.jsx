import useInView, { prefersReducedMotion } from './useInView'
import './motion.css'

// Gap #1: the empty 176px side columns on form steps between ~960px and 1179px.
// Left: a kolam that slowly draws itself. Right: jasmine petals drifting down.
// Both are decorative only (aria-hidden) and stick near the top while the card scrolls.

const ACCENT = '#a65d45'
const SAND = '#d7bca0'

// ---------- kolam ----------

const COLS = [32, 64, 96]
const ROWS = [24, 56, 88, 120, 152, 184, 216]

// pinched four-point star around one dot
function starAround(x, y, r = 14, pinch = 3) {
  return [
    `M ${x} ${y - r}`,
    `Q ${x + pinch} ${y - pinch} ${x + r} ${y}`,
    `Q ${x + pinch} ${y + pinch} ${x} ${y + r}`,
    `Q ${x - pinch} ${y + pinch} ${x - r} ${y}`,
    `Q ${x - pinch} ${y - pinch} ${x} ${y - r}`,
  ].join(' ')
}

// small ring in the middle of four dots
function ringAt(x, y, r = 5) {
  return `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
}

// scalloped edge running down one side
function scallop(x, dir) {
  let d = `M ${x} ${ROWS[0] - 16}`
  for (let i = 0; i < ROWS.length; i++) {
    const y = ROWS[i]
    d += ` Q ${x + dir * 14} ${y} ${x} ${y + 16}`
  }
  return d
}

function buildKolam() {
  const lines = []
  ROWS.forEach((y, row) => {
    COLS.forEach((x) => lines.push({ d: starAround(x, y), delay: row * 0.45 }))
    if (row < ROWS.length - 1) {
      ;[48, 80].forEach((x) => lines.push({ d: ringAt(x, y + 16), delay: row * 0.45 + 0.25 }))
    }
  })
  lines.push({ d: scallop(10, -1), delay: 0.2 })
  lines.push({ d: scallop(118, 1), delay: 0.2 })
  return lines
}

const KOLAM_LINES = buildKolam()

export function GutterKolam({ className = '' }) {
  const [ref, inView] = useInView()

  return (
    <div ref={ref} aria-hidden="true" className={`sticky top-24 ${inView ? '' : 'dp-paused'} ${className}`}>
      <svg viewBox="0 0 128 240" className="mx-auto block w-full max-w-[128px]" fill="none">
        {KOLAM_LINES.map((l, i) => (
          <path
            key={i}
            d={l.d}
            pathLength="1"
            className="dp-kolam-line"
            stroke={ACCENT}
            strokeOpacity="0.55"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animationDelay: `${l.delay}s` }}
          />
        ))}
        {ROWS.map((y, row) =>
          COLS.map((x) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="2"
              fill={SAND}
              className="dp-kolam-dot"
              style={{ animationDelay: `${row * 0.3}s` }}
            />
          )),
        )}
      </svg>
      <p className="mt-3 text-center text-[11px] uppercase tracking-[0.16em] text-ink-3">Kolam · for the doorstep</p>
    </div>
  )
}

// ---------- jasmine petals ----------

function Petal({ flower = false }) {
  if (flower) {
    return (
      <svg width="26" height="26" viewBox="-10 -10 20 20">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-4.6" rx="2.6" ry="4.6" transform={`rotate(${a})`} fill="#fffdf9" stroke="#ded5c8" strokeWidth="0.7" />
        ))}
        <circle r="1.8" fill="#f6ddae" />
      </svg>
    )
  }
  return (
    <svg width="13" height="21" viewBox="-5 -8 10 16">
      <path d="M0 -7 C 4 -3, 4 3, 0 7 C -4 3, -4 -3, 0 -7 Z" fill="#fffdf9" stroke="#ded5c8" strokeWidth="0.7" />
    </svg>
  )
}

// fixed spread so it looks hand-placed, not random on every render
const PETALS = [
  { left: 18, dur: 12, delay: -2, sway: 4.2, flower: true },
  { left: 62, dur: 14, delay: -7, sway: 5 },
  { left: 92, dur: 11, delay: -4.5, sway: 3.6 },
  { left: 40, dur: 13, delay: -10, sway: 4.6 },
  { left: 76, dur: 12.5, delay: -0.5, sway: 4, flower: true },
  { left: 8, dur: 15, delay: -12, sway: 5.4 },
  { left: 104, dur: 13.5, delay: -9, sway: 4.4 },
]

function Sprig() {
  return (
    <svg viewBox="0 0 128 54" className="block w-full" fill="none">
      <path d="M6 10 C 40 4, 80 6, 122 18" stroke="#7f8a70" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M40 7 C 44 14, 52 16, 58 14" stroke="#7f8a70" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M86 9 C 86 18, 92 22, 98 22" stroke="#7f8a70" strokeWidth="1.1" strokeLinecap="round" />
      {[
        [24, 14],
        [58, 18],
        [98, 26],
      ].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5" rx="2.8" ry="5" transform={`rotate(${a})`} fill="#fffdf9" stroke="#ded5c8" strokeWidth="0.8" />
          ))}
          <circle r="2" fill="#f6ddae" />
        </g>
      ))}
    </svg>
  )
}

export function GutterPetals({ height = 440, className = '' }) {
  const [ref, inView] = useInView()
  const still = prefersReducedMotion()

  return (
    <div ref={ref} aria-hidden="true" className={`sticky top-24 mx-auto w-full max-w-[128px] ${inView ? '' : 'dp-paused'} ${className}`}>
      <Sprig />
      <div className="relative overflow-hidden" style={{ height }}>
        {still
          ? PETALS.slice(0, 4).map((p, i) => (
              <div key={i} className="absolute" style={{ left: p.left, top: 40 + i * 90 }}>
                <Petal flower={p.flower} />
              </div>
            ))
          : PETALS.map((p, i) => (
              <div
                key={i}
                className="dp-petal-fall absolute top-0"
                style={{ left: p.left, '--dur': `${p.dur}s`, '--fall': `${height + 30}px`, animationDelay: `${p.delay}s` }}
              >
                <div className="dp-petal-sway" style={{ '--sway': `${p.sway}s`, animationDelay: `${p.delay / 2}s` }}>
                  <Petal flower={p.flower} />
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}
