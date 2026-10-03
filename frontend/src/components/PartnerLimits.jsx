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
    <div className="max-w-md mx-auto p-6 bg-white/95 rounded-2xl shadow-xl border border-rose-100 animate-fade-in">
      <div className="text-center mb-5">
        <span className="text-xs uppercase tracking-widest text-rose-500 font-semibold">Partner B • Private limits</span>
        <h2 className="text-2xl font-serif text-warm-900 mt-1">What feels comfortable?</h2>
        <p className="text-xs text-warm-500 mt-1">Your partner will never see these answers. The planner uses the stricter limit.</p>
      </div>
      {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">{error}</div>}
      <form onSubmit={submit} className="space-y-5">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <label className="font-medium text-warm-800">Maximum total budget</label>
            <strong className="text-rose-600">₹{Number(budget).toLocaleString('en-IN')}</strong>
          </div>
          <input type="range" min="1000" max={Math.max(15000, session?.budget_inr || 0)} step="500" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full accent-rose-500" />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <label className="font-medium text-warm-800">Maximum travel between stops</label>
            <strong className="text-warm-700">{travel} mins</strong>
          </div>
          <input type="range" min="10" max="60" step="5" value={travel} onChange={(e) => setTravel(e.target.value)} className="w-full accent-rose-500" />
        </div>
        <button type="submit" disabled={saving} className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-xl disabled:opacity-50">
          {saving ? 'Saving privately…' : 'Save Limits & Add My Taste →'}
        </button>
      </form>
    </div>
  );
}
