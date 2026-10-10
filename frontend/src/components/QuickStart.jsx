import React, { useState } from 'react';
import { ChevronDown, Coffee, Heart, Palette, Sparkles, Trees, Utensils } from 'lucide-react';
import { CITIES, CITY_AREAS, localISO } from '../lib/places';

const BUDGETS = [500, 1000, 2000, 3500];

const VIBES = [
  { id: 'chill', label: 'Chill', icon: Coffee },
  { id: 'foodie', label: 'Foodie', icon: Utensils },
  { id: 'outdoorsy', label: 'Outdoorsy', icon: Trees },
  { id: 'artsy', label: 'Artsy', icon: Palette },
  { id: 'romantic', label: 'Romantic', icon: Heart },
  { id: 'playful', label: 'Fun / Playful', icon: Sparkles },
];

const MAX_VIBES = 3;
const DEFAULT_START = '16:00';
const CITY_CENTRE = 'City centre';

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/** Today, unless 4 PM has already gone, then tomorrow. */
function defaultDate() {
  const now = new Date();
  if (now.getHours() >= 16) now.setDate(now.getDate() + 1);
  return localISO(now);
}

export default function QuickStart({ onPlan, onPlanTogether }) {
  const todayISO = localISO(new Date());
  const [city, setCity] = useState('Chennai');
  const [budget, setBudget] = useState(2000);
  const [customBudget, setCustomBudget] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [vibes, setVibes] = useState(['romantic']);
  const [date, setDate] = useState(defaultDate);
  const [timeStart, setTimeStart] = useState(DEFAULT_START);
  const [startArea, setStartArea] = useState(CITY_CENTRE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vibeNote, setVibeNote] = useState('');

  const toggleVibe = (id) => {
    if (vibes.includes(id)) {
      setVibes(vibes.filter((v) => v !== id));
      setVibeNote('');
    } else if (vibes.length >= MAX_VIBES) {
      setVibeNote(`Up to ${MAX_VIBES}. Tap one to swap it out.`);
    } else {
      setVibes([...vibes, id]);
      setVibeNote('');
    }
  };

  const effectiveBudget = customOpen ? Number(customBudget) : budget;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!effectiveBudget || effectiveBudget < 200) {
      setError('Enter a budget of at least ₹200.');
      return;
    }
    if (date < todayISO) {
      setError('Pick today or a later date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onPlan({
        city,
        budget_inr: effectiveBudget,
        vibes,
        date,
        time_start: timeStart,
        start_area: startArea,
      });
    } catch (err) {
      setError(err.message || 'Could not plan that date. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dp-screen mx-auto w-full max-w-2xl space-y-4">
      <div className="dp-card p-5 shadow-soft animate-enter md:p-8">
        <div className="mb-7">
          <p className="dp-eyebrow">Your date</p>
          <h2 className="mt-2 text-3xl leading-tight md:text-4xl">Plan a date in seconds</h2>
          <p className="mt-2 text-base text-ink-2">Pick a city, a budget and a feel. We do the rest, inside your budget.</p>
        </div>

        {error && (
          <p role="alert" className="mb-6 rounded-lg border border-accent-soft/40 bg-well px-4 py-3 text-sm text-accent">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-7">
          <fieldset>
            <legend className="dp-label">City</legend>
            <div className="grid grid-cols-3 gap-2">
              {CITIES.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={city === name}
                  onClick={() => {
                    setCity(name);
                    setStartArea(CITY_CENTRE);
                  }}
                  className="dp-chip justify-center px-2"
                >
                  {name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="dp-label">Budget for two</legend>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  aria-pressed={!customOpen && budget === amount}
                  onClick={() => {
                    setBudget(amount);
                    setCustomOpen(false);
                  }}
                  className="dp-chip"
                >
                  {rupees(amount)}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={customOpen}
                onClick={() => setCustomOpen(true)}
                className="dp-chip"
              >
                Custom
              </button>
            </div>
            {customOpen && (
              <div className="mt-3 max-w-[220px]">
                <label htmlFor="dp-custom-budget" className="sr-only">Custom budget in rupees</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true">₹</span>
                  <input
                    id="dp-custom-budget"
                    type="number"
                    inputMode="numeric"
                    min="200"
                    max="100000"
                    step="100"
                    placeholder="1500"
                    value={customBudget}
                    onChange={(e) => setCustomBudget(e.target.value)}
                    className="dp-field pl-8"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </fieldset>

          <fieldset>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <legend className="text-sm text-ink-2">The feel <span className="text-ink-3">· pick up to {MAX_VIBES}</span></legend>
              <span className="text-sm text-ink-3" aria-live="polite">{vibes.length} of {MAX_VIBES}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {VIBES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={vibes.includes(id)}
                  onClick={() => toggleVibe(id)}
                  className="dp-chip"
                >
                  <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            {vibeNote && <p className="mt-2 text-sm text-ink-3" role="status">{vibeNote}</p>}
          </fieldset>

          <details className="group rounded-xl border border-line bg-well/60">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm text-ink-2 [&::-webkit-details-marker]:hidden">
              <span>
                When and where <span className="text-ink-3">· optional</span>
              </span>
              <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-4 px-4 pb-4 pt-1 sm:grid-cols-3">
              <div>
                <label htmlFor="dp-q-date" className="dp-label">Date</label>
                <input id="dp-q-date" type="date" min={todayISO} value={date} onChange={(e) => setDate(e.target.value)} className="dp-field" />
              </div>
              <div>
                <label htmlFor="dp-q-start" className="dp-label">Start at</label>
                <input id="dp-q-start" type="time" min="06:00" max="21:59" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="dp-field" />
              </div>
              <div>
                <label htmlFor="dp-q-area" className="dp-label">Starting from</label>
                <select id="dp-q-area" value={startArea} onChange={(e) => setStartArea(e.target.value)} className="dp-field">
                  <option value={CITY_CENTRE}>{CITY_CENTRE}</option>
                  {CITY_AREAS[city].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          </details>

          <button type="submit" disabled={loading} className="dp-btn-primary w-full min-h-12">
            {loading ? 'Planning…' : 'Plan our date'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-ink-3">
        Want your partner to weigh in?{' '}
        <button type="button" onClick={onPlanTogether} className="dp-btn min-h-11 px-1 text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
          Plan together with your partner
        </button>
      </p>
    </div>
  );
}
