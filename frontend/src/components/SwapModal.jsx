import React, { useState } from 'react';
import { ArrowDown, Check, RefreshCw, X } from 'lucide-react';
import { api } from '../lib/api';
import Sheet from './Sheet';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const signed = (n, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${unit}${Math.abs(n).toLocaleString('en-IN')}`;

function StopRow({ label, stop }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="min-w-0 break-words font-serif text-lg leading-snug">{stop.venue.name}</p>
        <p className="shrink-0 font-serif text-lg">{stop.cost > 0 ? inr(stop.cost) : 'Free'}</p>
      </div>
      <p className="mt-0.5 text-sm text-ink-3">
        {stop.venue.area} · {stop.arrival_time}–{stop.departure_time}
      </p>
    </div>
  );
}

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
      setError(err.message || 'No other place fits this slot.');
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
      setError(err.message || 'Could not apply this swap.');
    } finally {
      setLoading(false);
    }
  };

  const costChange = diff ? diff.new_total - diff.old_total : 0;
  const sc = diff?.schedule_change;

  return (
    <Sheet eyebrow="Swap a stop" title={`Replace ${stop.venue.name}?`} onClose={onClose}>
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-accent-soft/40 bg-well px-4 py-3 text-sm text-accent">
          {error}
        </p>
      )}

      <StopRow label="Now" stop={stop} />

      {diff ? (
        <div className="animate-enter">
          <ArrowDown size={18} strokeWidth={1.5} className="mx-auto my-2 text-ink-3" aria-hidden="true" />
          <StopRow label="Instead" stop={diff.new_stop} />

          <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-3">Day total</dt>
              <dd className="text-right text-ink">
                {inr(diff.old_total)} → {inr(diff.new_total)}
                <span className="ml-2 text-ink-3">({signed(costChange, '₹')})</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-3">Driving</dt>
              <dd className="text-ink">{signed(diff.travel_diff_min)} min</dd>
            </div>
            {sc && (
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-3">Time</dt>
                <dd className="text-right text-ink">
                  {sc.old_arrival}–{sc.old_departure} → {sc.new_arrival}–{sc.new_departure}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-3">Budget</dt>
              <dd className={`flex items-center gap-1.5 ${diff.budget_ok ? 'text-ink' : 'text-accent'}`}>
                {diff.budget_ok
                  ? <Check size={16} strokeWidth={1.5} className="text-sage" aria-hidden="true" />
                  : <X size={16} strokeWidth={1.5} aria-hidden="true" />}
                {diff.budget_ok ? 'Still within budget' : 'Goes over budget'}
              </dd>
            </div>
          </dl>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={onClose} className="dp-btn-quiet">Keep current</button>
            <button type="button" onClick={handleApply} disabled={loading} className="dp-btn-primary">
              {loading ? 'Saving…' : 'Use this instead'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-sm leading-relaxed text-ink-2">
            Every other stop stays as it is. We find the next best place for this slot and recheck times and budget.
          </p>
          <button type="button" onClick={executeSwap} disabled={loading} className="dp-btn-primary mt-5 w-full">
            <RefreshCw size={16} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? 'Looking…' : 'Find another place'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
