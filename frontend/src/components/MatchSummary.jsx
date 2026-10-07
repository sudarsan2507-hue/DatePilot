import React from 'react';
import { Clock } from 'lucide-react';
import PlanningScene from './PlanningScene';

const pretty = (value) => value.replace(/-/g, ' ');

function TagList({ items, empty }) {
  if (!items?.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <li key={item} className="side-step rounded-lg border border-line bg-paper px-3.5 py-2 text-sm capitalize text-ink" style={{ animationDelay: `${200 + i * 80}ms` }}>
          {pretty(item)}
        </li>
      ))}
    </ul>
  );
}

export default function MatchSummary({
  summary,
  onGeneratePlan,
  generating,
  isPartnerA,
  partnerBSubmitted,
  onRefresh,
  refreshing,
  refreshError,
}) {
  if (!summary?.ready) {
    return (
      <div className="dp-screen dp-card mx-auto max-w-2xl p-5 text-center shadow-soft animate-enter md:p-8">
        <Clock size={24} strokeWidth={1.5} className="mx-auto text-ink-3" aria-hidden="true" />
        <h2 className="mt-4 text-3xl leading-tight">Waiting for your partner</h2>
        <p className="mx-auto mt-2 max-w-md text-base text-ink-2">
          {partnerBSubmitted
            ? 'Your partner has answered. Putting your overlap together.'
            : 'Your answers are saved. This page updates by itself once your partner has answered.'}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="dp-btn mt-4 text-sm text-ink-2 underline underline-offset-4 hover:text-ink disabled:opacity-50"
        >
          {refreshing ? 'Checking…' : 'Check now'}
        </button>
        {refreshError && (
          <p className="mt-2 text-sm text-accent" role="alert">
            {refreshError} We will keep trying.
          </p>
        )}
      </div>
    );
  }

  if (generating) {
    return (
      <div className="dp-screen dp-card mx-auto max-w-2xl px-5 py-10 shadow-soft md:px-8 md:py-14">
        <PlanningScene />
      </div>
    );
  }

  return (
    <div className="dp-screen dp-card mx-auto max-w-2xl p-5 shadow-soft animate-enter md:p-8">
      <p className="dp-eyebrow">Together</p>
      <h2 className="mt-2 text-3xl leading-tight md:text-4xl">What you have in common</h2>
      <p className="mt-2 text-base text-ink-2">Worked out privately. Neither of you sees who chose what.</p>

      <dl className="mt-8 divide-y divide-line border-y border-line">
        <div className="grid gap-3 py-5 sm:grid-cols-[140px_1fr] sm:gap-6">
          <dt className="text-sm text-ink-2">Places</dt>
          <dd><TagList items={summary.shared_vibes} empty="Different tastes. We will balance both." /></dd>
        </div>
        <div className="grid gap-3 py-5 sm:grid-cols-[140px_1fr] sm:gap-6">
          <dt className="text-sm text-ink-2">Food</dt>
          <dd><TagList items={summary.shared_cuisines} empty="We will pick local favourites you can both enjoy." /></dd>
        </div>
        <div className="grid grid-cols-2 gap-6 py-5">
          <div>
            <dt className="text-sm text-ink-2">Budget</dt>
            <dd className="mt-1 font-serif text-2xl">₹{Number(summary.effective_budget || 5000).toLocaleString('en-IN')}</dd>
            <dd className="mt-0.5 text-xs text-ink-3">The lower of your two limits</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-2">Dietary needs</dt>
            <dd className="mt-1 font-serif text-2xl capitalize">
              {summary.dietary_rules?.length ? summary.dietary_rules.map(pretty).join(', ') : 'None'}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-3">Every stop works for both</dd>
          </div>
        </div>
      </dl>

      {isPartnerA ? (
        <button type="button" onClick={onGeneratePlan} disabled={generating} className="dp-btn-primary mt-8 w-full min-h-12">
          {generating ? 'Planning your day… this takes a minute' : 'Plan our day'}
        </button>
      ) : (
        <p className="mt-8 rounded-lg bg-well px-4 py-3 text-sm text-ink-2">
          All set. Your partner can now plan the day.
        </p>
      )}
    </div>
  );
}
