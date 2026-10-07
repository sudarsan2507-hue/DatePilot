import React, { useState } from 'react';
import { api } from '../lib/api';

export default function PartnerLimits({ token, session, onSaved }) {
  const [budget, setBudget] = useState(session?.budget_inr || 5000);
  const [travel, setTravel] = useState(session?.max_travel_min || 35);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.setPartnerBLimits(token, {
        budget_inr: Number(budget),
        max_travel_minutes: Number(travel),
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not save your private limits');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dp-screen dp-card mx-auto max-w-2xl p-5 shadow-soft animate-enter md:p-8">
      <p className="dp-eyebrow">Your private limits</p>
      <h2 className="mt-2 text-3xl leading-tight md:text-4xl">What feels comfortable?</h2>
      <p className="mt-2 text-base text-ink-2">Your partner never sees these. We always use the stricter of your two limits.</p>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-accent-soft/40 bg-well px-4 py-3 text-sm text-accent">{error}</p>
      )}

      <form onSubmit={submit} className="mt-8 space-y-7">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="dp-b-budget" className="text-sm text-ink-2">Most you would spend in total</label>
            <span className="font-serif text-xl">₹{Number(budget).toLocaleString('en-IN')}</span>
          </div>
          <input id="dp-b-budget" type="range" min="1000" max={Math.max(15000, session?.budget_inr || 0)} step="500" value={budget} onChange={(e) => setBudget(e.target.value)} className="h-11 w-full cursor-pointer accent-accent" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="dp-b-travel" className="text-sm text-ink-2">Longest drive between stops</label>
            <span className="font-serif text-xl">{travel} min</span>
          </div>
          <input id="dp-b-travel" type="range" min="10" max="60" step="5" value={travel} onChange={(e) => setTravel(e.target.value)} className="h-11 w-full cursor-pointer accent-accent" />
        </div>
        <button type="submit" disabled={saving} className="dp-btn-primary w-full min-h-12">
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
