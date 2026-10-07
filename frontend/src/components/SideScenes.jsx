import React, { useEffect, useState } from 'react';
import { Check, Coffee, Palette, Sunset, Utensils } from 'lucide-react';
import { useParallax } from '../lib/motion';

/* Decorative art for the empty space beside the form on wide screens (xl and up).
   Colours come only from the hero illustration palette. */

function SeaPostcard() {
  return (
    <svg viewBox="0 0 200 230" className="block h-auto w-full" aria-hidden="true">
      <rect width="200" height="230" fill="#d7bca0" />
      <circle cx="132" cy="118" r="38" fill="#f6ddae" />
      <rect y="140" width="200" height="90" fill="#7f8a70" />
      <g fill="#f6ddae" opacity="0.7">
        <rect x="112" y="152" width="40" height="3" rx="1.5" />
        <rect x="120" y="164" width="24" height="3" rx="1.5" />
        <rect x="126" y="176" width="12" height="3" rx="1.5" />
      </g>
      <path d="M0 196 Q25 188 50 196 T100 196 T150 196 T200 196" fill="none" stroke="#f6ddae" strokeOpacity="0.35" strokeWidth="2" />
      <path d="M40 62 l7 6 l7 -6 M62 48 l5 4 l5 -4" fill="none" stroke="#3d3027" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CafePostcard() {
  return (
    <svg viewBox="0 0 200 230" className="block h-auto w-full" aria-hidden="true">
      <rect width="200" height="230" fill="#f6ddae" />
      <path d="M44 230 V104 a56 56 0 0 1 112 0 V230 Z" fill="#d7bca0" />
      <circle cx="122" cy="98" r="18" fill="#f6ddae" opacity="0.9" />
      <path d="M44 150 H156" stroke="#ab7660" strokeOpacity="0.35" strokeWidth="2" />
      <rect x="20" y="196" width="160" height="6" rx="3" fill="#3d3027" opacity="0.85" />
      <g fill="#ab7660">
        <rect x="64" y="174" width="24" height="22" rx="4" />
        <rect x="112" y="174" width="24" height="22" rx="4" />
      </g>
      <g fill="none" stroke="#ab7660" strokeWidth="1.8" strokeLinecap="round">
        <path className="steam" d="M70 166 q-4 -8 0 -16 q4 -8 0 -16" />
        <path className="steam steam-late" d="M80 166 q-4 -8 0 -16 q4 -8 0 -16" />
        <path className="steam steam-late" d="M118 166 q-4 -8 0 -16 q4 -8 0 -16" />
        <path className="steam" d="M128 166 q-4 -8 0 -16 q4 -8 0 -16" />
      </g>
    </svg>
  );
}

function TemplePostcard() {
  return (
    <svg viewBox="0 0 200 230" className="block h-auto w-full" aria-hidden="true">
      <rect width="200" height="230" fill="#d7bca0" />
      <circle cx="150" cy="70" r="26" fill="#f6ddae" />
      <g fill="#ab7660">
        <rect x="70" y="150" width="60" height="80" />
        <path d="M74 150 L80 128 H120 L126 150 Z" />
        <path d="M82 128 L87 110 H113 L118 128 Z" />
        <path d="M89 110 L93 94 H107 L111 110 Z" />
        <path d="M95 94 L97 82 H103 L105 94 Z" />
      </g>
      <rect x="92" y="190" width="16" height="40" rx="8" fill="#3d3027" opacity="0.8" />
      <rect y="214" width="200" height="16" fill="#7f8a70" />
      <g className="lamp" fill="#f6ddae">
        <circle cx="58" cy="208" r="3" /><circle cx="142" cy="208" r="3" />
      </g>
    </svg>
  );
}

function PotteryPostcard() {
  return (
    <svg viewBox="0 0 200 230" className="block h-auto w-full" aria-hidden="true">
      <rect width="200" height="230" fill="#f6ddae" />
      <rect y="170" width="200" height="60" fill="#d7bca0" />
      <ellipse cx="100" cy="186" rx="62" ry="10" fill="#ab7660" opacity="0.45" />
      <g className="wheel">
        <ellipse cx="100" cy="176" rx="56" ry="9" fill="#3d3027" opacity="0.85" />
        <path d="M60 176 h80" stroke="#f6ddae" strokeOpacity="0.4" strokeWidth="2" />
      </g>
      <path d="M78 170 C70 140, 84 120, 92 108 L108 108 C116 120, 130 140, 122 170 Z" fill="#ab7660" />
      <ellipse cx="100" cy="108" rx="8" ry="3" fill="#7f5847" />
      <path d="M84 140 h32" stroke="#f6ddae" strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  );
}

function TankPostcard() {
  return (
    <svg viewBox="0 0 200 230" className="block h-auto w-full" aria-hidden="true">
      <rect width="200" height="230" fill="#d7bca0" />
      <circle cx="58" cy="76" r="24" fill="#f6ddae" />
      <rect y="120" width="200" height="110" fill="#7f8a70" />
      <g fill="#f6ddae" opacity="0.6" className="ripple">
        <rect x="40" y="150" width="34" height="3" rx="1.5" />
        <rect x="120" y="172" width="44" height="3" rx="1.5" />
        <rect x="64" y="196" width="28" height="3" rx="1.5" />
      </g>
      <g fill="#ab7660">
        <rect x="84" y="96" width="32" height="24" />
        <path d="M80 96 L100 78 L120 96 Z" />
      </g>
      <rect x="20" y="118" width="160" height="4" fill="#3d3027" opacity="0.5" />
    </svg>
  );
}

const ROTATING = [
  { caption: 'Coffee for two', place: 'Alwarpet', Scene: CafePostcard },
  { caption: 'A temple at dusk', place: 'Mylapore', Scene: TemplePostcard },
  { caption: 'Clay on the wheel', place: 'Cholamandal', Scene: PotteryPostcard },
  { caption: 'Still water', place: 'Madurai', Scene: TankPostcard },
];

/** Cross-fades through the scenes every few seconds (paused under reduced motion). */
function RotatingPostcard({ className, drift }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % ROTATING.length), 5000);
    return () => window.clearInterval(id);
  }, []);
  const { caption, place } = ROTATING[index];
  return (
    <Postcard caption={caption} place={place} className={className} drift={drift}>
      <div className="grid">
        {ROTATING.map(({ Scene, caption: c }, i) => (
          <div key={c} className="scene-fade [grid-area:1/1]" style={{ opacity: i === index ? 1 : 0 }}>
            <Scene />
          </div>
        ))}
      </div>
    </Postcard>
  );
}

function Postcard({ children, caption, place, className, drift }) {
  const ref = useParallax(drift);
  return (
    <figure ref={ref} className={`postcard w-full rounded-xl border border-line bg-paper p-3 shadow-soft ${className}`}>
      <div className="overflow-hidden rounded-lg">{children}</div>
      <figcaption className="px-1 pb-1 pt-3">
        <span key={caption} className="block font-serif text-base leading-tight text-ink animate-enter">{caption}</span>
        <span className="mt-0.5 block text-xs tracking-[0.12em] text-ink-3 uppercase">{place}</span>
      </figcaption>
    </figure>
  );
}

export function SideArtLeft() {
  return (
    <div className="pt-4" aria-hidden="true">
      <Postcard caption="Golden hour" place="Besant Nagar" className="side-in !w-[86%] -rotate-2" drift={0.03}>
        <SeaPostcard />
      </Postcard>
      <RotatingPostcard className="side-in side-in-late mt-3 ml-auto !w-[78%] rotate-[3deg]" drift={0.06} />
    </div>
  );
}

const SAMPLE_DAY = [
  { time: '12:30', icon: Utensils, title: 'Lunch', place: 'Banana-leaf meals' },
  { time: '15:00', icon: Palette, title: 'Gallery', place: 'Cholamandal' },
  { time: '16:30', icon: Coffee, title: 'Café', place: 'Garden courtyard' },
  { time: '17:45', icon: Sunset, title: 'Sunset walk', place: "Elliot's Beach" },
];

export function SideArtRight() {
  const ref = useParallax(0.04);
  return (
    <div ref={ref} className="pt-4" aria-hidden="true">
      <div className="side-in rounded-xl border border-line bg-paper p-5 shadow-soft">
        <p className="dp-eyebrow">A day like this</p>
        <ol className="relative mt-4 space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
          {SAMPLE_DAY.map(({ time, icon: Icon, title, place }, i) => (
            <li key={time} className="side-step relative flex gap-3 pl-6" style={{ animationDelay: `${300 + i * 120}ms` }}>
              <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-paper bg-accent-soft" />
              <div className="min-w-0">
                <p className="font-serif text-base leading-none text-ink">{time}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                  <Icon size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  {title}
                </p>
                <p className="text-xs text-ink-3">{place}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="side-step mt-5 flex items-center gap-2 border-t border-line pt-4 text-sm text-ink-2" style={{ animationDelay: '820ms' }}>
          <Check size={16} strokeWidth={1.5} className="text-sage" />
          ₹4,700 · within budget
        </p>
      </div>
    </div>
  );
}
