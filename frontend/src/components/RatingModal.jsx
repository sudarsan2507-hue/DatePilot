import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function RatingModal({ token, stops, onClose }) {
  const [selectedStopIdx, setSelectedStopIdx] = useState(0);
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [insights, setInsights] = useState(null);
  const [submittedCount, setSubmittedCount] = useState(0);

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
    try {
      await api.rateStop(token, {
        stop_id: currentStop.venue.id,
        venue_name: currentStop.venue.name,
        slot: currentStop.slot,
        rating: Number(rating),
        notes,
      });

      setSubmittedCount((c) => c + 1);
      setNotes('');
      // Move to next stop if available
      if (selectedStopIdx < stops.length - 1) {
        setSelectedStopIdx(selectedStopIdx + 1);
      }
      fetchInsights();
    } catch (err) {
      alert(err.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-left">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-warm-100">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500 block">
              Post-Date Taste Memory
            </span>
            <h3 className="text-lg font-serif text-warm-900">
              Rate Your Stops
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-warm-400 hover:text-warm-700 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Stop Selector Chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {stops.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedStopIdx(idx)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                selectedStopIdx === idx
                  ? 'bg-rose-500 text-white border-rose-500 font-semibold'
                  : 'bg-warm-50 text-warm-700 border-warm-200'
              }`}
            >
              {s.slot}: {s.venue.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Current Stop Rating Form */}
        {currentStop && (
          <form onSubmit={handleRate} className="space-y-4 mb-6">
            <div className="p-3 bg-warm-50 rounded-xl border border-warm-200 text-xs">
              <span className="font-semibold text-warm-900 block text-sm">
                {currentStop.venue.name}
              </span>
              <span className="text-warm-500 text-[11px]">
                {currentStop.slot} • {currentStop.venue.area}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-warm-800 mb-1">
                How was this stop?
              </label>
              <div className="flex gap-2 text-2xl">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    {star <= rating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-warm-800 mb-1">
                Notes / Favorite Memory (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Loved the garden patio, peaceful coffee vibes..."
                rows={2}
                className="w-full text-xs p-2.5 bg-warm-50 border border-warm-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl text-xs transition-all shadow-md shadow-rose-200 disabled:opacity-50"
            >
              {submitting ? 'Recording Memory...' : 'Save Feedback & Learn Taste ✓'}
            </button>
          </form>
        )}

        {/* Memory Insights Card */}
        {insights && insights.total_reviews > 0 && (
          <div className="p-4 bg-gradient-to-br from-rose-50/60 to-purple-50/60 rounded-xl border border-rose-100 text-xs animate-fade-in">
            <div className="flex items-center gap-1.5 mb-2">
              <span>🧠</span>
              <h4 className="font-semibold text-warm-900">
                What I Learned About You Two
              </h4>
            </div>

            <div className="space-y-1 text-warm-700 text-[11px]">
              <div className="flex justify-between">
                <span>Total Rated Stops:</span>
                <span className="font-semibold">{insights.total_reviews}</span>
              </div>
              <div className="flex justify-between">
                <span>Average Couple Score:</span>
                <span className="font-semibold text-rose-600">{insights.average_rating} / 5.0</span>
              </div>
            </div>

            {insights.insights?.length > 0 && (
              <div className="mt-3 pt-2 border-t border-rose-100/80 space-y-1">
                {insights.insights.map((ins, i) => (
                  <p key={i} className="text-[11px] text-warm-600 leading-relaxed">
                    • {ins}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
