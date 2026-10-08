import React, { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Full-screen intro that plays over the page (the app keeps loading underneath).
 *
 * Media, first one that exists wins:
 *   /intro/intro.webm (+ /intro/intro.mp4 fallback)  →  video
 *   /intro/intro.json                                →  Lottie animation
 *   none                                             →  logo placeholder
 * Put the files in frontend/public/intro/.
 *
 * Skip: the Skip button, a click/tap anywhere, or Esc. Video and Lottie get MAX_MS from the
 * moment they start playing; if they never start, SAFETY_MS from mount ends it anyway.
 * Square video: cover on portrait screens; on landscape the whole frame is shown, over a
 * blurred copy of itself, so the headline at the top isn't cropped.
 * Reduced motion: a still logo for 1 second, no video or animation.
 */

const MAX_MS = 4500;
const SAFETY_MS = 5500;
const PLACEHOLDER_MS = 2600;
const STILL_MS = 1000;
const FADE_MS = 450;

let mediaProbe = null;

/** Finds which intro files exist. Vite and static hosts answer unknown paths with
 *  index.html, so the content type is checked, not just the status code. */
function probeMedia() {
  if (!mediaProbe) {
    const has = async (path, type) => {
      try {
        const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
        return res.ok && (res.headers.get('content-type') || '').includes(type);
      } catch {
        return false;
      }
    };
    mediaProbe = Promise.all([
      has('/intro/intro.webm', 'video'),
      has('/intro/intro.mp4', 'video'),
      has('/intro/intro.json', 'json'),
    ]).then(([webm, mp4, lottie]) => {
      const canWebm = webm && document.createElement('video').canPlayType('video/webm') !== '';
      if (canWebm) return { kind: 'video', src: '/intro/intro.webm' };
      if (mp4) return { kind: 'video', src: '/intro/intro.mp4' };
      if (lottie) return { kind: 'lottie' };
      return { kind: 'placeholder' };
    });
  }
  return mediaProbe;
}

function LogoMark({ animated }) {
  return (
    <div className={`flex flex-col items-center text-center ${animated ? 'intro-logo' : ''}`}>
      <span className="brand-mark !h-20 !w-20 !text-5xl" aria-hidden="true">d.</span>
      <p className="mt-5 font-serif text-4xl tracking-tight text-ink md:text-5xl">DatePilot</p>
      <p className={`mt-2 text-xs uppercase tracking-[0.2em] text-ink-3 ${animated ? 'intro-tagline' : ''}`}>
        A little more together
      </p>
    </div>
  );
}

function LottiePlayer({ onStart, onEnd, onError }) {
  const ref = useRef(null);
  useEffect(() => {
    let anim;
    let cancelled = false;
    import('lottie-web/build/player/lottie_light')
      .then(({ default: lottie }) => {
        if (cancelled || !ref.current) return;
        anim = lottie.loadAnimation({
          container: ref.current,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          path: '/intro/intro.json',
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });
        anim.addEventListener('DOMLoaded', onStart);
        anim.addEventListener('complete', onEnd);
        anim.addEventListener('data_failed', onError);
      })
      .catch(onError);
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [onStart, onEnd, onError]);
  return <div ref={ref} className="h-[min(70vh,70vw)] w-[min(70vh,70vw)]" aria-hidden="true" />;
}

export default function IntroOverlay({ onDone }) {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [media, setMedia] = useState(reducedMotion ? { kind: 'still' } : null);
  const [leaving, setLeaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const doneRef = useRef(false);
  const skipRef = useRef(null);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (reducedMotion) {
      onDone();
      return;
    }
    setLeaving(true);
    window.setTimeout(onDone, FADE_MS);
  }, [onDone, reducedMotion]);

  const fallBack = useCallback(() => setMedia({ kind: 'placeholder' }), []);
  const started = useCallback(() => setPlaying(true), []);

  // Pick the media (skipped under reduced motion).
  useEffect(() => {
    if (reducedMotion) return undefined;
    let cancelled = false;
    probeMedia().then((found) => { if (!cancelled) setMedia(found); });
    return () => { cancelled = true; };
  }, [reducedMotion]);

  // Safety cap from mount, plus the shorter placeholder / still-logo timings.
  useEffect(() => {
    const cap = window.setTimeout(finish, reducedMotion ? STILL_MS : SAFETY_MS);
    return () => window.clearTimeout(cap);
  }, [finish, reducedMotion]);

  // Video / Lottie: MAX_MS from the first frame, so a slow start doesn't cut the ending.
  useEffect(() => {
    if (!playing) return undefined;
    const cap = window.setTimeout(finish, MAX_MS);
    return () => window.clearTimeout(cap);
  }, [playing, finish]);

  useEffect(() => {
    if (media?.kind !== 'placeholder') return undefined;
    const id = window.setTimeout(finish, PLACEHOLDER_MS);
    return () => window.clearTimeout(id);
  }, [media, finish]);

  // Esc skips; focus the Skip button for keyboard users.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    skipRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  return (
    <div
      className={`fixed inset-0 z-[70] flex cursor-pointer overflow-hidden items-center justify-center bg-cream transition-opacity ease-out ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      onClick={finish}
      role="dialog"
      aria-label="DatePilot intro"
    >
      {media?.kind === 'video' && (
        <>
          {/* landscape only: soft fill for the bands beside the square video */}
          <video
            className="absolute inset-0 hidden h-full w-full scale-110 object-cover blur-2xl landscape:block"
            src={media.src}
            autoPlay
            muted
            playsInline
            aria-hidden="true"
          />
          <video
            className="relative h-full w-full object-cover landscape:object-contain"
            src={media.src}
            autoPlay
            muted
            playsInline
            preload="auto"
            onPlaying={started}
            onEnded={finish}
            onError={fallBack}
            aria-hidden="true"
          />
        </>
      )}
      {media?.kind === 'lottie' && <LottiePlayer onStart={started} onEnd={finish} onError={fallBack} />}
      {media?.kind === 'placeholder' && <LogoMark animated />}
      {media?.kind === 'still' && <LogoMark animated={false} />}

      <button
        ref={skipRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); finish(); }}
        className="dp-btn-quiet absolute right-4 top-4 text-sm md:right-6 md:top-6"
      >
        Skip
      </button>
    </div>
  );
}
