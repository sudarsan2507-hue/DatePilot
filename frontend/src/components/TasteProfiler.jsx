import React, { useState } from 'react';
import { api } from '../lib/api';

const SAMPLE_CUISINES = [
  'South Indian',
  'Continental',
  'Café & Bakery',
  'Italian',
  'Mediterranean',
  'North Indian / Tandoor',
  'Desserts & Gelato',
  'Coastal Seafood',
];

const SAMPLE_VIBES = [
  'Quiet & Intimate',
  'Romantic Garden',
  'Vintage / Pastel',
  'Beachside & Breezy',
  'Artsy & Bohemian',
  'Candlelight',
  'Heritage & Cultural',
];

const SAMPLE_ACTIVITIES = [
  'Pottery Workshop',
  'Board Game Café',
  'Sunset Promenade',
  'Art Gallery Walk',
  'Historic Museum',
  'Backwater Boating',
];

export default function TasteProfiler({ sessionToken, partnerLabel, onTasteExtracted }) {
  const [activeTab, setActiveTab] = useState('quiz'); // 'upload' | 'screenshot' | 'quiz'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Quiz state
  const [selectedCuisines, setSelectedCuisines] = useState(['Continental', 'Café & Bakery']);
  const [selectedVibes, setSelectedVibes] = useState(['Romantic Garden', 'Quiet & Intimate']);
  const [selectedActivities, setSelectedActivities] = useState(['Sunset Promenade', 'Board Game Café']);
  const [dietary, setDietary] = useState('none'); // 'none' | 'vegetarian' | 'vegan'
  const [dislikesText, setDislikesText] = useState('loud, rush');
  const [priceComfort, setPriceComfort] = useState('mid');

  const toggleArrayItem = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const extracted = await api.uploadTasteFile(sessionToken, file);
      onTasteExtracted(extracted);
    } catch (err) {
      setError(err.message || 'Failed to extract taste signals from upload');
    } finally {
      setLoading(false);
    }
  };

  const handleQuizSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const answers = {
      cuisines: selectedCuisines.map((c) => c.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-')),
      vibes: selectedVibes.map((v) => v.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-')),
      activities: selectedActivities.map((a) => a.toLowerCase().replace(/\s+/g, '-')),
      dietary_signals: dietary !== 'none' ? [dietary] : [],
      dislikes: dislikesText.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
      price_comfort: priceComfort,
    };

    try {
      const extracted = await api.submitTasteQuiz(sessionToken, answers);
      onTasteExtracted(extracted);
    } catch (err) {
      setError(err.message || 'Failed to process quiz answers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-rose-100 animate-fade-in">
      <div className="text-center mb-5">
        <span className="text-xs uppercase tracking-widest text-rose-500 font-semibold">
          {partnerLabel} • Taste Profile
        </span>
        <h2 className="text-2xl font-serif text-warm-900 mt-1">
          Share Your Tastes Privately
        </h2>
        <p className="text-xs text-warm-500 mt-1 max-w-sm mx-auto">
          We use local open AI models. Your preferences never leave your control and raw uploads are deleted instantly.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Input Options Tabs */}
      <div className="flex border-b border-warm-200 mb-5">
        <button
          type="button"
          onClick={() => setActiveTab('quiz')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'quiz'
              ? 'border-rose-500 text-rose-600 font-semibold'
              : 'border-transparent text-warm-500 hover:text-warm-800'
          }`}
        >
          ✨ Quick Taste Quiz
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'upload'
              ? 'border-rose-500 text-rose-600 font-semibold'
              : 'border-transparent text-warm-500 hover:text-warm-800'
          }`}
        >
          📦 Instagram Export
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('screenshot')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'screenshot'
              ? 'border-rose-500 text-rose-600 font-semibold'
              : 'border-transparent text-warm-500 hover:text-warm-800'
          }`}
        >
          📸 Screenshots
        </button>
      </div>

      {/* Tab 1: Quiz */}
      {activeTab === 'quiz' && (
        <form onSubmit={handleQuizSubmit} className="space-y-4 text-left">
          {/* Cuisines */}
          <div>
            <label className="block text-xs font-medium text-warm-800 mb-1.5">
              Cuisines & Flavors you enjoy in Tamil Nadu
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_CUISINES.map((c) => {
                const sel = selectedCuisines.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleArrayItem(selectedCuisines, setSelectedCuisines, c)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                      sel
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-warm-50 text-warm-700 border-warm-200 hover:bg-warm-100'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vibes */}
          <div>
            <label className="block text-xs font-medium text-warm-800 mb-1.5">
              Desired Date Atmosphere & Aesthetics
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_VIBES.map((v) => {
                const sel = selectedVibes.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleArrayItem(selectedVibes, setSelectedVibes, v)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                      sel
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-warm-50 text-warm-700 border-warm-200 hover:bg-warm-100'
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activities */}
          <div>
            <label className="block text-xs font-medium text-warm-800 mb-1.5">
              Preferred Activities
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_ACTIVITIES.map((a) => {
                const sel = selectedActivities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleArrayItem(selectedActivities, setSelectedActivities, a)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                      sel
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-warm-50 text-warm-700 border-warm-200 hover:bg-warm-100'
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dietary & Price */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-warm-800 mb-1">
                Dietary Constraint
              </label>
              <select
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
                className="w-full text-xs p-2 bg-warm-50 border border-warm-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400"
              >
                <option value="none">No Restrictions</option>
                <option value="vegetarian">Pure Vegetarian / Veg-friendly</option>
                <option value="vegan">Strict Vegan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-800 mb-1">
                Price Comfort
              </label>
              <select
                value={priceComfort}
                onChange={(e) => setPriceComfort(e.target.value)}
                className="w-full text-xs p-2 bg-warm-50 border border-warm-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400"
              >
                <option value="low">Budget / Cozy (₹)</option>
                <option value="mid">Mid-range / Boutique (₹₹)</option>
                <option value="high">Upscale / Fine Dining (₹₹₹)</option>
              </select>
            </div>
          </div>

          {/* Dislikes */}
          <div>
            <label className="block text-xs font-medium text-warm-800 mb-1">
              Dislikes & Deal-breakers (comma separated)
            </label>
            <input
              type="text"
              value={dislikesText}
              onChange={(e) => setDislikesText(e.target.value)}
              placeholder="e.g. loud, crowded, spicy"
              className="w-full text-xs p-2 bg-warm-50 border border-warm-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl text-xs transition-all shadow-md shadow-rose-200 disabled:opacity-50"
          >
            {loading ? 'Analyzing with Open-Weight AI...' : 'Review My Taste Card →'}
          </button>
        </form>
      )}

      {/* Tab 2: Instagram Export */}
      {activeTab === 'upload' && (
        <div className="py-6 px-4 border-2 border-dashed border-warm-200 rounded-xl bg-warm-50/60 text-center">
          <div className="text-3xl mb-2">📁</div>
          <h4 className="text-sm font-semibold text-warm-900 mb-1">
            Upload Your Instagram Data Export
          </h4>
          <p className="text-xs text-warm-500 mb-4 max-w-sm mx-auto">
            Upload your downloaded Instagram export (.zip or .json). We parse saved posts, locations, and captions defensively. No passwords, no login, no scraping.
          </p>
          <label className="inline-block py-2.5 px-5 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl text-xs cursor-pointer shadow-md shadow-rose-200 transition-all">
            {loading ? 'Extracting Taste Card...' : 'Select .zip or .json File'}
            <input
              type="file"
              accept=".zip,.json"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Tab 3: Screenshots */}
      {activeTab === 'screenshot' && (
        <div className="py-6 px-4 border-2 border-dashed border-warm-200 rounded-xl bg-warm-50/60 text-center">
          <div className="text-3xl mb-2">🖼️</div>
          <h4 className="text-sm font-semibold text-warm-900 mb-1">
            Upload Saved Post Screenshots
          </h4>
          <p className="text-xs text-warm-500 mb-4 max-w-sm mx-auto">
            Upload screenshots of aesthetic cafes, dishes, or date spots. Open vision models inspect the aesthetic and extract vibe signals.
          </p>
          <label className="inline-block py-2.5 px-5 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl text-xs cursor-pointer shadow-md shadow-rose-200 transition-all">
            {loading ? 'Processing Image...' : 'Select Screenshot (PNG / JPG)'}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  );
}
