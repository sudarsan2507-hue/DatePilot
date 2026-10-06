import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

/**
 * Modal shell: full-width bottom sheet on phones, centred dialog from md (768px).
 * Closes on Escape and backdrop tap, and locks page scroll while open.
 */
export default function Sheet({ eyebrow, title, onClose, children }) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-ink/40 animate-[enter_200ms_ease-out_both]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-xl border border-line bg-paper shadow-soft animate-enter md:max-w-md md:rounded-xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-3 md:px-6 md:pt-5">
          <div>
            {eyebrow && <p className="dp-eyebrow">{eyebrow}</p>}
            <h2 id={titleId} className="mt-1 text-2xl leading-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-well hover:text-ink"
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
