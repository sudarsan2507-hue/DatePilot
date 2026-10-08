import { useEffect, useId, useState } from 'react'
import useInView from './useInView'
import './motion.css'

// Gap #3: small motif for the blank band under short steps (limits, invite, match).
// Plays once when it first scrolls into view: two dots drift together, a tiny heart appears.
export default function TwoDotsMeet({ className = '' }) {
  const [ref, inView] = useInView({ rootMargin: '0px' })
  const [started, setStarted] = useState(false)
  const uid = useId().replace(/:/g, '')

  // start only once, the first time it's actually visible
  useEffect(() => {
    if (inView && !started) setStarted(true)
  }, [inView, started])

  const left = 'M8 44 Q 30 44, 50 38'
  const right = 'M112 44 Q 90 44, 70 38'

  return (
    <div ref={ref} aria-hidden="true" className={`mx-auto w-[120px] ${className}`}>
      <svg viewBox="0 0 120 60" width="120" height="60" fill="none" className={started ? '' : 'invisible'}>
        {started && (
          <>
            {/* solid strokes in a mask "draw" the dotted trails */}
            <mask id={`dp-trail-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="60">
              <path d={left} pathLength="1" className="dp-trail" stroke="#fff" strokeWidth="6" />
              <path d={right} pathLength="1" className="dp-trail" stroke="#fff" strokeWidth="6" />
            </mask>
            <g mask={`url(#dp-trail-${uid})`} strokeWidth="1.6" strokeDasharray="0.1 5" strokeLinecap="round">
              <path d={left} stroke="#a65d45" />
              <path d={right} stroke="#7f8a70" />
            </g>

            <g className="dp-meet-l">
              <circle cx="54" cy="38" r="5" fill="#a65d45" />
            </g>
            <g className="dp-meet-r">
              <circle cx="66" cy="38" r="5" fill="#7f8a70" />
            </g>

            {/* outer g places it, inner path animates */}
            <g transform="translate(30 4) scale(0.5)">
              <path
                className="dp-heart"
                d="M60 26 C 56 22, 50 23, 50 18 C 50 14, 55 12, 60 17 C 65 12, 70 14, 70 18 C 70 23, 64 22, 60 26 Z"
                fill="#8f4935"
                fillOpacity="0.9"
              />
            </g>
          </>
        )}
      </svg>
    </div>
  )
}
