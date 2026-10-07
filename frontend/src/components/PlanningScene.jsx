import React, { useEffect, useState } from 'react';

const STATUS = [
  'Matching your tastes',
  'Checking opening hours',
  'Timing the sunset walk',
  'Keeping drives short',
  'Adding up the budget',
  'Writing why each place fits',
];

const PINS = [
  { x: 28, y: 96 },
  { x: 112, y: 46 },
  { x: 200, y: 88 },
  { x: 290, y: 38 },
];

/** Shown while the plans are being made (it takes the local model about a minute). */
export default function PlanningScene() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % STATUS.length), 2600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="animate-enter text-center" role="status" aria-live="polite">
      <svg viewBox="0 0 320 130" className="mx-auto w-full max-w-sm" aria-hidden="true">
        <path
          d="M28 96 C 60 96, 80 46, 112 46 S 170 88, 200 88 S 260 38, 290 38"
          fill="none"
          stroke="#ded5c8"
          strokeWidth="2"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
        <path
          className="route-path"
          pathLength="1"
          d="M28 96 C 60 96, 80 46, 112 46 S 170 88, 200 88 S 260 38, 290 38"
          fill="none"
          stroke="#a65d45"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {PINS.map(({ x, y }, i) => (
          <g key={x} className="route-pin" style={{ animationDelay: `${200 + i * 180}ms` }}>
            <circle cx={x} cy={y} r="9" fill="#fffdf9" stroke="#8f4935" strokeWidth="1.5" />
            <circle cx={x} cy={y} r="3.5" fill="#8f4935" />
          </g>
        ))}
      </svg>
      <p className="mt-4 font-serif text-2xl">Planning your day</p>
      <p key={step} className="status-line mt-1 text-sm text-ink-3">{STATUS[step]}…</p>
      <p className="mt-4 text-xs text-ink-3">This runs on a private model on your own computer, so it takes two or three minutes.</p>
    </div>
  );
}
