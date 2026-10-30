import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Cards,
  CheckCircle,
  FilePdf,
  Flame,
  Graph,
  Lightning,
  Snowflake,
  UploadSimple,
  WarningCircle,
} from '@phosphor-icons/react';
import { fetchDeck, uploadDeck } from '../api/client.js';
import GhostMascot from '../components/GhostMascot.jsx';

const EASE = [0.32, 0.72, 0, 1];
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const REVEAL_PROPS = {
  initial: { y: 64, filter: 'blur(12px)', opacity: 0 },
  whileInView: { y: 0, filter: 'blur(0px)', opacity: 1 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.8, ease: EASE },
};

function GoalProgressRing({ xpToday = 0, reviewsToday = 0, dailyGoal = 15, goalMet = false }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const targetXp = dailyGoal * 10;
  const fraction = Math.min(1, Math.max(reviewsToday / Math.max(1, dailyGoal), xpToday / Math.max(10, targetXp)));
  const dashOffset = circumference * (1 - fraction);

  return (
    <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 104 104" aria-hidden="true">
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke="#313131"
          strokeWidth="8"
        />
        <motion.circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke="#F59E0B"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-0.5 text-amber-400">
          <Lightning weight="fill" className="w-4 h-4" />
          <span className="font-mono text-lg font-bold text-[#EDEDED]">{xpToday}</span>
        </div>
        <span className="font-mono text-xs text-[#9B9B9B]">
          {reviewsToday}/{dailyGoal}
        </span>
        {goalMet && (
          <span className="text-xs font-semibold text-amber-400">Met</span>
        )}
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" aria-label="Loading statistics">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2 animate-pulse"
        >
          <div className="rounded-lg bg-[#272727] p-4 flex items-center justify-between gap-4 h-32">
            <div className="flex flex-col gap-3 w-full">
              <div className="h-4 w-24 rounded bg-[#313131]" />
              <div className="h-8 w-20 rounded bg-[#313131]" />
              <div className="h-3 w-36 rounded bg-[#313131]" />
            </div>
            <div className="w-20 h-20 rounded-full bg-[#313131] shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DecksSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Loading decks">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2 animate-pulse"
        >
          <div className="rounded-lg bg-[#272727] p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="h-6 w-48 rounded bg-[#313131]" />
              <div className="h-6 w-16 rounded-full bg-[#313131]" />
            </div>
            <div className="h-3 w-40 rounded bg-[#313131]" />
            <div className="h-2 w-full rounded-full bg-[#313131]" />
            <div className="flex items-center gap-2 pt-2">
              <div className="h-10 w-36 rounded-lg bg-[#313131]" />
              <div className="h-10 w-32 rounded-lg bg-[#313131]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage({
  stats,
  decks,
  loading,
  error,
  onDecksChange,
  onOpenOnboarding,
}) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const processingDecks = (decks || []).filter((d) => d.status === 'processing');
    if (processingDecks.length === 0) return undefined;

    const timer = setInterval(async () => {
      try {
        const updatedList = await Promise.all(
          decks.map(async (deck) => {
            if (deck.status !== 'processing') return deck;
            return fetchDeck(deck.deck_id);
          })
        );
        onDecksChange(updatedList);
      } catch {
        // Keep polling quietly on next interval
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [decks, onDecksChange]);

  const validateAndUpload = async (file) => {
    setUploadError('');
    if (!file) return;

    const isPdfName = file.name && file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === '';

    if (!isPdfName || !isPdfMime) {
      setUploadError('Only PDF files are supported. Choose a document ending in .pdf.');
      return;
    }

    if (file.size === 0) {
      setUploadError('The selected PDF file is empty. Choose a valid lecture document.');
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      setUploadError('File exceeds the 20 MB limit. Upload a smaller lecture PDF.');
      return;
    }

    setUploading(true);
    try {
      const createdDeck = await uploadDeck(file);
      onDecksChange([createdDeck, ...(decks || []).filter((d) => d.deck_id !== createdDeck.deck_id)]);
    } catch (err) {
      setUploadError(err.message || 'Could not upload this PDF.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndUpload(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      validateAndUpload(file);
    }
  };

  const totalDue = (decks || []).reduce((acc, d) => acc + (d.due_count || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-10 flex flex-col gap-12">
      <motion.section {...REVEAL_PROPS} aria-labelledby="home-heading" className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="flex flex-col gap-4 max-w-[680px]">
            <div className="inline-flex items-center gap-2 w-max px-3 py-1 rounded-full bg-[#1F1F1F] border border-[#313131] text-xs font-semibold text-[#9B9B9B]">
              <span>Local Gemma · SM2 spaced repetition</span>
            </div>

            <h1
              id="home-heading"
              className="heading-gradient text-4xl sm:text-5xl font-bold tracking-tight leading-tight text-balance max-w-[680px]"
            >
              Notes that come back
              <br />
              to haunt you, on schedule.
            </h1>

            <p className="text-base sm:text-lg text-[#9B9B9B] text-pretty max-w-[680px]">
              Upload any lecture PDF. Revenant extracts core concepts, grounds every question in an exact page snippet,
              and schedules reviews right before memory decays.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/review"
                className={`py-2 px-3 rounded-lg text-base font-semibold inline-flex items-center gap-2 transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  totalDue > 0
                    ? 'bg-amber-400 text-[#131209] hover:bg-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.25)]'
                    : 'bg-[#272727] text-[#EDEDED] border border-[#313131] hover:bg-[#313131]'
                }`}
              >
                <Cards weight="bold" className="w-5 h-5" />
                <span>Start review session</span>
                <span className="px-2 py-0.5 rounded-full bg-[#131209]/20 font-mono text-sm">
                  {totalDue}
                </span>
              </Link>

              <Link
                to="/path"
                className="py-2 px-3 rounded-lg bg-[#1F1F1F] hover:bg-[#272727] border border-[#313131] text-base font-semibold text-[#EDEDED] inline-flex items-center gap-2 transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Graph weight="bold" className="w-5 h-5 text-amber-400" />
                <span>Explore concept path</span>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2 self-start lg:self-center">
            <div className="rounded-lg bg-[#272727] p-6 flex flex-col items-center text-center gap-3 w-full sm:w-64">
              <GhostMascot
                streak={stats?.streak ?? 0}
                goalMet={Boolean(stats?.goal_met)}
                size="lg"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-[#EDEDED]">
                  {stats?.goal_met
                    ? 'Ghost solidified for today'
                    : (stats?.streak ?? 0) > 0
                      ? 'Ghost is waiting on your goal'
                      : 'Ghost is fading into mist'}
                </span>
                <span className="text-xs text-[#9B9B9B] text-pretty">
                  {stats?.goal_met
                    ? 'Daily target complete. Your streak is safe.'
                    : `Complete ${Math.max(0, (stats?.daily_goal ?? 15) - (stats?.reviews_today ?? 0))} more reviews to reach full opacity.`}
                </span>
              </div>
            </div>
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

      <motion.section {...REVEAL_PROPS} aria-label="Revision statistics">
        {loading && !stats ? (
          <StatsSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2">
              <div className="rounded-lg bg-[#272727] p-4 h-full flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#9B9B9B]">
                    Current streak
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-bold text-amber-400">
                      {stats?.streak ?? 0}
                    </span>
                    <span className="text-sm text-[#9B9B9B]">days</span>
                  </div>
                  <span className="text-xs text-[#9B9B9B]">
                    Personal best:{' '}
                    <span className="font-mono font-semibold text-[#EDEDED]">
                      {stats?.best_streak ?? 0}
                    </span>{' '}
                    days
                  </span>
                </div>
                <div className="w-16 h-16 rounded-full bg-[#1F1F1F] border border-[#313131] flex items-center justify-center shadow-[0_0_24px_rgba(245,158,11,0.2)]">
                  <Flame weight="fill" className="w-8 h-8 text-amber-400" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2">
              <div className="rounded-lg bg-[#272727] p-4 h-full flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#9B9B9B]">
                    Streak freezes
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-bold text-[#EDEDED]">
                      {stats?.freezes ?? 0}
                    </span>
                    <span className="font-mono text-sm text-[#9B9B9B]">/ 2</span>
                  </div>
                  <span className="text-xs text-[#9B9B9B] text-pretty">
                    Earned when a concept reaches mastered status
                  </span>
                </div>
                <div className="w-16 h-16 rounded-full bg-[#1F1F1F] border border-[#313131] flex items-center justify-center">
                  <Snowflake weight="fill" className="w-8 h-8 text-amber-400" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2">
              <div className="rounded-lg bg-[#272727] p-4 h-full flex items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#9B9B9B]">
                    Today XP and goal
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-[#EDEDED]">
                      {stats?.xp_today ?? 0}
                    </span>
                    <span className="text-xs text-[#9B9B9B]">
                      XP today · <span className="font-mono">{stats?.xp_total ?? 0}</span> total
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenOnboarding}
                    className="w-max text-xs font-semibold text-amber-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                  >
                    Adjust daily goal (<span className="font-mono">{stats?.daily_goal ?? 15}</span>)
                  </button>
                </div>
                <GoalProgressRing
                  xpToday={stats?.xp_today ?? 0}
                  reviewsToday={stats?.reviews_today ?? 0}
                  dailyGoal={stats?.daily_goal ?? 15}
                  goalMet={Boolean(stats?.goal_met)}
                />
              </div>
            </div>
          </div>
        )}
      </motion.section>

      <motion.section {...REVEAL_PROPS} aria-labelledby="decks-heading" className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="decks-heading" className="text-2xl font-bold text-[#EDEDED] text-balance">
              Your revision decks
            </h2>
            <p className="text-sm text-[#9B9B9B] text-pretty">
              Each deck is built locally from your lecture PDF with verbatim page citations.
            </p>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="py-2 px-3 rounded-lg bg-[#1F1F1F] hover:bg-[#272727] border border-[#313131] text-base font-semibold text-[#EDEDED] inline-flex items-center gap-2 w-max active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
          >
            <UploadSimple weight="bold" className="w-5 h-5 text-amber-400" />
            <span>{uploading ? 'Uploading PDF' : 'Upload lecture PDF'}</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Upload PDF file"
        />

        {loading && (!decks || decks.length === 0) ? (
          <DecksSkeleton />
        ) : !decks || decks.length === 0 ? (
          <div className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2">
            <div className="rounded-lg bg-[#272727] p-8 flex flex-col items-center text-center gap-4">
              <GhostMascot streak={0} goalMet={false} size="md" />
              <div className="flex flex-col gap-1 max-w-md">
                <h3 className="text-lg font-semibold text-[#EDEDED] text-balance">
                  No lecture decks yet
                </h3>
                <p className="text-sm text-[#9B9B9B] text-pretty">
                  Drop a course PDF to extract concepts, build spaced repetition cards, and track memory health.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#131209] text-base font-semibold inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <UploadSimple weight="bold" className="w-5 h-5" />
                <span>Upload your first PDF</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {decks.map((deck) => {
              const isProcessing = deck.status === 'processing';
              const isFailed = deck.status === 'failed';
              const progressPct = Math.round((deck.progress ?? 0) * 100);
              const masteryPct = Number(deck.mastery_pct ?? 0).toFixed(1);

              return (
                <article
                  key={deck.deck_id}
                  className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2 flex flex-col justify-between transition-all duration-300 hover:bg-[#272727]"
                >
                  <div className="rounded-lg bg-[#272727] p-4 flex flex-col gap-4 h-full justify-between">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <FilePdf weight="duotone" className="w-6 h-6 text-amber-400 shrink-0" />
                          <h3 className="text-lg font-semibold text-[#EDEDED] text-balance">
                            {deck.title}
                          </h3>
                        </div>

                        {isProcessing ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#131209] border border-amber-400/50 font-mono text-xs font-semibold text-amber-400 shrink-0">
                            Processing {progressPct}%
                          </span>
                        ) : isFailed ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#131209] border border-red-500/50 text-xs font-semibold text-red-400 shrink-0">
                            Failed
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full bg-[#131209] border font-mono text-xs font-semibold shrink-0 ${
                              deck.due_count > 0
                                ? 'border-amber-400/60 text-amber-400'
                                : 'border-[#313131] text-[#9B9B9B]'
                            }`}
                          >
                            {deck.due_count} due
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#9B9B9B]">
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          <span className="font-mono text-[#EDEDED]">{deck.page_count}</span> pages
                        </span>
                        <span>·</span>
                        <span>
                          <span className="font-mono text-[#EDEDED]">{deck.concept_count}</span> concepts
                        </span>
                        <span>·</span>
                        <span>
                          <span className="font-mono text-[#EDEDED]">{deck.card_count}</span> cards
                        </span>
                      </div>

                      {isProcessing ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs text-[#9B9B9B]">
                            <span>Extracting concepts and grounding questions</span>
                            <span className="font-mono text-amber-400">{progressPct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#131209] border border-[#313131] overflow-hidden">
                            <motion.div
                              className="h-full bg-amber-400 rounded-full"
                              initial={{ width: '8%' }}
                              animate={{ width: `${Math.max(8, progressPct)}%` }}
                              transition={{ duration: 0.4, ease: EASE }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#9B9B9B]">Concept mastery</span>
                            <span className="font-mono font-semibold text-amber-400">
                              {masteryPct}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#131209] border border-[#313131] overflow-hidden">
                            <motion.div
                              className="h-full bg-amber-400 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, Number(deck.mastery_pct ?? 0))}%` }}
                              transition={{ duration: 0.8, ease: EASE }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {isProcessing ? (
                        <button
                          type="button"
                          disabled
                          className="py-2 px-3 rounded-lg bg-[#1F1F1F] border border-[#313131] text-base font-semibold text-[#9B9B9B] opacity-60 cursor-not-allowed"
                        >
                          Preparing cards
                        </button>
                      ) : (
                        <>
                          <Link
                            to={`/review?deck_id=${encodeURIComponent(deck.deck_id)}`}
                            className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#131209] text-base font-semibold inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            <span>Review deck</span>
                            <ArrowRight weight="bold" className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/path?deck_id=${encodeURIComponent(deck.deck_id)}`}
                            className="py-2 px-3 rounded-lg bg-[#1F1F1F] hover:bg-[#313131] border border-[#313131] text-base font-semibold text-[#EDEDED] inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            <Graph weight="bold" className="w-4 h-4 text-amber-400" />
                            <span>Concept path</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border p-2 transition-all duration-300 ${
            dragging
              ? 'bg-[#272727] border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.18)]'
              : 'bg-[#1F1F1F] border-[#313131]'
          }`}
        >
          <div className="rounded-lg bg-[#272727] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#1F1F1F] border border-[#313131] flex items-center justify-center shrink-0">
                <UploadSimple weight="bold" className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex flex-col gap-0.5 text-center sm:text-left">
                <span className="text-base font-semibold text-[#EDEDED]">
                  Drag and drop a lecture PDF here
                </span>
                <span className="text-xs text-[#9B9B9B]">
                  PDF format only · Maximum file size <span className="font-mono">20</span> MB · Processed locally
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-3 rounded-lg bg-[#1F1F1F] hover:bg-[#313131] border border-[#313131] text-base font-semibold text-[#EDEDED] shrink-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
            >
              {uploading ? 'Uploading' : 'Choose PDF'}
            </button>
          </div>
        </div>

        {uploadError && (
          <div
            role="alert"
            className="rounded-2xl bg-[#1F1F1F] border border-red-500/50 p-4 flex items-center gap-3 text-sm text-red-400"
          >
            <WarningCircle weight="fill" className="w-5 h-5 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </motion.section>
    </div>
  );
}

