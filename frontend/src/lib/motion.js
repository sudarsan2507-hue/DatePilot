import { useEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Fades `.reveal` children of the returned ref in once they scroll into view.
 * Re-scans when `deps` change so newly rendered screens are picked up.
 */
export function useReveal(deps = []) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const items = [...root.querySelectorAll('.reveal:not(.is-visible)')];
    if (reducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }),
      { threshold: 0.15 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Scroll-linked drift for decorative side art. Moves at most `max` px.
 * Laptop pointers only; static under reduced motion.
 */
export function useParallax(factor = 0.04, max = 24) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    if (!el || !finePointer || reducedMotion()) return undefined;

    let frame = 0;
    const update = () => {
      const y = Math.max(-max, Math.min(max, window.scrollY * factor));
      el.style.translate = `0 ${(-y).toFixed(1)}px`;
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [factor, max]);

  return ref;
}

/** Counts up to `value` with an ease-out over `duration` ms (instant under reduced motion). */
export function useCountUp(value, duration = 700) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(target);
  const from = useRef(0);

  useEffect(() => {
    if (reducedMotion()) {
      setShown(target);
      return undefined;
    }
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(begin + (target - begin) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown;
}

/** Soft cursor-follow tilt (max ±4deg). Laptop pointers only. */
export function useTilt(max = 4, deps = []) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    if (!el || !finePointer || reducedMotion()) return undefined;

    let frame = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      el.style.transform = '';
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, ...deps]);

  return ref;
}
