import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { api } from '../lib/api';
import Sheet from './Sheet';

const SLOT_LABELS = { lunch: 'Lunch', activity: 'Activity', cafe: 'Café', sunset: 'Sunset', dinner: 'Dinner' };

export default function RatingModal({ token, stops, onClose }) {
  const [selectedStopIdx, setSelectedStopIdx] = useState(0);
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState('');

  const currentStop = stops[selectedStopIdx];

  const fetchInsights = async () => {
    try {
      const data = await api.getMemoryInsights(token);
      setInsights(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleRate = async (e) => {
    e.preventDefault();
    if (!currentStop) return;

    setSubmitting(true);
    setError('');
    try {
      await api.rateStop(token, {
        stop_id: currentStop.venue.id,
        venue_name: currentStop.venue.name,
        slot: currentStop.slot,
        rating: Number(rating),
        notes,
      });

      setNotes('');
      // Move to next stop if available
      if (selectedStopIdx < stops.length - 1) {
        setSelectedStopIdx(selectedStopIdx + 1);
      }
      fetchInsights();
    } catch (err) {
      setError(err.message || 'Could not save your rating.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet eyebrow="After the date" title="How was it?" onClose={onClose}>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Choose a stop">
        {stops.map((s, idx) => (
          <button
            key={`${s.slot}-${s.venue.id}`}
            type="button"
            aria-pressed={selectedStopIdx === idx}
            onClick={() => setSelectedStopIdx(idx)}
            className="dp-chip"
          >
            {SLOT_LABELS[s.slot] || s.slot}
          </button>
        ))}
      </div>

      {currentStop && (
        <form onSubmit={handleRate} className="space-y-5">
          <div>
            <p className="font-serif text-xl leading-snug">{currentStop.venue.name}</p>
            <p className="mt-0.5 text-sm text-ink-3">{currentStop.venue.area}</p>
          </div>

          <fieldset>
            <legend className="dp-label">Your rating</legend>
            <div className="-ml-2 flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`${star} out of 5`}
                  aria-pressed={star === rating}
                  className="grid h-11 w-11 place-items-center rounded-lg text-accent-soft hover:bg-well"
                >
                  <Star size={24} strokeWidth={1.5} fill={star <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="dp-notes" className="dp-label">A note for next time <span className="text-ink-3">(optional)</span></label>
            <textarea
              id="dp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Loved the garden seating"
              rows={2}
              className="dp-field py-2.5"
            />
          </div>

          {error && <p role="alert" className="text-sm text-accent">{error}</p>}

          <button type="submit" disabled={submitting} className="dp-btn-primary w-full">
            {submitting ? 'Saving…' : 'Save rating'}
          </button>
        </form>
      )}

      {insights && insights.total_reviews > 0 && (
        <div className="mt-6 border-t border-line pt-5 animate-enter">
          <p className="dp-eyebrow">What we learned</p>
          <p className="mt-2 text-sm text-ink-2">
            {insights.total_reviews} {insights.total_reviews === 1 ? 'stop' : 'stops'} rated · average{' '}
            <span className="text-ink">{insights.average_rating} / 5</span>
          </p>
          {insights.insights?.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink-2">
              {insights.insights.map((ins) => (
                <li key={ins}>{ins}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}
