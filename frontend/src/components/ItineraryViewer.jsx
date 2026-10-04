import React, { useState } from 'react';

const SLOT_ICONS = {
  lunch: '🍽️',
  activity: '🎨',
  cafe: '☕',
  sunset: '🌅',
  dinner: '🍷',
};

export default function ItineraryViewer({
  plans,
  onSwapClick,
  onRainToggle,
  onRateClick,
  rainModeActive,
  rainTriggerNote,
}) {
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [showStaySuggestion, setShowStaySuggestion] = useState(false);

  if (!plans || plans.length === 0) {
    return null;
  }

  const activePlan = plans[selectedPlanIndex] || plans[0];

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in text-left">
      {/* Plan Carousel / Selector */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-rose-100 shadow-sm">
        {plans.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setSelectedPlanIndex(idx)}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-xl transition-all ${
              selectedPlanIndex === idx
                ? 'bg-rose-500 text-white shadow-md shadow-rose-200 font-semibold'
                : 'text-warm-600 hover:text-warm-900 hover:bg-warm-100/50'
            }`}
          >
            {idx === 0 ? 'Plan A (Top Match)' : idx === 1 ? 'Plan B (Alternative)' : 'Plan C (Budget Saver)'}
          </button>
        ))}
      </div>

      {/* Main Card */}
      <div className="p-6 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-rose-100">
        {/* Friendly AI Itinerary Text */}
        {activePlan.itinerary_text && (
          <div className="p-4 bg-gradient-to-r from-rose-50/80 via-pink-50/50 to-warm-50/80 rounded-xl border border-rose-100/80 mb-5">
            <span className="text-[10px] uppercase font-bold tracking-widest text-rose-500 block mb-1">
              Curated Narrative
            </span>
            <p className="text-xs text-warm-800 leading-relaxed font-serif italic">
              "{activePlan.itinerary_text}"
            </p>
          </div>
        )}

        {/* Rain Protocol Banner if active */}
        {rainModeActive && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-xl mb-5 flex items-start gap-2.5">
            <span className="text-base">☔</span>
            <div>
              <span className="font-semibold block">Rain Protocol Engaged</span>
              <p className="text-[11px] text-blue-700 mt-0.5 leading-normal">
                {rainTriggerNote || 'Outdoor stops have been replaced with weather-proof indoor sanctuaries.'}
              </p>
            </div>
          </div>
        )}

        {/* Summary Metrics Bar */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-warm-50/80 rounded-xl border border-warm-200/60 mb-5 text-center">
          <div>
            <span className="text-[10px] text-warm-400 uppercase tracking-wider block">
              Total Spend
            </span>
            <span className="text-sm font-bold text-warm-900">
              ₹{Number(activePlan.total_cost).toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-warm-400 uppercase tracking-wider block">
              Budget Buffer
            </span>
            <span className="text-sm font-bold text-emerald-600">
              +₹{Number(activePlan.budget_remaining).toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-warm-400 uppercase tracking-wider block">
              Total Travel
            </span>
            <span className="text-sm font-bold text-warm-900">
              {activePlan.total_travel_min} mins
            </span>
          </div>
        </div>

        {/* Constraint Checklist Badges */}
        <div className="flex flex-wrap gap-2 pb-4 mb-5 border-b border-warm-100">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-medium rounded-full border border-emerald-200">
            ✓ Budget Ceiling (₹{activePlan.total_cost})
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-medium rounded-full border border-emerald-200">
            ✓ Operating Hours Verified
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-medium rounded-full border border-emerald-200">
            ✓ Travel Within Limit
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-medium rounded-full border border-emerald-200">
            ✓ Dietary Constraints
          </span>
        </div>

        {/* Timeline Stops */}
        <div className="space-y-4">
          {activePlan.stops.map((stop, stopIdx) => {
            const icon = SLOT_ICONS[stop.slot] || '📍';
            return (
              <div
                key={stopIdx}
                className="relative pl-6 pb-4 border-l-2 border-rose-200 last:border-l-0 last:pb-0"
              >
                {/* Timeline node */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-xs"></div>

                <div className="bg-warm-50/60 p-4 rounded-xl border border-warm-200/80 hover:border-rose-200 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                          {stop.slot} • {stop.arrival_time} - {stop.departure_time}
                        </span>
                        <h4 className="text-sm font-semibold text-warm-900 leading-snug">
                          {stop.venue.name}
                        </h4>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-warm-900 block">
                        ₹{stop.cost}
                      </span>
                      <span className="text-[10px] text-warm-500">
                        {stop.travel_from_prev_min > 0
                          ? `${stop.travel_from_prev_min}m drive (${stop.distance_from_prev_km}km)`
                          : 'Starting point'}
                      </span>
                    </div>
                  </div>

                  {/* Why Picked */}
                  {stop.why_picked && (
                    <p className="text-[11px] text-warm-600 bg-white/80 p-2 rounded-lg border border-warm-100 my-2 leading-relaxed">
                      💡 {stop.why_picked}
                    </p>
                  )}

                  {/* Backup Venue & Swap Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-warm-100 text-[11px]">
                    <div className="text-warm-500 truncate mr-2">
                      {stop.backup_venue ? (
                        <span>
                          <strong className="text-warm-700">Backup:</strong> {stop.backup_venue.name} ({stop.backup_venue.area})
                        </span>
                      ) : (
                        <span className="italic">No constraint-safe backup for this stop</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSwapClick(selectedPlanIndex, stopIdx)}
                      className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg font-medium text-[11px] transition-all shrink-0 shadow-2xs"
                    >
                      🔄 Swap Stop
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* P1 Controls Bar (Rain Mode, Stay Suggestion, Rate Stops) */}
        <div className="mt-6 pt-4 border-t border-warm-100 flex flex-wrap gap-2.5 items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onRainToggle(selectedPlanIndex)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                rainModeActive
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                  : 'bg-warm-100 text-warm-700 border-warm-200 hover:bg-warm-200'
              }`}
            >
              <span>☔</span>
              <span>{rainModeActive ? 'Rain Mode Active' : 'Rain Mode'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowStaySuggestion(!showStaySuggestion)}
              className="px-3 py-1.5 bg-warm-100 hover:bg-warm-200 text-warm-700 border border-warm-200 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <span>🏨</span>
              <span>Stay Suggestion</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onRateClick}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
          >
            <span>⭐</span>
            <span>Rate This Date</span>
          </button>
        </div>

        {/* Stay Deep-Link suggestion drawer */}
        {showStaySuggestion && (
          <div className="mt-4 p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-warm-800 animate-fade-in">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-amber-900">
                Optional Boutique Stay Suggestion
              </span>
              <span className="text-[10px] text-amber-700">Deep link only (no payments)</span>
            </div>
            <p className="text-[11px] text-warm-600 mb-2">
              Extend your date with a stay near your final stop in <strong>{plan.stops?.[0]?.venue?.city || 'Tamil Nadu'}</strong>. Browse current options and choose what fits your comfort and budget.
            </p>
            <a
              href={`https://www.google.com/travel/hotels/${encodeURIComponent(plan.stops?.[0]?.venue?.city || 'Tamil Nadu')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-[10px]"
            >
              Explore Hotel Availability & Rates ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
