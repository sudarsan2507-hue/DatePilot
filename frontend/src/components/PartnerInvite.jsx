import React, { useState } from 'react';
import { Check, Copy, Lock } from 'lucide-react';

export default function PartnerInvite({ tokenB, onSwitchToPartnerB }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/#invite=${tokenB}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="dp-card mx-auto max-w-2xl p-5 shadow-soft animate-enter md:p-8">
      <p className="dp-eyebrow">Invite</p>
      <h2 className="mt-2 text-3xl leading-tight md:text-4xl">Now your partner&rsquo;s turn</h2>
      <p className="mt-2 text-base text-ink-2">
        Send this private link. They answer the same questions on their own phone.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="dp-share" className="sr-only">Invite link</label>
        <input id="dp-share" type="text" readOnly value={shareUrl} onFocus={(e) => e.target.select()} className="dp-field min-w-0 flex-1 font-mono text-sm md:text-sm" />
        <button type="button" onClick={copyToClipboard} className="dp-btn-primary shrink-0">
          {copied ? <Check size={18} strokeWidth={1.5} aria-hidden="true" /> : <Copy size={18} strokeWidth={1.5} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <p className="mt-6 flex gap-3 border-t border-line pt-6 text-sm leading-relaxed text-ink-2">
        <Lock size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
        Neither of you sees the other&rsquo;s answers. You only see what you have in common.
      </p>

      {onSwitchToPartnerB && (
        <button type="button" onClick={onSwitchToPartnerB} className="dp-btn mt-4 px-0 text-sm text-ink-3 underline underline-offset-4 hover:text-ink">
          No second phone handy? Try your partner's side here
        </button>
      )}
    </div>
  );
}
