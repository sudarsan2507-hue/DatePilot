import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { prefersReducedMotion } from './useInView'

// Gap #2: the 208px side margins on the plans page (only from 1280px).
// A dotted route draws itself down the margin as you scroll, with a marker per stop,
// and ends at a small sun (the sunset stop).
// Place it inside a `relative` wrapper around the plans layout, e.g.
//   <PlansRouteMargin stops={plan.stops.length} className="absolute right-full top-0 bottom-0 mr-10" />
//   <PlansRouteMargin stops={plan.stops.length} tone="sage" mirror className="absolute left-full top-0 bottom-0 ml-10" />

const TONES = { accent: '#a65d45', sage: '#7f8a70' }
const WIDTH = 96

export default function PlansRouteMargin({ stops = 4, tone = 'accent', mirror = false, className = '' }) {
  const boxRef = useRef(null)
  const pathRef = useRef(null)
  const [height, setHeight] = useState(0)
  const [progress, setProgress] = useState(0)
  const [length, setLength] = useState(0)
  const uid = useId().replace(/:/g, '')
  const color = TONES[tone] || tone

  // keep height in sync with the plans column
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    setHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  // gentle wave down the middle of the margin
  const d = useMemo(() => {
    if (!height) return ''
    const mid = WIDTH / 2
    const amp = mirror ? -18 : 18
    const step = 260
    let path = `M ${mid} 0`
    let y = 0
    let flip = 1
    while (y < height - 60) {
      const next = Math.min(y + step, height - 60)
      path += ` C ${mid + amp * flip} ${y + step * 0.35}, ${mid + amp * flip} ${next - step * 0.35}, ${mid} ${next}`
      y = next
      flip *= -1
    }
    return path
  }, [height, mirror])

  useEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength())
  }, [d])

  // progress = how much of the column has passed the middle of the screen
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1)
      return
    }
    let frame = 0
    const update = () => {
      frame = 0
      const el = boxRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const seen = window.innerHeight * 0.6 - r.top
      // at the very bottom of the page, finish the route so the sun lights up
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      setProgress(atBottom && r.top < window.innerHeight ? 1 : Math.max(0, Math.min(1, seen / r.height)))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // stop markers spaced along the route
  const markers = useMemo(() => {
    if (!pathRef.current || !length) return []
    return Array.from({ length: stops }, (_, i) => {
      const at = ((i + 0.5) / stops) * (length - 40)
      const p = pathRef.current.getPointAtLength(at)
      return { x: p.x, y: p.y, at: at / length }
    })
  }, [length, stops])

  const end = d ? { x: WIDTH / 2, y: height - 60 } : null
  const reached = progress > 0.97

  return (
    <div ref={boxRef} aria-hidden="true" className={`pointer-events-none hidden min-[1280px]:block ${className}`} style={{ width: WIDTH }}>
      {height > 0 && (
        <svg width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`} fill="none" className="overflow-visible">
          <mask id={`dp-route-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height={height}>
            <path
              d={d}
              stroke="#fff"
              strokeWidth="8"
              strokeDasharray={`${length} ${length}`}
              strokeDashoffset={length * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 250ms ease-out' }}
            />
          </mask>

          {/* faint full route, then the drawn part on top */}
          <path ref={pathRef} d={d} stroke="#ded5c8" strokeWidth="1.5" strokeDasharray="0.1 9" strokeLinecap="round" />
          <path d={d} stroke={color} strokeWidth="2" strokeDasharray="0.1 9" strokeLinecap="round" mask={`url(#dp-route-${uid})`} />

          {markers.map((m, i) => {
            const on = progress >= m.at
            return (
              <circle
                key={i}
                cx={m.x}
                cy={m.y}
                r={on ? 4.5 : 3.5}
                fill={on ? color : '#fffdf9'}
                stroke={on ? color : '#ded5c8'}
                strokeWidth="1.5"
                style={{ transition: 'r 300ms ease-out, fill 300ms ease-out' }}
              />
            )
          })}

          {end && (
            <g transform={`translate(${end.x} ${end.y})`} style={{ opacity: reached ? 1 : 0.35, transition: 'opacity 600ms ease-out' }}>
              {Array.from({ length: 8 }, (_, i) => (
                <line
                  key={i}
                  x1="0"
                  y1="-17"
                  x2="0"
                  y2="-21"
                  stroke="#d7bca0"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  transform={`rotate(${i * 45})`}
                />
              ))}
              <circle r="12" fill="#f6ddae" />
              <path d="M-16 4 H16" stroke="#7f8a70" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
