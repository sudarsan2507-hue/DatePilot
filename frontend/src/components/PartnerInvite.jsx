import React, { useState } from 'react';

export default function PartnerInvite({ sessionData, onSwitchToPartnerB }) {
  const [copied, setCopied] = useState(false);
  const tokenB = sessionData?.token_b || '';
  const shareUrl = `${window.location.origin}/#invite=${tokenB}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-rose-100 text-center animate-fade-in">
      <div className="w-12 h-12 mx-auto mb-3 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center text-xl">
        💌
      </div>
      <h3 className="text-xl font-serif text-warm-900 mb-1">
        Send Invite to Your Partner
      </h3>
      <p className="text-xs text-warm-500 mb-5 max-w-xs mx-auto">
        Share this private link. She can upload her Instagram export, screenshots, or take a quick quiz to share her taste secretly.
      </p>

      {/* Share Box */}
      <div className="flex items-center gap-2 p-2 bg-warm-50 border border-warm-200 rounded-xl mb-4 text-left">
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="w-full bg-transparent text-xs text-warm-700 px-2 outline-none font-mono truncate"
        />
        <button
          onClick={copyToClipboard}
          className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition-all shrink-0"
        >
          {copied ? 'Copied! ✓' : 'Copy'}
        </button>
      </div>

      <div className="p-3 bg-warm-100/60 rounded-xl text-left border border-warm-200/60 mb-5">
        <h4 className="text-[11px] font-semibold text-warm-800 uppercase tracking-wider mb-1">
          Privacy Guarantee
        </h4>
        <p className="text-[11px] text-warm-600 leading-relaxed">
          Neither partner will see the other’s raw responses. The planner will only reveal your mutual match highlights!
        </p>
      </div>

      {onSwitchToPartnerB && (
        <button
          onClick={onSwitchToPartnerB}
          className="text-xs text-rose-600 hover:text-rose-700 font-medium underline underline-offset-2"
        >
          (Demo Shortcut: Open Partner B View directly)
        </button>
      )}
    </div>
  );
}
