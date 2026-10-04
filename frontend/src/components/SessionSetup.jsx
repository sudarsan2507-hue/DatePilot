import React, { useState } from 'react';

const CITY_AREAS = {
  Chennai: [
    'Alwarpet', 'Adyar', 'Besant Nagar', 'Mylapore', 'Nungambakkam',
    'T. Nagar', 'Anna Nagar', 'Egmore', 'Guindy', 'Velachery',
    'ECR / Neelankarai', 'Muttukadu / Kovalam', 'Marina Beach',
  ],
  Coimbatore: [
    'R.S. Puram', 'Gandhipuram', 'Peelamedu', 'Race Course',
    'Saibaba Colony', 'Ukkadam',
  ],
  Madurai: [
    'Anna Nagar', 'KK Nagar', 'Goripalayam', 'Mattuthavani',
    'Town Hall Road', 'Vandiyur',
  ],
};

const SLOTS = [
  { id: 'lunch', label: 'Lunch / Brunch', icon: '🍽️' },
  { id: 'activity', label: 'Activity / Craft', icon: '🎨' },
  { id: 'cafe', label: 'Café / Dessert', icon: '☕' },
  { id: 'sunset', label: 'Sunset / Walk', icon: '🌅' },
  { id: 'dinner', label: 'Dinner / Candlelight', icon: '🍷' },
];

export default function SessionSetup({ onSessionCreated }) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
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
        setError('Please keep at least 2 date stops enabled.');
        return;
      }
      setSlotsEnabled(slotsEnabled.filter((s) => s !== slotId));
    } else {
      setSlotsEnabled([...slotsEnabled, slotId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    <div className="max-w-xl mx-auto p-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-rose-100 animate-fade-in">
      <div className="text-center mb-6">
        <span className="text-xs uppercase tracking-widest text-rose-500 font-semibold">
          THE FIRST LITTLE STEP
        </span>
        <h2 className="text-2xl font-serif text-warm-900 mt-1">
          Make room for a lovely day.
        </h2>
        <p className="text-xs text-warm-500 mt-1 max-w-sm mx-auto">
          Pick your city, your time, and your budget. We’ll take care of the possibilities.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date, City & Starting Area */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-warm-800 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-warm-50 border border-warm-200 rounded-lg focus:ring-2 focus:ring-rose-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-800 mb-1">
              City
            </label>
            <select
              value={city}
              onChange={(e) => {
                const nextCity = e.target.value;
                setCity(nextCity);
                setStartArea(CITY_AREAS[nextCity][0]);
              }}
              className="w-full px-3 py-2 text-sm bg-warm-50 border border-warm-200 rounded-lg focus:ring-2 focus:ring-rose-400 focus:outline-none"
            >
              {Object.keys(CITY_AREAS).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-800 mb-1">
              Starting Place
            </label>
            <select
              value={startArea}
              onChange={(e) => setStartArea(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-warm-50 border border-warm-200 rounded-lg focus:ring-2 focus:ring-rose-400 focus:outline-none"
            >
              {CITY_AREAS[city].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Time Window */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-warm-800 mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-warm-50 border border-warm-200 rounded-lg focus:ring-2 focus:ring-rose-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-800 mb-1">
              End Time
            </label>
            <input
              type="time"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-warm-50 border border-warm-200 rounded-lg focus:ring-2 focus:ring-rose-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Total Budget */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-warm-800">
              Total Combined Budget
            </label>
            <span className="text-sm font-semibold text-rose-600">
              ₹{Number(budgetInr).toLocaleString('en-IN')}
            </span>
          </div>
          <input
            type="range"
            min="2000"
            max="15000"
            step="500"
            value={budgetInr}
            onChange={(e) => setBudgetInr(e.target.value)}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-warm-400 mt-0.5">
            <span>₹2,000 (Cozy)</span>
            <span>₹6,000 (Boutique)</span>
            <span>₹15,000 (Luxury)</span>
          </div>
        </div>

        {/* Max Travel Between Stops */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-warm-800">
              Max Travel Between Stops
            </label>
            <span className="text-xs font-medium text-warm-600">
              {maxTravelMin} mins
            </span>
          </div>
          <input
            type="range"
            min="15"
            max="60"
            step="5"
            value={maxTravelMin}
            onChange={(e) => setMaxTravelMin(e.target.value)}
            className="w-full accent-rose-500 cursor-pointer"
          />
        </div>

        {/* Enabled Slots Toggle */}
        <div>
          <label className="block text-xs font-medium text-warm-800 mb-1.5">
            Enabled Date Stops
          </label>
          <div className="flex flex-wrap gap-2">
            {SLOTS.map((s) => {
              const active = slotsEnabled.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSlot(s.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-rose-500 text-white shadow-sm shadow-rose-200'
                      : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Surprise Mode Toggle */}
        <div className="flex items-center justify-between p-3 bg-rose-50/60 rounded-xl border border-rose-100">
          <div>
            <h4 className="text-xs font-semibold text-warm-900">
              Surprise Mode ✨
            </h4>
            <p className="text-[11px] text-warm-500">
              Keep venues confidential from her until the date starts!
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={surpriseMode}
              onChange={(e) => setSurpriseMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-warm-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-medium rounded-xl shadow-md shadow-rose-200 transition-all text-sm disabled:opacity-50"
        >
          {loading ? 'Making space for your day…' : 'Let’s plan something lovely ↗'}
        </button>
      </form>
    </div>
  );
}
