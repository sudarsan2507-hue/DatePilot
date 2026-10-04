import React from 'react';

export default function MatchSummary({
  summary,
  onGeneratePlan,
  generating,
  isPartnerA,
  partnerBSubmitted,
  onRefresh,
  refreshing,
  refreshError,
}) {
  if (!summary?.ready) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-rose-100 text-center animate-fade-in">
        <div className="w-12 h-12 mx-auto mb-3 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-xl animate-pulse">
          ⏳
        </div>
        <h3 className="text-xl font-serif text-warm-900 mb-2">
          Waiting for Partner Preferences
        </h3>
        <p className="text-xs text-warm-500 leading-relaxed mb-4">
          {partnerBSubmitted
            ? 'Partner B has submitted! Getting mutual overlap summary ready...'
            : 'Your taste card is confirmed! Once your partner opens her invite and enters her preferences, your mutual match summary will unlock here.'}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="text-xs font-medium text-rose-600 hover:text-rose-800 underline underline-offset-2 disabled:opacity-50"
        >
          {refreshing ? 'Checking…' : 'Check again now'}
        </button>
        {refreshError && (
          <p className="mt-3 text-xs text-red-600" role="alert">
            {refreshError} We’ll keep retrying automatically.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-rose-100 animate-fade-in text-left">
      <div className="text-center mb-5">
        <span className="text-xs uppercase tracking-widest text-rose-500 font-semibold">
          Mutual Taste Harmony
        </span>
        <h2 className="text-2xl font-serif text-warm-900 mt-1">
          What You Two Matched On ✨
        </h2>
        <p className="text-xs text-warm-500 mt-1">
          Calculated anonymously without revealing who chose what.
        </p>
      </div>

      <div className="space-y-4">
        {/* Shared Vibes */}
        <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-100">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block mb-1.5">
            Shared Atmosphere & Aesthetic Overlap
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(summary.shared_vibes || []).map((v) => (
              <span
                key={v}
                className="px-2.5 py-1 bg-white text-rose-900 font-medium text-xs rounded-full border border-rose-200 shadow-2xs"
              >
                💖 {v}
              </span>
            ))}
            {(!summary.shared_vibes || summary.shared_vibes.length === 0) && (
              <span className="text-xs text-warm-500 italic">
                Complementary vibes (planner will balance both)
              </span>
            )}
          </div>
        </div>

        {/* Shared Cuisines */}
        <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-100">
          <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block mb-1.5">
            Mutual Dining Flavors
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(summary.shared_cuisines || []).map((c) => (
              <span
                key={c}
                className="px-2.5 py-1 bg-white text-amber-900 font-medium text-xs rounded-full border border-amber-200 shadow-2xs"
              >
                🍴 {c}
              </span>
            ))}
            {(!summary.shared_cuisines || summary.shared_cuisines.length === 0) && (
              <span className="text-xs text-warm-500 italic">
                Curated Chennai fusion & bistros
              </span>
            )}
          </div>
        </div>

        {/* Budget & Hard Constraints Merged */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3 bg-warm-50 rounded-xl border border-warm-200">
            <span className="text-[10px] text-warm-500 uppercase tracking-wider block">
              Merged Budget Cap
            </span>
            <span className="text-base font-semibold text-warm-900">
              ₹{Number(summary.effective_budget || 5000).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-warm-400 block mt-0.5">
              (strict ceiling for both)
            </span>
          </div>

          <div className="p-3 bg-warm-50 rounded-xl border border-warm-200">
            <span className="text-[10px] text-warm-500 uppercase tracking-wider block">
              Dietary Safeguard
            </span>
            <span className="text-sm font-semibold text-warm-900">
              {summary.dietary_rules?.length ? summary.dietary_rules.join(', ') : 'All Welcome'}
            </span>
            <span className="text-[10px] text-warm-400 block mt-0.5">
              (union enforced)
            </span>
          </div>
        </div>

        {/* Generate Plan Button */}
        {isPartnerA ? (
          <button
            type="button"
            onClick={onGeneratePlan}
            disabled={generating}
            className="w-full mt-4 py-3.5 px-4 bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white font-medium rounded-xl text-sm shadow-lg shadow-rose-200 transition-all text-center disabled:opacity-50"
          >
            {generating ? 'Crafting 3 Tailored Plans with Open AI...' : 'Generate Top 3 Constraint-Checked Plans 🚀'}
          </button>
        ) : (
          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-center text-xs text-warm-600 mt-2">
            Preferences synced! Partner A can now generate your top 3 date plans.
          </div>
        )}
      </div>
    </div>
  );
}
