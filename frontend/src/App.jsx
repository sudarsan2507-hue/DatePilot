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

export default function App() {
  // Session state
  const [session, setSession] = useState(null);
  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [activePartner, setActivePartner] = useState('a'); // 'a' or 'b'
  
  // App views: 'setup' | 'limits' | 'invite' | 'taste' | 'review' | 'match' | 'plans'
  const [view, setView] = useState('setup');

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
  const [rainModeActive, setRainModeActive] = useState(false);
  const [rainTriggerNote, setRainTriggerNote] = useState('');
  const [liveWeather, setLiveWeather] = useState(null);
  const [liveRoutes, setLiveRoutes] = useState(null);

  // Modals state
  const [swapTarget, setSwapTarget] = useState(null); // { planIndex, stopIndex, stop }
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Check URL hash for partner B invite link (e.g. /#invite=token_b)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#invite=')) {
      const inviteToken = hash.replace('#invite=', '').trim();
      if (inviteToken) {
        setTokenB(inviteToken);
        setActivePartner('b');
        loadSessionData(inviteToken, 'b');
      }
    }
  }, []);

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
      if (s.has_plan) {
        const curPlans = await api.getCurrentPlan(token);
        setPlans(curPlans);
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

  const handleSessionCreated = async (payload) => {
    const res = await api.createSession(payload);
    setTokenA(res.token_a);
    setTokenB(res.token_b);
    setSession(res);
    setActivePartner('a');
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
    await loadSessionData(tokenB, 'b');
  };

  const handleSwitchToPartnerA = async () => {
    if (!tokenA) return;
    setActivePartner('a');
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
      const city = session?.city || 'Chennai';
      const forecastDate = session?.date;
      const [weatherResult, routesResult] = await Promise.allSettled([
        forecastDate ? api.getWeather(city, forecastDate) : Promise.reject(new Error('No forecast date')),
        api.getLiveRoutes(tokenA, 0),
      ]);
      setLiveWeather(weatherResult.status === 'fulfilled' ? weatherResult.value : null);
      setLiveRoutes(routesResult.status === 'fulfilled' ? routesResult.value : null);
      setView('plans');
    } catch (err) {
      alert(err.message || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleRainToggle = async (planIndex) => {
    if (rainModeActive) {
      // Toggle back to original plans
      const currentToken = activePartner === 'a' ? tokenA : tokenB;
      const originalPlans = await api.getCurrentPlan(currentToken);
      setPlans(originalPlans);
      setRainModeActive(false);
      setRainTriggerNote('');
    } else {
      const currentToken = activePartner === 'a' ? tokenA : tokenB;
      try {
        const res = await api.triggerRainMode(currentToken, planIndex);
        const updated = [...plans];
        updated[planIndex] = res.rain_plan;
        setPlans(updated);
        setRainModeActive(true);
        setRainTriggerNote(res.trigger_note);
      } catch (err) {
        alert(err.message || 'Failed to engage rain mode');
      }
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
    setLiveWeather(null);
    setLiveRoutes(null);
    setView('setup');
    window.location.hash = '';
  };

  return (
    <div className="datepilot-shell min-h-screen text-warm-900 pb-16">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-rose-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('setup')}>
            <span className="brand-mark" aria-hidden="true">d.</span>
            <div>
              <h1 className="text-lg font-serif font-bold text-warm-900 tracking-tight leading-none">
                DatePilot
              </h1>
              <span className="text-[10px] text-warm-500 uppercase tracking-widest block font-medium">
                A little more together
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Demo Switcher between Partner A and B */}
            {tokenA && tokenB && (
              <div className="hidden sm:flex items-center bg-warm-100 rounded-lg p-0.5 text-[11px]">
                <button
                  onClick={handleSwitchToPartnerA}
                  className={`px-2 py-1 rounded-md transition-all ${
                    activePartner === 'a' ? 'bg-white shadow-xs font-semibold text-rose-600' : 'text-warm-600'
                  }`}
                >
                  Partner A View
                </button>
                <button
                  onClick={handleSwitchToPartnerB}
                  className={`px-2 py-1 rounded-md transition-all ${
                    activePartner === 'b' ? 'bg-white shadow-xs font-semibold text-rose-600' : 'text-warm-600'
                  }`}
                >
                  Partner B View
                </button>
              </div>
            )}

            {tokenA && (
              <button
                onClick={resetAll}
                className="text-xs text-warm-500 hover:text-rose-600 px-2.5 py-1 rounded-lg border border-warm-200 hover:border-rose-200 bg-white"
              >
                + New Date
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Subheader */}
      <section className={`editorial-hero ${view === 'setup' ? '' : 'editorial-hero--compact'}`}>
        <div className="hero-copy">
          <div className="hero-eyebrow"><span className="status-dot" /> MADE FOR TWO · INDIA</div>
          <h2>Less planning.<br />More <em> butterflies.</em></h2>
          <p>Two tastes. One lovely day. Find the places you’ll both love, with every little detail taken care of.</p>
          <div className="hero-assurances"><span>↗ Thoughtful local places</span><span>♡ Your preferences stay private</span></div>
        </div>
        {view === 'setup' && <div className="date-preview" aria-label="Example date inspiration">
          <div className="preview-top"><span>A DAY WORTH KEEPING</span><span>01 / 03</span></div>
          <div className="preview-art" aria-hidden="true"><div className="sun-disc" /><div className="arch arch-one" /><div className="arch arch-two" /><span className="art-caption">the good kind of<br /><em>getting lost.</em></span></div>
          <div className="preview-bottom"><div><span>YOUR NEXT CHAPTER</span><strong>Coffee. A walk. You two.</strong></div><span className="preview-arrow">↗</span></div>
        </div>}
      </section>
      <nav className="journey-steps" aria-label="Planning progress">
        {[['01', 'Your day', ['setup']], ['02', 'Your tastes', ['taste', 'review', 'limits', 'invite']], ['03', 'Your together', ['match', 'plans']]].map(([number, label, views]) => <div key={number} className={views.includes(view) ? 'journey-step is-current' : 'journey-step'}><span>{number}</span>{label}</div>)}
      </nav>

      {/* Main App Flow */}
      <main className="planner-content max-w-3xl mx-auto px-4 mt-2">
        {/* Step 1: Session Setup */}
        {view === 'setup' && (
          <SessionSetup onSessionCreated={handleSessionCreated} />
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
            partnerLabel={activePartner === 'a' ? 'Partner A' : 'Partner B'}
            onTasteExtracted={handleTasteExtracted}
          />
        )}

        {/* Step 3: Consent-Based Taste Card Review */}
        {view === 'review' && (
          <TasteCardReview
            initialCard={activePartner === 'a' ? candidateCardA : candidateCardB}
            sessionToken={activePartner === 'a' ? tokenA : tokenB}
            partnerLabel={activePartner === 'a' ? 'Partner A' : 'Partner B'}
            onConfirmed={handleTasteConfirmed}
            onDeleted={resetAll}
          />
        )}

        {/* Step 4: Partner Invite Link screen */}
        {view === 'invite' && (
          <div className="space-y-4">
            <PartnerInvite
              sessionData={session}
              onSwitchToPartnerB={handleSwitchToPartnerB}
            />
            {confirmedCardA && (
              <div className="text-center">
                <button
                  onClick={() => {
                    fetchMatchSummary(tokenA);
                    setView('match');
                  }}
                  className="text-xs text-warm-500 hover:text-warm-800 underline underline-offset-2"
                >
                  Check if partner has submitted yet →
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
            onSwapClick={handleSwapClick}
            onRainToggle={handleRainToggle}
            onRateClick={() => setShowRatingModal(true)}
            rainModeActive={rainModeActive}
            rainTriggerNote={rainTriggerNote}
            liveWeather={liveWeather}
            liveRoutes={liveRoutes}
          />
        )}
      </main>
      <footer className="site-footer"><span>DatePilot</span><p>Good company. Thoughtful plans. A day that feels like you.</p><small>India · Currently exploring Chennai, Coimbatore & Madurai</small></footer>

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
          stops={plans[0]?.stops || []}
          onClose={() => setShowRatingModal(false)}
        />
      )}
    </div>
  );
}
