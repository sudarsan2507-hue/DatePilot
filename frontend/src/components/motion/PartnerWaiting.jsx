import useInView from './useInView'
import './motion.css'

// Gap #4: replaces the static clock while the first partner waits.
// You (terracotta) and your partner (sage) slowly circle the same orbit.
// The partner's dot sends out a soft pulse, like "still on their way".
export default function PartnerWaiting({ size = 96, className = '' }) {
  const [ref, inView] = useInView()

  return (
    <div ref={ref} className={`${inView ? '' : 'dp-paused'} ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" width={size} height={size} fill="none" role="img" aria-label="Waiting for your partner">
        {/* faint orbit */}
        <circle cx="48" cy="48" r="30" stroke="#ded5c8" strokeWidth="1.2" strokeDasharray="1.5 5" strokeLinecap="round" />
        {/* centre: where you'll meet */}
        <circle cx="48" cy="48" r="3" fill="#d7bca0" />

        <g className="dp-breathe">
          <g className="dp-orbit">
            {/* you */}
            <circle cx="48" cy="18" r="5.5" fill="#a65d45" />
            {/* partner, with pulse */}
            <circle cx="48" cy="78" r="5.5" fill="#7f8a70" className="dp-halo" />
            <circle cx="48" cy="78" r="5.5" fill="#7f8a70" />
          </g>
        </g>
      </svg>
    </div>
  )
}
