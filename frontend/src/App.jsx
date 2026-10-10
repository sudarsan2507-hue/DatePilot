import React, { useState, useEffect } from 'react';
import { api } from './lib/api';
import SessionSetup from './components/SessionSetup';
import PartnerInvite from './components/PartnerInvite';
import TasteProfiler from './components/TasteProfiler';
import TasteCardReview from './components/TasteCardReview';
import MatchSummary from './components/MatchSummary';
import ItineraryViewer from './components/ItineraryViewer';
import SwapModal from './components/SwapModal';
import RatingModal from './components/RatingModal';
import PartnerLimits from './components/PartnerLimits';
import QuickStart from './components/QuickStart';
import Personalize from './components/Personalize';
import { ArrowLeft, ArrowUpRight, Check, Eye, MapPin, Plus, Sparkles, Users, Wallet } from 'lucide-react';
import { useReveal, useTilt } from './lib/motion';
import { SideArtLeft, SideArtRight } from './components/SideScenes';
import { GutterKolam, GutterPetals } from './components/motion/GutterArt';
import TwoDotsMeet from './components/motion/TwoDotsMeet';
import IntroOverlay from './components/IntroOverlay';
import { markIntroPlayed, shouldPlayIntroOnLoad, watchSessionTimeout } from './lib/introSession';

export default function App() {
  // Session state
  const [session, setSession] = useState(null);
  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [activePartner, setActivePartner] = useState('a'); // 'a' or 'b'
  
  // Solo (default): 'start' -> 'plans' -> optional 'personalize'.
  // Together (optional): 'setup' | 'limits' | 'invite' | 'taste' | 'review' | 'match' | 'plans'
  const [view, setView] = useState('start');
  const [mode, setMode] = useState('solo'); // 'solo' | 'together'
  const [quickRequest, setQuickRequest] = useState(null); // last quick-plan inputs, for re-planning

  // Candidate Taste Cards for review
  const [candidateCardA, setCandidateCardA] = useState(null);
  const [candidateCardB, setCandidateCardB] = useState(null);
  const [confirmedCardA, setConfirmedCardA] = useState(null);
  const [confirmedCardB, setConfirmedCardB] = useState(null);

  // Match and Plans state
  const [matchSummary, setMatchSummary] = useState(null);
  const [matchRefreshError, setMatchRefreshError] = useState('');
  const [refreshingMatch, setRefreshingMatch] = useState(false);
  const [plans, setPlans] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [rainPlanIndex, setRainPlanIndex] = useState(null); // which plan is showing its rain version
  const [rainTriggerNote, setRainTriggerNote] = useState('');
  const [liveWeather, setLiveWeather] = useState(null);
  const [liveRoutes, setLiveRoutes] = useState(null);

  // Intro: first visit in a browser session, after the inactivity timeout, or from the logo.
  // A new key replays it from the start.
  const [introKey, setIntroKey] = useState(() => (shouldPlayIntroOnLoad() ? Date.now() : null));
  const playIntro = () => setIntroKey(Date.now());

  useEffect(() => {
    if (introKey) markIntroPlayed();
  }, [introKey]);

  useEffect(() => watchSessionTimeout(playIntro), []);

  // Partner B's side opened on Partner A's own device (the demo shortcut).
  const isDemoPartner = activePartner === 'b' && Boolean(tokenA);

  const heroTiltRef = useTilt(4, [view]);
  const revealRef = useReveal([view, selectedPlanIndex, plans]);

  // Each step starts at the top of the page instead of where the last button was.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  // Modals state
  const [swapTarget, setSwapTarget] = useState(null); // { planIndex, stopIndex, stop }
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Check URL hash for partner B invite link (e.g. /#invite=token_b)
  // Resume from the URL so a reload never loses the date:
  // Partner B opens #invite=<token_b>, Partner A keeps #session=<token_a>.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#invite=')) {
      const inviteToken = hash.replace('#invite=', '').trim();
      if (inviteToken) {
        setTokenB(inviteToken);
        setActivePartner('b');
        loadSessionData(inviteToken, 'b');
      }
    } else if (hash.startsWith('#session=')) {
      const ownerToken = hash.replace('#session=', '').trim();
      if (ownerToken) {
        setTokenA(ownerToken);
        setActivePartner('a');
        loadSessionData(ownerToken, 'a');
      }
    }
  }, []);

  // Partner A: move on by themselves once the partner has answered.
  useEffect(() => {
    if (view !== 'invite' || !tokenA) return undefined;
    let cancelled = false;
    const check = async () => {
      try {
        const summary = await api.getMatchSummary(tokenA);
        if (!cancelled && summary.ready) {
          setMatchSummary(summary);
          setView('match');
        }
      } catch {
        // keep waiting quietly
      }
    };
    const id = window.setInterval(check, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [view, tokenA]);

  // Partner B: show the plan as soon as Partner A has made it.
  useEffect(() => {
    if (view !== 'match' || activePartner !== 'b' || !matchSummary?.ready || !tokenB) return undefined;
    let cancelled = false;
    const check = async () => {
      try {
        const s = await api.getSession(tokenB);
        if (!cancelled && s.has_plan) {
          const current = await api.getCurrentPlan(tokenB);
          if (cancelled) return;
          setPlans(current);
          setSelectedPlanIndex(0);
          setView('plans');
        }
      } catch {
        // keep waiting quietly
      }
    };
    const id = window.setInterval(check, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [view, activePartner, matchSummary?.ready, tokenB]);

  // Live drive times belong to the plan being looked at.
  useEffect(() => {
    if (view !== 'plans') return undefined;
    const token = activePartner === 'a' ? tokenA : tokenB;
    if (!token) return undefined;
    let cancelled = false;
    setLiveRoutes(null);
    api.getLiveRoutes(token, selectedPlanIndex)
      .then((routes) => { if (!cancelled) setLiveRoutes(routes); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [view, selectedPlanIndex, activePartner, tokenA, tokenB]);

  // Partner A and Partner B commonly complete this flow on different devices.
  // Keep the waiting screen in sync with the server instead of relying on the
  // stale session snapshot captured when the page first loaded.
  useEffect(() => {
    if (view !== 'match' || matchSummary?.ready) return undefined;

    const currentToken = activePartner === 'a' ? tokenA : tokenB;
    if (!currentToken) return undefined;

    let cancelled = false;
    const refresh = async () => {
      try {
        const summary = await api.getMatchSummary(currentToken);
        if (cancelled) return;
        setMatchSummary(summary);
        setMatchRefreshError('');
        if (summary.ready) {
          setSession((current) => current ? {
            ...current,
            both_submitted: true,
            partner_taste_submitted: true,
          } : current);
        }
      } catch (err) {
        if (!cancelled) {
          setMatchRefreshError(err.message || 'Could not refresh partner status.');
        }
      }
    };

    refresh();
    const pollId = window.setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [view, matchSummary?.ready, activePartner, tokenA, tokenB]);

  const loadSessionData = async (token, partner) => {
    try {
      const s = await api.getSession(token);
      setSession(s);
      const sessionMode = s.mode === 'solo' ? 'solo' : 'together';
      setMode(sessionMode);
      if (sessionMode === 'together' && partner === 'a' && s.token_b) setTokenB(s.token_b);
      if (sessionMode === 'solo' && !s.has_plan) {
        setView('start');
      } else if (s.has_plan) {
        const curPlans = await api.getCurrentPlan(token);
        setPlans(curPlans);
        setSelectedPlanIndex(0);
        setRainPlanIndex(null);
        setView('plans');
      } else if (s.both_submitted) {
        const summary = await api.getMatchSummary(token);
        setMatchSummary(summary);
        setView('match');
      } else if (s.my_taste_submitted) {
        setView(partner === 'a' ? 'invite' : 'match');
      } else {
        setView(partner === 'b' ? 'limits' : 'taste');
      }
    } catch {
      // ignore
    }
  };

  // Solo: quick inputs straight to plans (no quiz first).
  const handleQuickPlan = async (payload) => {
    const res = await api.quickPlan(payload);
    setMode('solo');
    setTokenA(res.token);
    setTokenB('');
    setActivePartner('a');
    setSession(res.session);
    setQuickRequest(payload);
    setPlans(res.plans);
    setSelectedPlanIndex(0);
    setRainPlanIndex(null);
    setRainTriggerNote('');
    setLiveWeather(null);
    window.history.replaceState(null, '', `#session=${res.token}`);
    setView('plans');
    if (res.session?.date) {
      api.getWeather(res.session.city, res.session.date).then(setLiveWeather).catch(() => setLiveWeather(null));
    }
  };

  // "Make it more personal": same inputs plus the answers about them and about you.
  const handleReplan = async (answers) => {
    const base = quickRequest || {
      city: session?.city || 'Chennai',
      budget_inr: session?.budget_inr || 2000,
      vibes: session?.vibes || [],
      date: session?.date,
      time_start: session?.time_start || '16:00',
      start_area: session?.start_area || 'City centre',
    };
    await handleQuickPlan({ ...base, ...answers });
  };

  const startTogether = () => {
    setMode('together');
    setView('setup');
  };

  const handleSessionCreated = async (payload) => {
    const res = await api.createSession(payload);
    setTokenA(res.token_a);
    setTokenB(res.token_b);
    // Keep what was entered (date, times, city…) alongside the server's reply.
    setSession({ ...payload, ...res, my_taste_submitted: false });
    setActivePartner('a');
    window.history.replaceState(null, '', `#session=${res.token_a}`);
    setView('taste'); // Partner A enters their taste first
  };

  const handleTasteExtracted = (card) => {
    if (activePartner === 'a') {
      setCandidateCardA(card);
    } else {
      setCandidateCardB(card);
    }
    setView('review');
  };

  const handleTasteConfirmed = async (card) => {
    const currentToken = activePartner === 'a' ? tokenA : tokenB;
    if (activePartner === 'a') {
      setConfirmedCardA(card);
      setView('invite'); // Show share link for Partner B
    } else {
      setConfirmedCardB(card);
      // Both might be submitted now, fetch match summary
      try {
        const summary = await api.getMatchSummary(currentToken);
        setMatchSummary(summary);
        setView('match');
      } catch {
        setView('match');
      }
    }
  };

  const handleSwitchToPartnerB = async () => {
    if (!tokenB) return;
    setActivePartner('b');
    setRainPlanIndex(null);
    await loadSessionData(tokenB, 'b');
  };

  const handleSwitchToPartnerA = async () => {
    if (!tokenA) return;
    setActivePartner('a');
    setRainPlanIndex(null);
    await loadSessionData(tokenA, 'a');
  };

  const fetchMatchSummary = async (token) => {
    if (!token) return null;
    setRefreshingMatch(true);
    try {
      const summary = await api.getMatchSummary(token);
      setMatchSummary(summary);
      setMatchRefreshError('');
      if (summary.ready) {
        setSession((current) => current ? {
          ...current,
          both_submitted: true,
          partner_taste_submitted: true,
        } : current);
      }
      return summary;
    } catch (err) {
      setMatchRefreshError(err.message || 'Could not refresh partner status.');
      return null;
    } finally {
      setRefreshingMatch(false);
    }
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      const generated = await api.generatePlan(tokenA);
      setPlans(generated);
      setSelectedPlanIndex(0);
      setRainPlanIndex(null);
      setView('plans');
      const city = session?.city || 'Chennai';
      if (session?.date) {
        api.getWeather(city, session.date).then(setLiveWeather).catch(() => setLiveWeather(null));
      }
    } catch (err) {
      alert(err.message || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleRainToggle = async (planIndex) => {
    const currentToken = activePartner === 'a' ? tokenA : tokenB;
    try {
      // Always start from the saved (dry) plans, so only one plan is ever swapped.
      const originalPlans = await api.getCurrentPlan(currentToken);
      if (rainPlanIndex === planIndex) {
        setPlans(originalPlans);
        setRainPlanIndex(null);
        setRainTriggerNote('');
        return;
      }
      const res = await api.triggerRainMode(currentToken, planIndex);
      const updated = [...originalPlans];
      updated[planIndex] = res.rain_plan;
      setPlans(updated);
      setRainPlanIndex(planIndex);
      setRainTriggerNote(res.trigger_note);
    } catch (err) {
      alert(err.message || 'Could not make a rain plan');
    }
  };

  const handleSwapClick = (planIndex, stopIndex) => {
    const currentPlan = plans[planIndex];
    if (currentPlan && currentPlan.stops[stopIndex]) {
      setSwapTarget({
        planIndex,
        stopIndex,
        stop: currentPlan.stops[stopIndex],
      });
    }
  };

  const handleSwapApplied = (planIndex, updatedPlan) => {
    const newPlans = [...plans];
    newPlans[planIndex] = updatedPlan;
    setPlans(newPlans);
  };

  const resetAll = () => {
    setSession(null);
    setTokenA('');
    setTokenB('');
    setCandidateCardA(null);
    setCandidateCardB(null);
    setConfirmedCardA(null);
    setConfirmedCardB(null);
    setMatchSummary(null);
    setPlans([]);
    setSelectedPlanIndex(0);
    setRainPlanIndex(null);
    setRainTriggerNote('');
    setLiveWeather(null);
    setLiveRoutes(null);
    setSwapTarget(null);
    setShowRatingModal(false);
    setMatchRefreshError('');
    setGenerating(false);
    setActivePartner('a');
    setMode('solo');
    setQuickRequest(null);
    setView('start');
    window.history.replaceState(null, '', window.location.pathname);
  };

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-40 bg-cream/95 border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={() => {
              playIntro();
              if (tokenA || tokenB) window.scrollTo({ top: 0, behavior: 'smooth' });
              else setView(mode === 'together' ? 'setup' : 'start');
            }}
            className="flex min-h-11 items-center gap-3 text-left"
          >
            <span className="brand-mark" aria-hidden="true">d.</span>
            <span>
              <span className="block font-serif text-xl leading-none tracking-tight">DatePilot</span>
              <span className="mt-1 hidden text-xs tracking-[0.12em] text-ink-3 uppercase sm:block">A little more together</span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            {/* Demo shortcut: preview the partner's private side on this device */}
            {mode === 'together' && tokenA && tokenB && activePartner === 'a' && (
              <button type="button" onClick={handleSwitchToPartnerB} className="dp-btn-quiet px-3 text-sm">
                <Users size={18} strokeWidth={1.5} aria-hidden="true" />
                <span className="hidden sm:inline">See partner&rsquo;s side</span>
                <span className="sm:hidden">Partner</span>
              </button>
            )}

            {tokenA && (
              <button type="button" onClick={resetAll} className="dp-btn-quiet px-3" aria-label="Start a new date">
                <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
                <span className="hidden sm:inline">New date</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {isDemoPartner && (
        <div className="border-b border-line bg-well">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-6">
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Eye size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" aria-hidden="true" />
              You&rsquo;re previewing your partner&rsquo;s side. Normally this happens on their own phone.
            </p>
            <button type="button" onClick={handleSwitchToPartnerA} className="dp-btn px-0 text-sm text-accent underline underline-offset-4 hover:text-accent-deep">
              Back to your side
            </button>
          </div>
        </div>
      )}

      {view === 'start' && (
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-8 md:px-6 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-14 lg:pb-16">
          <div className="animate-enter">
            <p className="flex items-center gap-2 dp-eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-soft" aria-hidden="true" />
              Dates on any budget · India
            </p>
            <h1 className="mt-5 text-[44px] leading-[1.04] md:text-[52px] lg:text-[68px]">
              Less planning.{' '}<br className="hidden sm:block" />
              More <em className="text-accent-soft">butterflies.</em>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-2 md:text-lg">
              A fresh, impressive date within your budget. Never the same date twice.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-3">
              <li className="flex items-center gap-2"><Wallet size={16} strokeWidth={1.5} aria-hidden="true" />Never over budget</li>
              <li className="flex items-center gap-2"><MapPin size={16} strokeWidth={1.5} aria-hidden="true" />Real local places</li>
              <li className="flex items-center gap-2"><Sparkles size={16} strokeWidth={1.5} aria-hidden="true" />Ready in seconds</li>
            </ul>
          <div ref={heroTiltRef} className="tilt date-preview mt-10 hidden w-full max-w-sm animate-enter lg:block" aria-label="Example date">
            <div className="preview-top"><span>A DAY WORTH KEEPING</span><span>01 / 03</span></div>
            <div className="preview-art" aria-hidden="true">
              <div className="sun-disc hero-sun" />
              <div className="arch arch-one hero-arch-1" />
              <div className="arch arch-two hero-arch-2" />
              <svg className="hero-birds" width="46" height="20" viewBox="0 0 46 20" fill="none" stroke="#3d3027" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8 l6 5 l6 -5" /><path d="M26 3 l5 4 l5 -4" />
              </svg>
              <span className="art-caption hero-caption">the good kind of<br /><em>getting lost.</em></span>
            </div>
            <div className="preview-bottom">
              <div>
                <span className="mb-1.5 block text-xs tracking-[0.12em] text-ink-3">YOUR NEXT CHAPTER</span>
                <strong className="font-serif text-lg font-normal">Coffee. A walk. You two.</strong>
              </div>
              <ArrowUpRight size={22} strokeWidth={1.5} aria-hidden="true" />
            </div>
          </div>
          </div>

          <QuickStart onPlan={handleQuickPlan} onPlanTogether={startTogether} />

        </section>
      )}

      {mode === 'together' && (
      <nav aria-label="Planning progress" className="mx-auto max-w-2xl px-4 pt-8 md:px-6 md:pt-10">
        {(() => {
          const steps = [
            { label: 'Set the day', views: ['setup'], note: 'You choose the date, time, budget and where you start.' },
            { label: 'Share tastes', views: ['taste', 'review', 'limits', 'invite'], note: 'You and your partner each answer privately. Neither of you sees the other\u2019s answers.' },
            { label: 'Your plans', views: ['match', 'plans'], note: 'We find what you share and build three plans that fit both of you.' },
          ];
          const currentIndex = Math.max(0, steps.findIndex((st) => st.views.includes(view)));
          return (
            <div>
              <ol className="relative grid grid-cols-3">
                <span className="absolute left-[16.66%] right-[16.66%] top-[15px] h-px bg-line" aria-hidden="true" />
                <span
                  className="step-progress absolute left-[16.66%] top-[15px] h-px bg-accent-soft"
                  style={{ width: `${(currentIndex / (steps.length - 1)) * 66.66}%` }}
                  aria-hidden="true"
                />
                {steps.map((st, i) => {
                  const current = i === currentIndex;
                  const done = i < currentIndex;
                  return (
                    <li key={st.label} aria-current={current ? 'step' : undefined} className="relative flex flex-col items-center gap-2 text-center">
                      <span className={`grid h-8 w-8 place-items-center rounded-full border text-sm transition-colors duration-300 ${
                        current ? 'border-accent bg-accent text-white' : done ? 'border-accent-soft bg-paper text-accent' : 'border-line bg-cream text-ink-3'
                      }`}>
                        {done ? <Check size={15} strokeWidth={2} aria-hidden="true" /> : i + 1}
                      </span>
                      <span className={`text-sm ${current ? 'text-ink' : done ? 'text-ink-2' : 'text-ink-3'}`}>{st.label}</span>
                    </li>
                  );
                })}
              </ol>
              <p key={currentIndex} className="mt-4 text-center text-sm text-ink-3 animate-enter">
                <span className="text-ink-2">Step {currentIndex + 1} of 3.</span> {steps[currentIndex].note}
              </p>
            </div>
          );
        })()}
      </nav>
      )}

      {/* Main App Flow */}
      {view !== 'start' && (
      <main ref={revealRef} className="mx-auto mt-8 max-w-7xl px-4 pb-16 md:px-6">
        <div className={view === 'plans' ? '' : 'min-[960px]:grid min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,42rem)_minmax(0,1fr)] min-[960px]:items-start min-[960px]:gap-6 min-[1180px]:grid-cols-[minmax(0,1fr)_42rem_minmax(0,1fr)] min-[1180px]:gap-8 xl:gap-10'}>
        {view !== 'plans' && (
          <aside className="hidden min-[960px]:sticky min-[960px]:top-28 min-[960px]:block">
            {/* 960–1179px: narrow gutter art; from 1180px: the postcards */}
            <GutterKolam className="min-[1180px]:hidden" />
            <div className="hidden min-[1180px]:block">
              <SideArtLeft />
            </div>
          </aside>
        )}
        <div className="min-w-0">
        {/* Solo: optional answers about their date and about you */}
        {view === 'personalize' && (
          <Personalize onReplan={handleReplan} onBack={() => setView('plans')} />
        )}

        {/* Together, step 1: Session Setup */}
        {view === 'setup' && (
          <div className="mx-auto max-w-2xl">
            <button type="button" onClick={() => { setMode('solo'); setView('start'); }} className="dp-btn -ml-2 mb-3 px-2 text-sm text-ink-2 hover:text-ink">
              <ArrowLeft size={18} strokeWidth={1.5} aria-hidden="true" />
              Plan on my own instead
            </button>
            <SessionSetup onSessionCreated={handleSessionCreated} />
          </div>
        )}

        {/* Step 2: Taste Profiler */}
        {view === 'limits' && (
          <PartnerLimits
            token={tokenB}
            session={session}
            onSaved={() => setView('taste')}
          />
        )}

        {view === 'taste' && (
          <TasteProfiler
            sessionToken={activePartner === 'a' ? tokenA : tokenB}
            partnerLabel={isDemoPartner ? 'demo' : 'you'}
            onTasteExtracted={handleTasteExtracted}
          />
        )}

        {/* Step 3: Consent-Based Taste Card Review */}
        {view === 'review' && (
          <TasteCardReview
            initialCard={activePartner === 'a' ? candidateCardA : candidateCardB}
            sessionToken={activePartner === 'a' ? tokenA : tokenB}
            partnerLabel={isDemoPartner ? 'demo' : 'you'}
            onConfirmed={handleTasteConfirmed}
            onDeleted={resetAll}
          />
        )}

        {/* Step 4: Partner Invite Link screen */}
        {view === 'invite' && (
          <div className="dp-screen mx-auto max-w-2xl space-y-4">
            <PartnerInvite
              tokenB={tokenB}
              onSwitchToPartnerB={handleSwitchToPartnerB}
            />
            {(confirmedCardA || session?.my_taste_submitted) && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    fetchMatchSummary(tokenA);
                    setView('match');
                  }}
                  className="dp-btn text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
                >
                  Check whether your partner has answered
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Anonymous Match Summary */}
        {view === 'match' && (
          <MatchSummary
            summary={matchSummary}
            onGeneratePlan={handleGeneratePlan}
            generating={generating}
            isPartnerA={activePartner === 'a'}
            partnerBSubmitted={Boolean(confirmedCardB || session?.partner_taste_submitted)}
            onRefresh={() => fetchMatchSummary(activePartner === 'a' ? tokenA : tokenB)}
            refreshing={refreshingMatch}
            refreshError={matchRefreshError}
          />
        )}

        {/* Step 6: Generated Plans Carousel & Stops Timeline */}
        {view === 'plans' && (
          <ItineraryViewer
            plans={plans}
            date={session?.date}
            onSwapClick={handleSwapClick}
            selectedPlanIndex={selectedPlanIndex}
            onSelectPlan={setSelectedPlanIndex}
            onRainToggle={handleRainToggle}
            onRateClick={() => setShowRatingModal(true)}
            rainPlanIndex={rainPlanIndex}
            rainTriggerNote={rainTriggerNote}
            liveWeather={liveWeather}
            liveRoutes={liveRoutes}
          />
        )}

        {view === 'plans' && mode === 'solo' && (
          <section className="mx-auto mt-8 flex max-w-5xl flex-col gap-4 rounded-2xl border border-line bg-well p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
            <div>
              <h3 className="text-2xl">Make it more personal</h3>
              <p className="mt-1 text-sm text-ink-2">Tell us what your date likes, and what you like. We&rsquo;ll re-plan around it.</p>
            </div>
            <button type="button" onClick={() => setView('personalize')} className="dp-btn-primary shrink-0">
              <Sparkles size={18} strokeWidth={1.5} aria-hidden="true" />
              Make it personal
            </button>
          </section>
        )}

        {/* Short steps leave a blank band above the footer */}
        {['limits', 'invite', 'match'].includes(view) && <TwoDotsMeet className="mt-10" />}
        </div>
        {view !== 'plans' && (
          <aside className="hidden min-[960px]:sticky min-[960px]:top-28 min-[960px]:block">
            <GutterPetals className="min-[1180px]:hidden" />
            <div className="hidden min-[1180px]:block">
              <SideArtRight />
            </div>
          </aside>
        )}
        </div>
      </main>
      )}
      <footer className="mx-auto max-w-6xl border-t border-line px-4 py-10 text-center md:px-6">
        <p className="font-serif text-xl">DatePilot</p>
        <p className="mt-2 text-sm text-ink-3">Good company. Thoughtful plans. Now planning in Chennai, Coimbatore and Madurai.</p>
      </footer>

      {introKey && <IntroOverlay key={introKey} onDone={() => setIntroKey(null)} />}

      {/* Stop Swap Diff Modal */}
      {swapTarget && (
        <SwapModal
          token={activePartner === 'a' ? tokenA : tokenB}
          planIndex={swapTarget.planIndex}
          stopIndex={swapTarget.stopIndex}
          stop={swapTarget.stop}
          onSwapApplied={handleSwapApplied}
          onClose={() => setSwapTarget(null)}
        />
      )}

      {/* Post-Date Rating Modal */}
      {showRatingModal && plans.length > 0 && (
        <RatingModal
          token={activePartner === 'a' ? tokenA : tokenB}
          stops={plans[selectedPlanIndex]?.stops || []}
          onClose={() => setShowRatingModal(false)}
        />
      )}
    </div>
  );
}
