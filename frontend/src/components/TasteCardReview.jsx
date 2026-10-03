import React, { useState } from 'react';
import { api } from '../lib/api';

export default function TasteCardReview({
  initialCard,
  sessionToken,
  partnerLabel,
  onConfirmed,
  onDeleted,
}) {
  const [card, setCard] = useState(initialCard);
  const [newTag, setNewTag] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('vibes');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const removeChip = (category, item) => {
    setCard({
      ...card,
      [category]: (card[category] || []).filter((x) => x !== item),
    });
  };

  const addChip = (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    const item = newTag.trim().toLowerCase().replace(/\s+/g, '-');
    const existing = card[newTagCategory] || [];
    if (!existing.includes(item)) {
      setCard({
        ...card,
        [newTagCategory]: [...existing, item],
      });
    }
    setNewTag('');
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setMessage('');
    try {
      await api.confirmTasteCard(sessionToken, card);
      onConfirmed(card);
    } catch (err) {
      setMessage(err.message || 'Failed to confirm taste card');
    } finally {
      setConfirming(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete all your taste data? This is permanent.')) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteMyData(sessionToken);
      if (onDeleted) onDeleted();
    } catch (err) {
      setMessage(err.message || 'Failed to delete data');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-rose-100 animate-fade-in text-left">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-warm-100">
        <div>
          <span className="text-xs uppercase tracking-wider text-rose-500 font-semibold">
            {partnerLabel} • Consent Review
          </span>
          <h3 className="text-xl font-serif text-warm-900 mt-0.5">
            Review Your Extracted Taste Card
          </h3>
          <p className="text-[11px] text-warm-500">
            Edit, remove, or add preferences. Nothing is used until you confirm below.
          </p>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {message}
        </div>
      )}

      {/* Cuisines */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-warm-800 uppercase tracking-wider block mb-1.5">
          Favorite Cuisines
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(card.cuisines || []).map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-800 text-xs rounded-full border border-rose-200"
            >
              {c}
              {card.confidence?.[c] && (
                <span className="text-[10px] text-rose-400 font-mono">
                  {Math.round(card.confidence[c] * 100)}%
                </span>
              )}
              <button
                type="button"
                onClick={() => removeChip('cuisines', c)}
                className="text-rose-400 hover:text-rose-700 font-bold text-xs"
              >
                ×
              </button>
            </span>
          ))}
          {(!card.cuisines || card.cuisines.length === 0) && (
            <span className="text-xs text-warm-400 italic">No cuisines selected</span>
          )}
        </div>
      </div>

      {/* Vibes */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-warm-800 uppercase tracking-wider block mb-1.5">
          Atmosphere & Aesthetics
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(card.vibes || []).map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 text-xs rounded-full border border-purple-200"
            >
              {v}
              {card.confidence?.[v] && (
                <span className="text-[10px] text-purple-400 font-mono">
                  {Math.round(card.confidence[v] * 100)}%
                </span>
              )}
              <button
                type="button"
                onClick={() => removeChip('vibes', v)}
                className="text-purple-400 hover:text-purple-700 font-bold text-xs"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Activities */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-warm-800 uppercase tracking-wider block mb-1.5">
          Activities & Experiences
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(card.activities || []).map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 text-xs rounded-full border border-blue-200"
            >
              {a}
              <button
                type="button"
                onClick={() => removeChip('activities', a)}
                className="text-blue-400 hover:text-blue-700 font-bold text-xs"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Dietary & Dislikes */}
      <div className="grid grid-cols-2 gap-4 mb-4 pt-1">
        <div>
          <label className="text-xs font-semibold text-warm-800 uppercase tracking-wider block mb-1">
            Confirmed Dietary Rule
          </label>
          <div className="flex flex-wrap gap-1">
            {(card.dietary_signals || []).map((d) => (
              <span
                key={d}
                className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs rounded-full flex items-center gap-1"
              >
                🌿 {d}
                <button
                  type="button"
                  onClick={() => removeChip('dietary_signals', d)}
                  className="font-bold text-emerald-600"
                >
                  ×
                </button>
              </span>
            ))}
            {(!card.dietary_signals || card.dietary_signals.length === 0) && (
              <span className="text-xs text-warm-400">None (All food types)</span>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-warm-800 uppercase tracking-wider block mb-1">
            Disliked / Excluded
          </label>
          <div className="flex flex-wrap gap-1">
            {(card.dislikes || []).map((d) => (
              <span
                key={d}
                className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-xs rounded-full flex items-center gap-1"
              >
                🚫 {d}
                <button
                  type="button"
                  onClick={() => removeChip('dislikes', d)}
                  className="font-bold text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Add Custom Chip */}
      <form onSubmit={addChip} className="flex gap-2 mb-6 pt-2 border-t border-warm-100">
        <select
          value={newTagCategory}
          onChange={(e) => setNewTagCategory(e.target.value)}
          className="text-xs bg-warm-50 border border-warm-200 rounded-lg px-2 py-1.5 focus:outline-none"
        >
          <option value="vibes">Add Vibe</option>
          <option value="cuisines">Add Cuisine</option>
          <option value="activities">Add Activity</option>
          <option value="dislikes">Add Dislike</option>
          <option value="dietary_signals">Add Dietary</option>
        </select>
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Type new preference tag..."
          className="flex-1 text-xs bg-warm-50 border border-warm-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-400"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-warm-800 hover:bg-warm-900 text-white text-xs font-medium rounded-lg"
        >
          + Add
        </button>
      </form>

      {/* Confirm & GDPR Delete Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-medium rounded-xl text-xs shadow-md shadow-rose-200 transition-all text-center disabled:opacity-50"
        >
          {confirming ? 'Saving Confirmed Card...' : 'Confirm Taste Card & Proceed →'}
        </button>

        <button
          type="button"
          onClick={handleDeleteAll}
          disabled={deleting}
          className="py-3 px-4 bg-warm-100 hover:bg-red-50 text-red-600 hover:text-red-700 border border-warm-200 hover:border-red-200 font-medium rounded-xl text-xs transition-all text-center"
        >
          {deleting ? 'Wiping...' : 'Delete All My Data'}
        </button>
      </div>
    </div>
  );
}
