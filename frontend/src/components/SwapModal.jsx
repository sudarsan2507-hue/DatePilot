import React, { useState } from 'react';
import { api } from '../lib/api';

export default function SwapModal({
  token,
  planIndex,
  stopIndex,
  stop,
  onSwapApplied,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState('');

  const executeSwap = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.swapStop(token, planIndex, stopIndex);
      setDiff(result);
    } catch (err) {
      setError(err.message || 'No alternative venues found for this slot');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    setError('');
    try {
      const applied = await api.swapStop(token, planIndex, stopIndex, true);
      onSwapApplied(planIndex, applied.updated_plan);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not apply this swap');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100 text-left">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-warm-100">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500 block">
              Slot Re-solver
            </span>
            <h3 className="text-lg font-serif text-warm-900">
              Swap Stop: {stop.slot}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-warm-400 hover:text-warm-700 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Current Stop details */}
        <div className="p-3 bg-warm-50 rounded-xl border border-warm-200 mb-4 text-xs">
          <span className="text-warm-400 uppercase text-[10px] block font-semibold mb-0.5">
            Currently Locked Stop
          </span>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-warm-900">{stop.venue.name}</span>
            <span className="text-warm-700">₹{stop.cost}</span>
          </div>
          <span className="text-[11px] text-warm-500">
            {stop.venue.area} • {stop.arrival_time} - {stop.departure_time}
          </span>
        </div>

        {/* Diff preview once computed */}
        {diff ? (
          <div className="space-y-3 mb-5 animate-fade-in text-xs">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-emerald-700 font-bold uppercase text-[10px] block mb-0.5">
                New Recommended Stop
              </span>
              <div className="flex justify-between items-center font-semibold text-emerald-950">
                <span>{diff.new_stop.venue.name}</span>
                <span>₹{diff.new_stop.cost}</span>
              </div>
              <span className="text-[11px] text-emerald-800">
                {diff.new_stop.venue.area} • {diff.new_stop.arrival_time} - {diff.new_stop.departure_time}
              </span>
            </div>

            {/* Differential Comparison */}
            <div className="p-3 bg-warm-50 rounded-xl border border-warm-200/80 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-warm-500">Total Date Spend:</span>
                <span className="font-semibold text-warm-900">
                  ₹{diff.old_total} → ₹{diff.new_total} (
                  {diff.new_total > diff.old_total ? `+₹${diff.new_total - diff.old_total}` : `-₹${diff.old_total - diff.new_total}`}
                  )
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-warm-500">Travel Time Impact:</span>
                <span className="font-semibold text-warm-900">
                  {diff.travel_diff_min >= 0 ? `+${diff.travel_diff_min} mins` : `${diff.travel_diff_min} mins`}
                </span>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-warm-200">
                <span className="text-warm-500">Budget Constraint:</span>
                <span
                  className={`font-semibold ${
                    diff.budget_ok ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {diff.budget_ok ? '✓ Within Budget' : '✗ Exceeds Budget'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-500">Schedule:</span>
                <span className="font-semibold text-warm-900">
                  {diff.schedule_change.old_arrival}–{diff.schedule_change.old_departure} → {diff.schedule_change.new_arrival}–{diff.schedule_change.new_departure}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApply}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl text-xs transition-all shadow-md shadow-rose-200"
            >
              {loading ? 'Applying…' : 'Apply Swap & Save Plan ✓'}
            </button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-warm-500 mb-4 leading-relaxed">
              Planner keeps every other venue locked, then rechecks and shifts downstream times when needed.
            </p>
            <button
              type="button"
              onClick={executeSwap}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl text-xs transition-all shadow-md shadow-rose-200 disabled:opacity-50"
            >
              {loading ? 'Re-solving slot...' : 'Find Next Best Alternative 🔄'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
