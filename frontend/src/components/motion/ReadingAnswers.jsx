import { useEffect, useState } from 'react'
import useInView, { prefersReducedMotion } from './useInView'
import './motion.css'

// Gap #5: shown over the taste card while the local model reads the answers (10-20 s).
// Put it inside a `relative` parent:  {loading && <ReadingAnswers chips={picked} />}

const STATUS_LINES = [
  'Reading your answers',
  'Noticing what you enjoy',
  'Read privately by a local model',
  'Building your taste card',
  'Almost there',
]

const FALLBACK_CHIPS = ['Café & Bakery', 'Quiet & Intimate', 'Sunset Promenade', 'Continental']

export default function ReadingAnswers({ chips = [], lines = STATUS_LINES, className = '' }) {
  const [ref, inView] = useInView()
  const [lineIdx, setLineIdx] = useState(0)

  // step through the status lines, then stay on the last one
  useEffect(() => {
    if (prefersReducedMotion()) return
    const timer = setInterval(() => {
      setLineIdx((i) => (i < lines.length - 1 ? i + 1 : i))
    }, 3400)
    return () => clearInterval(timer)
  }, [lines.length])

  const shown = (chips.length ? chips : FALLBACK_CHIPS).slice(0, 6)

  return (
    <div
      ref={ref}
      className={`absolute inset-0 z-20 rounded-xl bg-paper/90 backdrop-blur-[2px] ${inView ? '' : 'dp-paused'} ${className}`}
    >
      <div className="sticky top-[22vh] flex justify-center px-4 py-10">
        <div className="dp-card-in w-full max-w-[300px] rounded-xl border border-line bg-paper p-5 shadow-[0_8px_30px_-12px_rgba(56,42,34,0.25)]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-3">Your taste card</p>

          {/* chips lift into the card one by one */}
          <div className="mt-4 flex min-h-[76px] flex-wrap content-start gap-2">
            {shown.map((label, i) => (
              <span
                key={label}
                className="dp-chip-lift rounded-lg border border-ink/60 bg-well px-2.5 py-1 text-[13px] text-ink"
                style={{ animationDelay: `${i * 0.45}s` }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* a few lines "writing" themselves */}
          <div className="mt-4 space-y-2" aria-hidden="true">
            {[92, 74, 54].map((w, i) => (
              <div key={w} className="h-1.5 rounded-full bg-cream" style={{ width: `${w}%` }}>
                <div
                  className="dp-line h-full rounded-full bg-[#d7bca0]"
                  style={{ animationDelay: `${0.9 + i * 0.35}s` }}
                />
              </div>
            ))}
          </div>

          {/* thin indeterminate bar */}
          <div className="mt-5 h-[2px] overflow-hidden rounded-full bg-line/60" aria-hidden="true">
            <div className="dp-progress-bar h-full w-2/5 rounded-full bg-accent-soft" />
          </div>

          <p role="status" aria-live="polite" className="mt-3 text-center text-sm text-ink-2">
            <span key={lineIdx} className="dp-status inline-block">
              {lines[lineIdx]}…
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
