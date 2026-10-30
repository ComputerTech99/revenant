import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowCounterClockwise,
  ArrowRight,
  BookOpen,
  Cards,
  ClockClockwise,
  FastForward,
  Lock,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  fetchDeckPath,
  resetTimewarp,
  timewarp,
} from '../api/client.js';

const EASE = [0.32, 0.72, 0, 1];

const REVEAL_PROPS = {
  initial: { y: 64, filter: 'blur(12px)', opacity: 0 },
  whileInView: { y: 0, filter: 'blur(0px)', opacity: 1 },
  viewport: { once: true, amount: 0.1 },
  transition: { duration: 0.8, ease: EASE },
};

function CrackOverlay({ heavy = false }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      <path
        d="M22 10L48 44L36 68L66 110"
        stroke="#EF4444"
        strokeWidth={heavy ? '2.5' : '1.75'}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={heavy ? '0.85' : '0.6'}
      />
      {heavy && (
        <>
          <path
            d="M48 44L84 32L104 54"
            stroke="#EF4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
          />
          <path
            d="M36 68L14 88"
            stroke="#EF4444"
            strokeWidth="1.75"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M92 14L72 56L96 96"
            stroke="#EF4444"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.65"
          />
        </>
      )}
    </svg>
  );
}

function getNodeVisualState(concept) {
  const health = concept.health;
  if (concept.status === 'new' || health === null || health === undefined) {
    return {
      tier: 'new',
      label: 'New · Locked',
      opacity: 0.65,
      badgeRing: 'border-dashed border-[#313131] bg-[#131209] text-[#9B9B9B]',
      cardBorder: 'border-dashed border-[#313131] bg-[#131209]',
      cracks: 'none',
      textAccent: 'text-[#9B9B9B]',
    };
  }
  if (health >= 0.85) {
    return {
      tier: 'solid',
      label: concept.status === 'mastered' ? 'Solid · Mastered' : 'Solid · Learning',
      opacity: 1,
      badgeRing:
        'border-amber-400 bg-[#272727] text-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.3)]',
      cardBorder:
        'border-amber-400/70 bg-[#1F1F1F] shadow-[0_0_24px_rgba(245,158,11,0.14)]',
      cracks: 'none',
      textAccent: 'text-amber-400',
    };
  }
  if (health >= 0.7) {
    return {
      tier: 'faded',
      label: 'Slightly faded · Learning',
      opacity: 0.85,
      badgeRing: 'border-amber-400/40 bg-[#272727] text-[#EDEDED]',
      cardBorder: 'border-[#313131] bg-[#1F1F1F]',
      cracks: 'none',
      textAccent: 'text-[#EDEDED]',
    };
  }
  if (health >= 0.5) {
    return {
      tier: 'cracked',
      label: 'Cracked · Shaky',
      opacity: 0.75,
      badgeRing:
        'border-red-500/70 bg-[#1F1F1F] text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.2)]',
      cardBorder: 'border-red-500/50 bg-[#1F1F1F]',
      cracks: 'light',
      textAccent: 'text-red-400',
    };
  }
  return {
    tier: 'ghostly',
    label: 'Heavily cracked · Ghostly',
    opacity: 0.5,
    badgeRing:
      'border-red-500 bg-[#131209] text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.25)]',
    cardBorder: 'border-red-500/80 bg-[#1F1F1F]',
    cracks: 'heavy',
    textAccent: 'text-red-400',
  };
}

function formatNextDue(concept, nowIso) {
  if (concept.status === 'new' || concept.health === null || concept.health === undefined || !concept.next_due) {
    return 'Unscheduled';
  }
  const refMs = nowIso ? new Date(nowIso).getTime() : Date.now();
  const dueMs = new Date(concept.next_due).getTime();
  if (Number.isNaN(dueMs)) return 'Due now';
  const diffDays = Math.ceil((dueMs - refMs) / 86400000);
  if (diffDays <= 0 || concept.health < 0.7) return 'Due now';
  return `Due in ${diffDays}d`;
}

function PathSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 py-4" aria-label="Loading concept path">
      {[0, 1, 2, 3].map((idx) => (
        <div
          key={idx}
          className="w-full max-w-xl rounded-2xl bg-[#1F1F1F] border border-[#313131] p-4 flex items-center gap-4 animate-pulse"
        >
          <div className="w-16 h-16 rounded-full bg-[#272727] shrink-0" />
          <div className="flex flex-col gap-2 w-full">
            <div className="h-5 w-44 rounded bg-[#272727]" />
            <div className="h-3 w-28 rounded bg-[#272727]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PathPage({ decks, stats, onRefreshAll }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDeckId = searchParams.get('deck_id') || decks?.[0]?.deck_id || '';
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId);
  const [concepts, setConcepts] = useState([]);
  const [selectedConceptId, setSelectedConceptId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warping, setWarping] = useState(false);
  const [warpedDays, setWarpedDays] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const paramDeck = searchParams.get('deck_id');
    if (paramDeck) {
      setSelectedDeckId(paramDeck);
    } else if (decks?.length > 0 && (!selectedDeckId || !decks.some((d) => d.deck_id === selectedDeckId))) {
      setSelectedDeckId(decks[0].deck_id);
    }
  }, [decks, searchParams, selectedDeckId]);

  const loadPath = useCallback(async (targetDeckId, showSkeleton = true) => {
    if (!targetDeckId) return;
    if (showSkeleton) {
      setLoading(true);
    }
    setError('');
    try {
      const data = await fetchDeckPath(targetDeckId);
      setConcepts(data || []);
      setSelectedConceptId((prev) => {
        if (prev && (data || []).some((c) => c.id === prev)) return prev;
        return data?.[0]?.id || null;
      });
    } catch (err) {
      setError(err.message || 'Could not load concept path for this deck.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPath(selectedDeckId, true);
  }, [loadPath, selectedDeckId]);

  const handleSelectDeck = (deckId) => {
    setSelectedDeckId(deckId);
    setSearchParams({ deck_id: deckId });
  };

  const handleTimewarp = async (days) => {
    setWarping(true);
    setError('');
    try {
      await timewarp(days);
      setWarpedDays((prev) => prev + days);
      await loadPath(selectedDeckId, false);
      await onRefreshAll?.();
    } catch (err) {
      setError(err.message || 'Time travel request failed.');
    } finally {
      setWarping(false);
    }
  };

  const handleResetTimewarp = async () => {
    setWarping(true);
    setError('');
    try {
      await resetTimewarp();
      setWarpedDays(0);
      await loadPath(selectedDeckId, false);
      await onRefreshAll?.();
    } catch (err) {
      setError(err.message || 'Could not reset time offset.');
    } finally {
      setWarping(false);
    }
  };

  const formatClockDate = (isoString) => {
    if (!isoString) return 'Today';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return 'Today';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const serverOffsetDays = stats?.now
    ? Math.max(0, Math.round((new Date(stats.now).getTime() - Date.now()) / 86400000))
    : warpedDays;

  const selectedDeck = (decks || []).find((d) => d.deck_id === selectedDeckId) || null;
  const deckDueCards = selectedDeck?.due_count ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-10 flex flex-col gap-8">
      <motion.section {...REVEAL_PROPS} className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col gap-1 max-w-[680px]">
            <h1 className="text-3xl sm:text-4xl font-bold text-[#EDEDED] text-balance">
              Concept path
            </h1>
            <p className="text-sm sm:text-base text-[#9B9B9B] text-pretty">
              Nodes fade and crack as retention decays. Tap any concept to inspect its grounded summary and PDF pages.
            </p>
          </div>

          <div
            role="group"
            aria-label="Demo time travel controls"
            className="w-max rounded-full bg-[#1F1F1F] border border-[#313131] p-1 flex flex-wrap items-center gap-2 self-start"
          >
            <span className="inline-flex items-center gap-1 pl-3 pr-1 py-1 text-xs font-semibold text-amber-400">
              <ClockClockwise weight="bold" className="w-4 h-4" />
              <span>Demo: time travel</span>
              {serverOffsetDays > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#131209] border border-amber-400/50 font-mono text-xs">
                  +{serverOffsetDays}d
                </span>
              )}
            </span>

            <button
              type="button"
              disabled={warping}
              onClick={() => handleTimewarp(1)}
              className="px-3 py-1 rounded-full bg-[#272727] hover:bg-amber-400 hover:text-[#131209] border border-[#313131] font-mono text-xs font-semibold text-[#EDEDED] inline-flex items-center gap-1 transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
            >
              <FastForward weight="fill" className="w-3.5 h-3.5" />
              <span>+1 day</span>
            </button>

            <button
              type="button"
              disabled={warping}
              onClick={() => handleTimewarp(7)}
              className="px-3 py-1 rounded-full bg-[#272727] hover:bg-amber-400 hover:text-[#131209] border border-[#313131] font-mono text-xs font-semibold text-[#EDEDED] inline-flex items-center gap-1 transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
            >
              <FastForward weight="fill" className="w-3.5 h-3.5" />
              <span>+7 days</span>
            </button>

            <button
              type="button"
              disabled={warping}
              onClick={handleResetTimewarp}
              aria-label="Reset time travel offset"
              title="Reset time travel"
              className="px-2 py-1 rounded-full bg-[#131209] hover:bg-[#272727] border border-[#313131] text-xs font-semibold text-[#9B9B9B] hover:text-[#EDEDED] inline-flex items-center gap-1 transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
            >
              <ArrowCounterClockwise weight="bold" className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Select deck">
            {(decks || []).map((deck) => {
              const isSelected = deck.deck_id === selectedDeckId;
              return (
                <button
                  key={deck.deck_id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectDeck(deck.deck_id)}
                  className={`py-2 px-3 rounded-lg text-sm font-semibold border transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isSelected
                      ? 'bg-[#272727] border-amber-400 text-amber-400'
                      : 'bg-[#1F1F1F] border-[#313131] text-[#9B9B9B] hover:text-[#EDEDED] hover:bg-[#272727]'
                  }`}
                >
                  {deck.title}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#9B9B9B]">
            <span>
              Clock:{' '}
              <span className="font-mono font-semibold text-[#EDEDED]">
                {formatClockDate(stats?.now)}
              </span>
            </span>
            {deckDueCards > 0 && (
              <Link
                to={`/review?deck_id=${encodeURIComponent(selectedDeckId)}`}
                className="px-3 py-1 rounded-full bg-amber-400 text-[#131209] font-semibold inline-flex items-center gap-1 hover:bg-amber-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span>Review</span>
                <span className="font-mono">{deckDueCards}</span>
                <span>due</span>
                <ArrowRight weight="bold" className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </motion.section>

      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-[#1F1F1F] border border-red-500/50 p-4 flex items-center gap-3 text-sm text-red-400"
        >
          <WarningCircle weight="fill" className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <PathSkeleton />
      ) : concepts.length === 0 ? (
        <div className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-8 text-center flex flex-col items-center gap-3">
          <p className="text-base font-semibold text-[#EDEDED]">
            No concepts found for this deck
          </p>
          <Link
            to="/"
            className="py-2 px-3 rounded-lg bg-amber-400 text-[#131209] text-base font-semibold"
          >
            Return home
          </Link>
        </div>
      ) : (
        <section aria-label="Winding concept path" className="relative py-4">
          <div
            className="hidden sm:block absolute left-1/2 top-8 bottom-8 w-0.5 bg-[#313131] -translate-x-1/2 pointer-events-none"
            aria-hidden="true"
          />

          <div className="flex flex-col gap-6 relative z-10">
            {concepts.map((concept, index) => {
              const visual = getNodeVisualState(concept);
              const dueLabel = formatNextDue(concept, stats?.now);
              const isExpanded = selectedConceptId === concept.id;
              const healthPct =
                concept.health !== null && concept.health !== undefined
                  ? `${Math.round(concept.health * 100)}%`
                  : 'New';

              const windingAlign =
                index % 3 === 0
                  ? 'sm:self-start sm:ml-8'
                  : index % 3 === 1
                    ? 'sm:self-center'
                    : 'sm:self-end sm:mr-8';

              return (
                <motion.div
                  key={concept.id}
                  layout
                  initial={{ opacity: 0, y: 32 }}
                  animate={{
                    opacity: visual.opacity,
                    y: 0,
                    scale: 1,
                  }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className={`w-full sm:max-w-xl ${windingAlign}`}
                >
                  <div
                    className={`rounded-2xl border p-2 transition-all duration-300 ${visual.cardBorder}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedConceptId((prev) => (prev === concept.id ? null : concept.id))
                      }
                      aria-expanded={isExpanded}
                      className="w-full rounded-lg bg-[#272727] hover:bg-[#313131]/60 p-4 text-left flex items-center gap-4 transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 relative overflow-hidden"
                    >
                      <div
                        className={`relative w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center shrink-0 overflow-hidden transition-all duration-300 ${visual.badgeRing}`}
                      >
                        {visual.cracks === 'light' && <CrackOverlay heavy={false} />}
                        {visual.cracks === 'heavy' && <CrackOverlay heavy={true} />}

                        {visual.tier === 'new' ? (
                          <Lock weight="bold" className="w-6 h-6" />
                        ) : (
                          <>
                            <span className="font-mono text-sm font-bold">{healthPct}</span>
                            <span className="text-xs opacity-80">health</span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`text-xs font-semibold ${visual.textAccent}`}>
                            {visual.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#131209] border border-[#313131] font-mono text-xs text-[#9B9B9B]">
                            {concept.card_count} cards
                          </span>
                        </div>

                        <h2 className="text-lg font-bold text-[#EDEDED] text-balance">
                          {concept.name}
                        </h2>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#9B9B9B]">
                          <span>
                            Pages{' '}
                            <span className="font-mono text-[#EDEDED]">
                              {(concept.pages || []).join(', ')}
                            </span>
                          </span>
                          <span>·</span>
                          <span className="font-mono">{dueLabel}</span>
                        </div>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-lg bg-[#131209] border border-[#313131] mt-2 p-4 flex flex-col gap-4">
                            <p className="text-sm text-[#EDEDED] text-pretty leading-relaxed">
                              {concept.summary}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {(concept.pages || []).map((pageNumber) => (
                                  <span
                                    key={pageNumber}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1F1F1F] border border-[#313131] text-xs text-[#9B9B9B]"
                                  >
                                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                                    <span>
                                      Page <span className="font-mono text-[#EDEDED]">{pageNumber}</span>
                                    </span>
                                  </span>
                                ))}
                              </div>

                              <Link
                                to={`/review?deck_id=${encodeURIComponent(concept.deck_id)}`}
                                className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#131209] text-sm font-semibold inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              >
                                <Cards weight="bold" className="w-4 h-4" />
                                <span>Review concept</span>
                                <ArrowRight weight="bold" className="w-4 h-4" />
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
