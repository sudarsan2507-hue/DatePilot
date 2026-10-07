import React, { useState } from 'react';
import { api } from '../lib/api';
import { FileArchive, ImageIcon, ListChecks, Upload } from 'lucide-react';

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
      setError(err.message || 'We could not read that file. Try another one or use the quiz.');
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
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'quiz', label: 'Quiz', icon: ListChecks },
    { id: 'upload', label: 'Instagram', icon: FileArchive },
    { id: 'screenshot', label: 'Screenshots', icon: ImageIcon },
  ];

  const chipGroup = (legend, options, selected, setSelected) => (
    <fieldset>
      <legend className="dp-label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={selected.includes(option)}
            onClick={() => toggleArrayItem(selected, setSelected, option)}
            className="dp-chip"
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );

  const uploadPanel = (title, body, accept, idleLabel) => (
    <div className="rounded-lg border border-dashed border-line bg-well px-5 py-10 text-center">
      <Upload size={24} strokeWidth={1.5} className="mx-auto text-ink-3" aria-hidden="true" />
      <h3 className="mt-4 text-xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-2">{body}</p>
      <label className={`dp-btn-primary mt-6 cursor-pointer ${loading ? 'pointer-events-none opacity-50' : ''}`}>
        {loading ? 'Reading your file…' : idleLabel}
        <input type="file" accept={accept} onChange={handleFileUpload} disabled={loading} className="sr-only" />
      </label>
    </div>
  );

  return (
    <div className="dp-screen dp-card mx-auto max-w-2xl p-5 shadow-soft animate-enter md:p-8">
      <div className="mb-6">
        <p className="dp-eyebrow">{partnerLabel === 'demo' ? "Your partner's tastes · demo" : 'Your tastes · private'}</p>
        <h2 className="mt-2 text-3xl leading-tight md:text-4xl">What do you enjoy?</h2>
        <p className="mt-2 text-base text-ink-2">
          Answer a few questions or share files you exported yourself. Files are read by a local model and deleted straight after.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-lg border border-accent-soft/40 bg-well px-4 py-3 text-sm text-accent">
          {error}
        </p>
      )}

      <div role="tablist" aria-label="How to share your tastes" className="mb-8 grid grid-cols-3 gap-1 rounded-lg border border-line bg-well p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-sm ${
              activeTab === id ? 'bg-paper text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            <Icon size={18} strokeWidth={1.5} aria-hidden="true" className="hidden sm:block" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'quiz' && (
        <form onSubmit={handleQuizSubmit} className="space-y-7">
          {chipGroup('Food you like', SAMPLE_CUISINES, selectedCuisines, setSelectedCuisines)}
          {chipGroup('The kind of place', SAMPLE_VIBES, selectedVibes, setSelectedVibes)}
          {chipGroup('Things to do', SAMPLE_ACTIVITIES, selectedActivities, setSelectedActivities)}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dp-diet" className="dp-label">Dietary needs</label>
              <select id="dp-diet" value={dietary} onChange={(e) => setDietary(e.target.value)} className="dp-field">
                <option value="none">None</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
              </select>
            </div>
            <div>
              <label htmlFor="dp-price" className="dp-label">Price comfort</label>
              <select id="dp-price" value={priceComfort} onChange={(e) => setPriceComfort(e.target.value)} className="dp-field">
                <option value="low">Easy on the wallet</option>
                <option value="mid">Mid-range</option>
                <option value="high">Special occasion</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="dp-dislikes" className="dp-label">Anything to avoid?</label>
            <input
              id="dp-dislikes"
              type="text"
              value={dislikesText}
              onChange={(e) => setDislikesText(e.target.value)}
              placeholder="loud, crowded, very spicy"
              className="dp-field"
            />
            <p className="mt-2 text-xs text-ink-3">Separate with commas.</p>
          </div>

          <button type="submit" disabled={loading} className="dp-btn-primary w-full min-h-12">
            {loading ? 'Reading your answers…' : 'Review my answers'}
          </button>
        </form>
      )}

      {activeTab === 'upload' && uploadPanel(
        'Instagram data export',
        'Upload the .zip or .json you downloaded from Instagram. We look at saved posts, captions and places. No login, no scraping.',
        '.zip,.json',
        'Choose file',
      )}

      {activeTab === 'screenshot' && uploadPanel(
        'Screenshots of saved posts',
        'Cafés, dishes or places you have saved. A local vision model picks out the style and food.',
        'image/*',
        'Choose image',
      )}
    </div>
  );
}
