import { useEffect, useRef, useState } from 'react'

// true while the element is on screen; used to pause loops we can't see
export default function useInView(options = { rootMargin: '80px' }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), options)
    io.observe(el)
    return () => io.disconnect()
    // options are fixed per component, no need to re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [ref, inView]
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
