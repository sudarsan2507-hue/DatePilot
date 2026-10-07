import React, { useState } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, X } from 'lucide-react';

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
      setMessage(err.message || 'Could not save. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete everything you have shared? This cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteMyData(sessionToken);
      if (onDeleted) onDeleted();
    } catch (err) {
      setMessage(err.message || 'Could not delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const sections = [
    { key: 'cuisines', label: 'Food', empty: 'Nothing yet' },
    { key: 'vibes', label: 'Places', empty: 'Nothing yet' },
    { key: 'activities', label: 'Things to do', empty: 'Nothing yet' },
    { key: 'dietary_signals', label: 'Dietary needs', empty: 'None', note: 'Always respected' },
    { key: 'dislikes', label: 'Avoid', empty: 'Nothing' },
  ];

  const pretty = (value) => value.replace(/-/g, ' ');

  return (
    <div className="dp-screen dp-card mx-auto max-w-2xl p-5 shadow-soft animate-enter md:p-8">
      <div className="mb-8">
        <p className="dp-eyebrow">{partnerLabel === 'demo' ? "Your partner's answers · demo" : 'Your answers · private'}</p>
        <h2 className="mt-2 text-3xl leading-tight md:text-4xl">Is this you?</h2>
        <p className="mt-2 text-base text-ink-2">
          Remove anything that is wrong and add what is missing. Nothing is used until you confirm.
        </p>
      </div>

      {message && (
        <p role="alert" className="mb-6 rounded-lg border border-accent-soft/40 bg-well px-4 py-3 text-sm text-accent">
          {message}
        </p>
      )}

      <dl className="divide-y divide-line border-y border-line">
        {sections.map(({ key, label, empty, note }) => {
          const items = card[key] || [];
          return (
            <div key={key} className="grid gap-3 py-5 sm:grid-cols-[140px_1fr] sm:gap-6">
              <dt>
                <span className="text-sm text-ink-2">{label}</span>
                {note && <span className="mt-0.5 block text-xs text-ink-3">{note}</span>}
              </dt>
              <dd className="flex flex-wrap gap-2">
                {items.length === 0 && <span className="py-2.5 text-sm text-ink-3">{empty}</span>}
                {items.map((item) => (
                  <span key={item} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-paper pl-3.5 text-sm text-ink">
                    <span className="capitalize">{pretty(item)}</span>
                    {card.confidence?.[item] != null && (
                      <span className="ml-2 text-xs text-ink-3" title="How sure the model was">
                        {Math.round(card.confidence[item] * 100)}%
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeChip(key, item)}
                      aria-label={`Remove ${pretty(item)}`}
                      className="grid h-11 w-10 place-items-center text-ink-3 hover:text-accent"
                    >
                      <X size={16} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </dd>
            </div>
          );
        })}
      </dl>

      <form onSubmit={addChip} className="mt-6 grid gap-2 sm:grid-cols-[150px_1fr_auto]">
        <label htmlFor="dp-new-cat" className="sr-only">Category</label>
        <select id="dp-new-cat" value={newTagCategory} onChange={(e) => setNewTagCategory(e.target.value)} className="dp-field">
          <option value="vibes">Place</option>
          <option value="cuisines">Food</option>
          <option value="activities">Thing to do</option>
          <option value="dietary_signals">Dietary need</option>
          <option value="dislikes">Avoid</option>
        </select>
        <label htmlFor="dp-new-tag" className="sr-only">Add something</label>
        <input
          id="dp-new-tag"
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Add something"
          className="dp-field"
        />
        <button type="submit" className="dp-btn-quiet">
          <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
          Add
        </button>
      </form>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleDeleteAll}
          disabled={deleting}
          className="dp-btn px-0 text-sm text-ink-3 hover:text-accent disabled:opacity-50 sm:px-2"
        >
          <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
          {deleting ? 'Deleting…' : 'Delete my data'}
        </button>
        <button type="button" onClick={handleConfirm} disabled={confirming} className="dp-btn-primary min-h-12 sm:min-w-56">
          {confirming ? 'Saving…' : 'Confirm and continue'}
        </button>
      </div>
    </div>
  );
}
