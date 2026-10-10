import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { QUIZ_ACTIVITIES, QUIZ_CUISINES, QUIZ_VIBES, toAnswers } from '../lib/quiz';

const toggle = (list, setList, item) =>
  setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

function ChipGroup({ legend, options, selected, setSelected }) {
  return (
    <fieldset>
      <legend className="dp-label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={selected.includes(option)}
            onClick={() => toggle(selected, setSelected, option)}
            className="dp-chip"
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** One person's picks: food, kind of place, things to do, plus needs and dislikes. */
function usePicks() {
  const [cuisines, setCuisines] = useState([]);
  const [vibes, setVibes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [dietary, setDietary] = useState('none');
  const [dislikes, setDislikes] = useState('');
  return {
    cuisines, setCuisines, vibes, setVibes, activities, setActivities, dietary, setDietary, dislikes, setDislikes,
    isEmpty: !cuisines.length && !vibes.length && !activities.length && dietary === 'none' && !dislikes.trim(),
    answers: () => toAnswers({ cuisines, vibes, activities, dietary, dislikes }),
  };
}

function PicksFields({ picks, who, idPrefix }) {
  return (
    <div className="space-y-6">
      <ChipGroup legend={`Food ${who} like`} options={QUIZ_CUISINES} selected={picks.cuisines} setSelected={picks.setCuisines} />
      <ChipGroup legend="The kind of place" options={QUIZ_VIBES} selected={picks.vibes} setSelected={picks.setVibes} />
      <ChipGroup legend="Things to do" options={QUIZ_ACTIVITIES} selected={picks.activities} setSelected={picks.setActivities} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-diet`} className="dp-label">Dietary needs</label>
          <select id={`${idPrefix}-diet`} value={picks.dietary} onChange={(e) => picks.setDietary(e.target.value)} className="dp-field">
            <option value="none">None</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-avoid`} className="dp-label">Anything to avoid?</label>
          <input
            id={`${idPrefix}-avoid`}
            type="text"
            value={picks.dislikes}
            onChange={(e) => picks.setDislikes(e.target.value)}
            placeholder="loud, crowded"
            className="dp-field"
          />
        </div>
      </div>
    </div>
  );
}

export default function Personalize({ onReplan, onBack }) {
  const theirs = usePicks();
  const yours = usePicks();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (theirs.isEmpty && yours.isEmpty) {
      setError('Pick at least one thing, for them or for you.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onReplan({
        about_date: theirs.isEmpty ? null : theirs.answers(),
        about_you: yours.isEmpty ? null : yours.answers(),
      });
    } catch (err) {
      setError(err.message || 'Could not re-plan. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="dp-screen dp-card mx-auto max-w-2xl p-5 shadow-soft animate-enter md:p-8">
      <button type="button" onClick={onBack} className="dp-btn -ml-2 mb-4 px-2 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={18} strokeWidth={1.5} aria-hidden="true" />
        Back to the plan
      </button>
      <p className="dp-eyebrow">Optional · stays on this plan</p>
      <h2 className="mt-2 text-3xl leading-tight md:text-4xl">Make it more personal</h2>
      <p className="mt-2 text-base text-ink-2">Tell us a little about your date, and about you. Skip anything you don&rsquo;t know.</p>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-accent-soft/40 bg-well px-4 py-3 text-sm text-accent">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-10">
        <section aria-labelledby="dp-p-them">
          <h3 id="dp-p-them" className="mb-5 text-2xl">What do they like?</h3>
          <PicksFields picks={theirs} who="they" idPrefix="dp-them" />
        </section>

        <section aria-labelledby="dp-p-you" className="border-t border-line pt-8">
          <h3 id="dp-p-you" className="mb-5 text-2xl">And you?</h3>
          <PicksFields picks={yours} who="you" idPrefix="dp-you" />
        </section>

        <button type="submit" disabled={loading} className="dp-btn-primary w-full min-h-12">
          {loading ? 'Re-planning…' : 'Re-plan with this'}
        </button>
      </form>
    </div>
  );
}
