import React, { useState } from 'react';
import { useCountUp } from '../lib/motion';
import { directionsTo, downloadCalendar, fullRouteUrl, shareText } from '../lib/dayTools';
import RouteMap from './RouteMap';
import {
  ArrowUpRight, BedDouble, CalendarPlus, Car, Check, CloudSun, Coffee, MapPin, Navigation,
  Palette, RefreshCw, Share2, Star, Sunset, Umbrella, Utensils, Wine, X,
} from 'lucide-react';

const SLOT_ICONS = {
  lunch: Utensils,
  activity: Palette,
  cafe: Coffee,
  sunset: Sunset,
  dinner: Wine,
};

const SLOT_LABELS = {
  lunch: 'Lunch',
  activity: 'Activity',
  cafe: 'Café',
  sunset: 'Sunset walk',
  dinner: 'Dinner',
};

const PLAN_LABELS = ['Best match', 'Alternative', 'Lowest cost'];

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function StopPhoto({ venue }) {
  const [failed, setFailed] = useState(false);
  if (!venue.image_url || failed) return null;
  const representative = venue.image_kind === 'representative';
  return (
    <figure className="relative -mx-4 -mt-4 mb-4 overflow-hidden rounded-t-xl md:-mx-5 md:-mt-5">
      <img
        src={venue.image_url}
        alt={representative ? `Representative photo for ${venue.name}` : venue.name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="photo-in h-44 w-full object-cover md:h-52"
      />
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-ink/60 to-transparent px-3 pb-2 pt-8 text-xs text-cream">
        <span>{representative ? 'Representative photo' : ''}</span>
        {venue.image_page && (
          <a href={venue.image_page} target="_blank" rel="noopener noreferrer" className="-mb-2 inline-flex min-h-11 items-end pb-2 underline underline-offset-2 hover:text-white">
            Photo: Wikimedia Commons
          </a>
        )}
      </figcaption>
    </figure>
  );
}

export default function ItineraryViewer({
  plans,
  date,
  selectedPlanIndex,
  onSelectPlan,
  onSwapClick,
  onRainToggle,
  onRateClick,
  rainPlanIndex,
  rainTriggerNote,
  liveWeather,
  liveRoutes,
}) {
  const [showStaySuggestion, setShowStaySuggestion] = useState(false);
  const [shared, setShared] = useState(false);

  const activePlan = plans?.[selectedPlanIndex] || plans?.[0];
  const shownTotal = useCountUp(activePlan?.total_cost || 0);
  const shownLeft = useCountUp(activePlan?.budget_remaining || 0);
  const shownDrive = useCountUp(activePlan?.total_travel_min || 0);

  if (!activePlan) {
    return null;
  }

  const rainModeActive = rainPlanIndex === selectedPlanIndex;
  const stops = activePlan.stops || [];
  const city = stops[0]?.venue?.city || 'Tamil Nadu';
  const isSurprise = stops.length > 0 && stops.every((s) => !s.venue.lat && !s.venue.lng);
  const start = liveRoutes?.start;
  const ok = activePlan.constraints_ok || {};
  const checks = [
    ['budget', 'Within budget'],
    ['hours', 'Open at every stop'],
    ['travel', 'Drives within your limit'],
    ['dietary', 'Dietary needs met'],
  ];

  const handleShare = async () => {
    const text = shareText(stops, date, activePlan.total_cost, start);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Our day out', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch {
      // share sheet dismissed
    }
  };

  return (
    <div className="dp-screen mx-auto max-w-5xl animate-enter">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="dp-eyebrow">Your day</p>
          <h2 className="mt-2 text-3xl leading-tight md:text-4xl">Three ways to spend it</h2>
        </div>
        <div role="tablist" aria-label="Plans" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-well p-1 md:w-[420px]">
          {plans.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={selectedPlanIndex === idx}
              onClick={() => onSelectPlan(idx)}
              className={`min-h-11 rounded-md px-2 text-sm ${
                selectedPlanIndex === idx ? 'bg-paper text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {PLAN_LABELS[idx] || `Plan ${idx + 1}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        {/* Timeline */}
        <div className="space-y-6">
          {activePlan.itinerary_text && (
            <p className="reveal border-l-2 border-accent-soft pl-5 font-serif text-lg italic leading-relaxed text-ink-2">
              {activePlan.itinerary_text}
            </p>
          )}

          {rainModeActive && (
            <p className="flex gap-3 rounded-lg border border-line bg-well px-4 py-3 text-sm text-ink-2">
              <Umbrella size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
              <span><span className="text-ink">Rain plan on.</span> {rainTriggerNote || 'Outdoor stops are swapped for indoor ones.'}</span>
            </p>
          )}

          {!isSurprise && (
            <section className="reveal dp-card p-4 md:p-5" aria-labelledby="dp-route-title">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 id="dp-route-title" className="text-xl">Your route</h3>
                <p className="text-sm text-ink-3">
                  {stops.length} stops · {activePlan.total_travel_min} min driving
                </p>
              </div>
              <RouteMap key={`${selectedPlanIndex}-${rainModeActive}`} stops={stops} routes={rainModeActive ? null : liveRoutes} />
              {!liveRoutes && !rainModeActive && (
                <p className="mt-2 text-xs text-ink-3">Loading road directions…</p>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <a
                  href={fullRouteUrl(stops, start)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dp-btn-primary text-sm"
                >
                  <Navigation size={16} strokeWidth={1.5} aria-hidden="true" />
                  Start navigation
                </a>
                <button type="button" onClick={() => downloadCalendar(stops, date)} className="dp-btn-quiet text-sm" disabled={!date}>
                  <CalendarPlus size={16} strokeWidth={1.5} aria-hidden="true" />
                  Add to calendar
                </button>
                <button type="button" onClick={handleShare} className="dp-btn-quiet text-sm">
                  {shared ? <Check size={16} strokeWidth={1.5} aria-hidden="true" /> : <Share2 size={16} strokeWidth={1.5} aria-hidden="true" />}
                  {shared ? 'Copied' : 'Share plan'}
                </button>
              </div>
            </section>
          )}

          <ol key={selectedPlanIndex} className="relative space-y-3 pl-5 md:pl-7">
            <span className="timeline-line absolute bottom-6 left-[5px] top-6 w-px bg-accent-soft/40 md:left-[9px]" aria-hidden="true" />
            {stops.map((stop, stopIdx) => {
              const Icon = SLOT_ICONS[stop.slot] || MapPin;
              return (
                <li key={`${stop.slot}-${stop.venue.id}`} className="reveal dp-card lift relative p-4 md:p-5">
                  <span className="absolute -left-[20px] top-6 h-[11px] w-[11px] rounded-full border-2 border-cream bg-accent-soft md:-left-[24px]" aria-hidden="true" />
                  <StopPhoto venue={stop.venue} />
                  <div className="flex gap-4">
                    <div className="w-14 shrink-0 md:w-16">
                      <p className="font-serif text-xl leading-none">{stop.arrival_time}</p>
                      <p className="mt-1 text-xs text-ink-3">to {stop.departure_time}</p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-ink-3">
                            <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
                            {stopIdx + 1} · {SLOT_LABELS[stop.slot] || stop.slot}
                          </p>
                          <h3 className="mt-1 break-words text-xl leading-snug">{stop.venue.name}</h3>
                          <p className="mt-0.5 text-sm text-ink-3">
                            {stop.venue.area}
                            {stop.travel_from_prev_min > 0 && ` · ${stop.travel_from_prev_min} min drive (${stop.distance_from_prev_km} km)`}
                          </p>
                        </div>
                        <p className="shrink-0 font-serif text-lg">{stop.cost > 0 ? inr(stop.cost) : 'Free'}</p>
                      </div>

                      {stop.why_picked && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-2">{stop.why_picked}</p>
                      )}

                      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3">
                        <p className="text-sm text-ink-3">
                          {stop.backup_venue
                            ? <>Backup: <span className="text-ink-2">{stop.backup_venue.name}</span></>
                            : 'No backup that fits every limit'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {!isSurprise && (
                            <a
                              href={directionsTo(stop.venue)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dp-btn-quiet px-3.5 text-sm"
                            >
                              <Navigation size={16} strokeWidth={1.5} aria-hidden="true" />
                              Directions
                            </a>
                          )}
                          {rainModeActive ? (
                            <p className="self-center text-xs text-ink-3">Turn off the rain plan to swap</p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSwapClick(selectedPlanIndex, stopIdx)}
                              className="dp-btn-quiet px-3.5 text-sm"
                            >
                              <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" />
                              Swap stop
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Summary */}
        <aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-24">
          <div className="dp-card p-5">
            <dl className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-4">
              <div>
                <dt className="text-xs text-ink-3">Total for two</dt>
                <dd className="mt-1 font-serif text-2xl tabular-nums">{inr(shownTotal)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Left in budget</dt>
                <dd className="mt-1 font-serif text-2xl tabular-nums">{inr(shownLeft)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Driving</dt>
                <dd className="mt-1 font-serif text-2xl tabular-nums">{shownDrive} min</dd>
              </div>
            </dl>

            <ul className="mt-5 grid gap-2 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-1">
              {checks.map(([key, label]) => {
                const passed = ok[key] !== false;
                return (
                  <li key={key} className={`flex items-center gap-2 text-sm ${passed ? 'text-ink-2' : 'text-accent'}`}>
                    {passed
                      ? <Check size={16} strokeWidth={1.5} className="text-sage" aria-hidden="true" />
                      : <X size={16} strokeWidth={1.5} aria-hidden="true" />}
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>

          {(liveWeather || liveRoutes) && (
            <div className="dp-card space-y-3 p-5 text-sm text-ink-2">
              {liveWeather && (
                <p className="flex gap-3">
                  <CloudSun size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                  <span>
                    {liveWeather.summary}
                    {liveWeather.rain_probability != null && ` Rain chance ${liveWeather.rain_probability}%.`}
                    <span className="mt-0.5 block text-xs text-ink-3">Weather for {liveWeather.city} · {liveWeather.source}</span>
                  </span>
                </p>
              )}
              {liveRoutes && (
                <p className="flex gap-3">
                  <Car size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                  <span>
                    Road route checked for {liveRoutes.legs.length} legs.
                    <span className="mt-0.5 block text-xs text-ink-3">{liveRoutes.legs[0]?.source}</span>
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <button
              type="button"
              onClick={() => onRainToggle(selectedPlanIndex)}
              aria-pressed={rainModeActive}
              className={`dp-btn border text-sm ${rainModeActive ? 'border-ink bg-well text-ink' : 'border-line bg-paper text-ink-2 hover:border-ink-3'}`}
            >
              <Umbrella size={16} strokeWidth={1.5} aria-hidden="true" />
              {rainModeActive ? 'Rain plan on' : 'Rain plan'}
            </button>
            <button
              type="button"
              onClick={() => setShowStaySuggestion(!showStaySuggestion)}
              aria-expanded={showStaySuggestion}
              className="dp-btn-quiet text-sm"
            >
              <BedDouble size={16} strokeWidth={1.5} aria-hidden="true" />
              Stay nearby
            </button>
            <button type="button" onClick={onRateClick} className="dp-btn-quiet col-span-2 text-sm lg:col-span-1">
              <Star size={16} strokeWidth={1.5} aria-hidden="true" />
              Rate this date
            </button>
          </div>

          {showStaySuggestion && (
            <div className="dp-card p-5 text-sm text-ink-2 animate-enter">
              <p className="text-ink">Want to stay the night?</p>
              <p className="mt-1">Browse hotels in {city}. We only link out. No booking or payment happens here.</p>
              <a
                href={`https://www.google.com/travel/hotels/${encodeURIComponent(city)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="dp-btn mt-3 px-0 text-sm text-accent underline underline-offset-4 hover:text-accent-deep"
              >
                See hotels in {city}
                <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
