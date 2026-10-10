import React, { useState } from 'react';
import { Coffee, Palette, Sunset, Utensils, Wine } from 'lucide-react';
import { CITY_AREAS } from '../lib/places';

const SLOTS = [
  { id: 'lunch', label: 'Lunch', icon: Utensils },
  { id: 'activity', label: 'Activity', icon: Palette },
  { id: 'cafe', label: 'Café', icon: Coffee },
  { id: 'sunset', label: 'Sunset walk', icon: Sunset },
  { id: 'dinner', label: 'Dinner', icon: Wine },
];

export default function SessionSetup({ onSessionCreated }) {
  // Local dates (toISOString would use UTC and can be a day off in India).
  const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayISO = localISO(new Date());
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return localISO(tomorrow);
  });
  const [timeStart, setTimeStart] = useState('12:00');
  const [timeEnd, setTimeEnd] = useState('22:30');
  const [budgetInr, setBudgetInr] = useState(5000);
  const [city, setCity] = useState('Chennai');
  const [startArea, setStartArea] = useState('Alwarpet');
  const [maxTravelMin, setMaxTravelMin] = useState(35);
  const [surpriseMode, setSurpriseMode] = useState(false);
  const [slotsEnabled, setSlotsEnabled] = useState([
    'lunch',
    'activity',
    'cafe',
    'sunset',
    'dinner',
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleSlot = (slotId) => {
    if (slotsEnabled.includes(slotId)) {
      if (slotsEnabled.length <= 2) {
        setError('Keep at least two stops.');
        return;
      }
      setSlotsEnabled(slotsEnabled.filter((s) => s !== slotId));
    } else {
      setSlotsEnabled([...slotsEnabled, slotId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (date < todayISO) {
      setError('Pick today or a later date.');
      return;
    }
    if (timeEnd <= timeStart) {
      setError('The end time needs to be after the start time.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const payload = {
        date,
        time_start: timeStart,
        time_end: timeEnd,
        budget_inr: Number(budgetInr),
        city,
        start_area: startArea,
        max_travel_minutes: Number(maxTravelMin),
        surprise_mode: surpriseMode,
        slots_enabled: slotsEnabled,
      };

      await onSessionCreated(payload);
    } catch (err) {
      setError(err.message || 'Failed to initialize session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dp-screen dp-card mx-auto max-w-2xl p-5 shadow-soft animate-enter md:p-8">
      <div className="mb-8">
        <p className="dp-eyebrow">Your day</p>
        <h2 className="mt-2 text-3xl leading-tight md:text-4xl">Set up your day</h2>
        <p className="mt-2 text-base text-ink-2">Where, when and how much. We plan everything inside these limits.</p>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-lg border border-accent-soft/40 bg-well px-4 py-3 text-sm text-accent">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-7">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="dp-date" className="dp-label">Date</label>
            <input id="dp-date" type="date" min={todayISO} value={date} onChange={(e) => setDate(e.target.value)} required className="dp-field" />
          </div>
          <div>
            <label htmlFor="dp-city" className="dp-label">City</label>
            <select
              id="dp-city"
              value={city}
              onChange={(e) => {
                const nextCity = e.target.value;
                setCity(nextCity);
                setStartArea(CITY_AREAS[nextCity][0]);
              }}
              className="dp-field"
            >
              {Object.keys(CITY_AREAS).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dp-area" className="dp-label">Starting from</label>
            <select id="dp-area" value={startArea} onChange={(e) => setStartArea(e.target.value)} className="dp-field">
              {CITY_AREAS[city].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="dp-start" className="dp-label">From</label>
            <input id="dp-start" type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="dp-field" />
          </div>
          <div>
            <label htmlFor="dp-end" className="dp-label">Until</label>
            <input id="dp-end" type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="dp-field" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="dp-budget" className="text-sm text-ink-2">Total budget for two</label>
              <span className="font-serif text-xl">₹{Number(budgetInr).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-xs text-ink-3">₹2k</span>
              <input
                id="dp-budget"
                type="range"
                min="2000"
                max="15000"
                step="500"
                value={budgetInr}
                onChange={(e) => setBudgetInr(e.target.value)}
                className="h-11 min-w-0 flex-1 cursor-pointer accent-accent"
              />
              <span className="shrink-0 text-xs text-ink-3">₹15k</span>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="dp-travel" className="text-sm text-ink-2">Longest drive between stops</label>
              <span className="font-serif text-xl">{maxTravelMin} min</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-xs text-ink-3">15m</span>
              <input
                id="dp-travel"
                type="range"
                min="15"
                max="60"
                step="5"
                value={maxTravelMin}
                onChange={(e) => setMaxTravelMin(e.target.value)}
                className="h-11 min-w-0 flex-1 cursor-pointer accent-accent"
              />
              <span className="shrink-0 text-xs text-ink-3">60m</span>
            </div>
          </div>
        </div>

        <fieldset>
          <legend className="dp-label">Stops to include</legend>
          <div className="flex flex-wrap gap-2">
            {SLOTS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleSlot(id)}
                aria-pressed={slotsEnabled.includes(id)}
                className="dp-chip"
              >
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-4 border-t border-line pt-6">
          <div>
            <p id="dp-surprise-label" className="text-base">Surprise mode</p>
            <p className="mt-0.5 text-sm text-ink-3">Hide the venues from your partner until the day.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={surpriseMode}
            aria-labelledby="dp-surprise-label"
            onClick={() => setSurpriseMode(!surpriseMode)}
            className="grid h-11 w-14 shrink-0 place-items-center"
          >
            <span className={`relative block h-6 w-11 rounded-full ${surpriseMode ? 'bg-accent' : 'bg-line'}`}>
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${surpriseMode ? 'translate-x-5' : ''}`}
              />
            </span>
          </button>
        </div>

        <button type="submit" disabled={loading} className="dp-btn-primary w-full min-h-12">
          {loading ? 'Setting up…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
