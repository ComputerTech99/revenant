import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  BookOpen,
  CaretDown,
  CaretUp,
  CheckCircle,
  Graph,
  House,
  Lightning,
  Sparkle,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import {
  fetchDueCards,
  submitCardGrade,
  submitExplainAnswer,
} from '../api/client.js';
import GhostMascot from '../components/GhostMascot.jsx';

const EASE = [0.32, 0.72, 0, 1];

const TYPE_LABELS = {
  mcq: 'Multiple choice',
  cloze: 'Fill the blank',
  explain: 'Explain it back',
};

function CardSkeleton() {
  return (
    <div
      className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-6 flex flex-col gap-6 animate-pulse"
      aria-label="Loading review card"
    >
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 rounded-full bg-[#272727]" />
        <div className="h-4 w-24 rounded bg-[#272727]" />
      </div>
      <div className="h-8 w-3/4 rounded bg-[#272727]" />
      <div className="grid grid-cols-1 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 w-full rounded-lg bg-[#272727]" />
        ))}
      </div>
    </div>
  );
}

function ExplainFeedbackSkeleton() {
  return (
    <div
      className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-6 flex flex-col gap-3 animate-pulse"
      aria-label="Gemma is grading your explanation"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="h-5 w-44 rounded bg-[#272727]" />
        <div className="h-5 w-16 rounded-full bg-[#272727]" />
      </div>
      <div className="h-4 w-full rounded bg-[#272727]" />
      <div className="h-4 w-4/5 rounded bg-[#272727]" />
      <div className="h-6 w-28 rounded-full bg-[#272727] mt-1" />
    </div>
  );
}

export default function ReviewPage({ stats, onStatsChange }) {
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deck_id') || '';
  const prefersReducedMotion = useReducedMotion();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedOption, setSelectedOption] = useState('');
  const [clozeInput, setClozeInput] = useState('');
  const [explainInput, setExplainInput] = useState('');
  const [grading, setGrading] = useState(false);

  const [feedbackState, setFeedbackState] = useState(null);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [easyApplied, setEasyApplied] = useState(false);

  const [sessionXp, setSessionXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [dueBuckets, setDueBuckets] = useState({ tomorrow: 0, nextWeek: 0 });
  const [sessionDone, setSessionDone] = useState(false);

  const clozeInputRef = useRef(null);
  const explainInputRef = useRef(null);
  const confettiFiredRef = useRef(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchDueCards({ deckId: deckId || undefined, limit: 15 });
      setCards(list || []);
      setCurrentIndex(0);
      setFeedbackState(null);
      setSnippetOpen(false);
      setSessionXp(0);
      setCorrectCount(0);
      setAnsweredCount(0);
      setDueBuckets({ tomorrow: 0, nextWeek: 0 });
      setSessionDone(false);
      confettiFiredRef.current = false;
    } catch (err) {
      setError(err.message || 'Could not load due cards.');
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const currentCard = cards[currentIndex] || null;

  useEffect(() => {
    if (!currentCard || feedbackState || sessionDone) return;
    if (currentCard.type === 'cloze') {
      clozeInputRef.current?.focus();
    } else if (currentCard.type === 'explain') {
      explainInputRef.current?.focus();
    }
  }, [currentCard, feedbackState, sessionDone]);

  const recordDueBucket = useCallback(
    (nextDueIso, grade) => {
      let chosenBucket = 'tomorrow';
      if (nextDueIso) {
        const nowMs = stats?.now ? new Date(stats.now).getTime() : Date.now();
        const dueMs = new Date(nextDueIso).getTime();
        const diffDays = Math.round((dueMs - nowMs) / 86400000);
        chosenBucket = diffDays <= 2 ? 'tomorrow' : 'nextWeek';
      } else if (grade === 'good' || grade === 'easy') {
        chosenBucket = 'nextWeek';
      }
      setDueBuckets((prev) => ({
        ...prev,
        [chosenBucket]: prev[chosenBucket] + 1,
      }));
      return chosenBucket;
    },
    [stats?.now]
  );

  const handleMcqSelect = useCallback(
    async (optionText) => {
      if (!currentCard || feedbackState || grading) return;
      setSelectedOption(optionText);
      const isCorrect = optionText.trim() === currentCard.answer.trim();
      const grade = isCorrect ? 'good' : 'again';
      setGrading(true);
      setError('');

      try {
        const res = await submitCardGrade(currentCard.id, grade);
        const gained = res.xp_gained ?? (isCorrect ? 10 : 0);
        setSessionXp((prev) => prev + gained);
        setAnsweredCount((prev) => prev + 1);
        if (isCorrect) {
          setCorrectCount((prev) => prev + 1);
        }
        const bucket = recordDueBucket(res.next_due, grade);
        if (res.stats) {
          onStatsChange?.(res.stats);
        }
        setSnippetOpen(!isCorrect);
        setFeedbackState({
          isCorrect,
          grade,
          bucket,
          concept: res.concept || null,
          xpGained: gained,
          correctAnswer: currentCard.answer,
          source: currentCard.source,
          feedbackText: isCorrect
            ? 'Grounded match verified against your lecture notes.'
            : 'Review the exact answer and page snippet below.',
        });
      } catch (err) {
        setError(err.message || 'Could not submit your answer.');
      } finally {
        setGrading(false);
      }
    },
    [currentCard, feedbackState, grading, onStatsChange, recordDueBucket]
  );

  const handleClozeSubmit = useCallback(async () => {
    if (!currentCard || feedbackState || grading) return;
    const trimmed = clozeInput.trim();
    if (!trimmed) return;

    const isCorrect = trimmed.toLowerCase() === currentCard.answer.trim().toLowerCase();
    const grade = isCorrect ? 'good' : 'again';
    setGrading(true);
    setError('');

    try {
      const res = await submitCardGrade(currentCard.id, grade);
      const gained = res.xp_gained ?? (isCorrect ? 10 : 0);
      setSessionXp((prev) => prev + gained);
      setAnsweredCount((prev) => prev + 1);
      if (isCorrect) {
        setCorrectCount((prev) => prev + 1);
      }
      const bucket = recordDueBucket(res.next_due, grade);
      if (res.stats) {
        onStatsChange?.(res.stats);
      }
      setSnippetOpen(!isCorrect);
      setFeedbackState({
        isCorrect,
        grade,
        bucket,
        concept: res.concept || null,
        xpGained: gained,
        correctAnswer: currentCard.answer,
        source: currentCard.source,
        feedbackText: isCorrect
          ? 'Exact term matched.'
          : `You wrote "${trimmed}". Check the verbatim passage from your PDF.`,
      });
    } catch (err) {
      setError(err.message || 'Could not submit your answer.');
    } finally {
      setGrading(false);
    }
  }, [clozeInput, currentCard, feedbackState, grading, onStatsChange, recordDueBucket]);

  const handleExplainSubmit = useCallback(async () => {
    if (!currentCard || feedbackState || grading) return;
    const trimmed = explainInput.trim();
    if (!trimmed) return;

    setGrading(true);
    setError('');
    try {
      const res = await submitExplainAnswer(currentCard.id, trimmed);
      const isCorrect = res.grade === 'good' || res.grade === 'hard';
      const gained = res.xp_gained ?? Math.round((res.score ?? 0) * 20);
      setSessionXp((prev) => prev + gained);
      setAnsweredCount((prev) => prev + 1);
      if (isCorrect) {
        setCorrectCount((prev) => prev + 1);
      }
      const bucket = recordDueBucket(res.next_due, res.grade);
      if (res.stats) {
        onStatsChange?.(res.stats);
      }
      setSnippetOpen(true);
      setFeedbackState({
        isCorrect,
        grade: res.grade,
        bucket,
        score: res.score,
        concept: res.concept || null,
        xpGained: gained,
        correctAnswer: currentCard.answer,
        source: res.source || currentCard.source,
        feedbackText: res.feedback,
      });
    } catch (err) {
      setError(err.message || 'Could not grade your explanation.');
    } finally {
      setGrading(false);
    }
  }, [currentCard, explainInput, feedbackState, grading, onStatsChange, recordDueBucket]);

  const handleNextCard = useCallback(() => {
    if (!feedbackState) return;
    setFeedbackState(null);
    setSnippetOpen(false);
    setEasyApplied(false);
    setSelectedOption('');
    setClozeInput('');
    setExplainInput('');

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setSessionDone(true);
    }
  }, [cards.length, currentIndex, feedbackState]);

  const handleMarkEasy = async () => {
    if (!currentCard || !feedbackState || easyApplied) return;
    setEasyApplied(true);
    if (feedbackState.bucket === 'tomorrow') {
      setDueBuckets((prev) => ({
        tomorrow: Math.max(0, prev.tomorrow - 1),
        nextWeek: prev.nextWeek + 1,
      }));
    }
    try {
      const res = await submitCardGrade(currentCard.id, 'easy');
      if (res.stats) {
        onStatsChange?.(res.stats);
      }
    } catch {
      // Optional easy upgrade
    }
    handleNextCard();
  };

  useEffect(() => {
    if (sessionDone && stats?.goal_met && !confettiFiredRef.current && !prefersReducedMotion) {
      confettiFiredRef.current = true;
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#FBBF24', '#EDEDED'],
      });
    }
  }, [prefersReducedMotion, sessionDone, stats?.goal_met]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (sessionDone || loading || !currentCard) return;

      if (feedbackState) {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleNextCard();
        }
        return;
      }

      if (currentCard.type === 'mcq' && Array.isArray(currentCard.options)) {
        if (['1', '2', '3', '4'].includes(event.key)) {
          const idx = Number(event.key) - 1;
          const opt = currentCard.options[idx];
          if (opt) {
            event.preventDefault();
            handleMcqSelect(opt);
          }
        }
      } else if (currentCard.type === 'cloze' && event.key === 'Enter') {
        event.preventDefault();
        handleClozeSubmit();
      } else if (currentCard.type === 'explain' && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleExplainSubmit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentCard,
    feedbackState,
    handleClozeSubmit,
    handleExplainSubmit,
    handleMcqSelect,
    handleNextCard,
    loading,
    sessionDone,
  ]);

  const progressFraction =
    cards.length > 0
      ? Math.min(1, (currentIndex + (feedbackState || sessionDone ? 1 : 0)) / cards.length)
      : 0;

  const renderClozePrompt = (promptText) => {
    const parts = (promptText || '').split('____');
    if (parts.length < 2) {
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xl font-semibold text-[#EDEDED] text-pretty">{promptText}</p>
          <input
            ref={clozeInputRef}
            type="text"
            value={clozeInput}
            disabled={Boolean(feedbackState) || grading}
            onChange={(e) => setClozeInput(e.target.value)}
            placeholder="Type missing term"
            aria-label="Missing term"
            className="w-64 px-3 py-2 rounded-lg bg-[#131209] border border-[#313131] text-base text-[#EDEDED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
        </div>
      );
    }

    return (
      <p className="text-xl sm:text-2xl font-semibold text-[#EDEDED] leading-relaxed text-pretty">
        <span>{parts[0]}</span>
        <input
          ref={clozeInputRef}
          type="text"
          value={clozeInput}
          disabled={Boolean(feedbackState) || grading}
          onChange={(e) => setClozeInput(e.target.value)}
          placeholder="fill blank"
          aria-label="Fill the blank"
          className="mx-2 px-3 py-1 rounded-lg bg-[#131209] border border-amber-400/70 text-amber-400 font-mono text-lg inline-block w-44 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        />
        <span>{parts.slice(1).join('')}</span>
      </p>
    );
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-10 flex flex-col gap-6">
        <div className="h-2 w-full rounded-full bg-[#1F1F1F] overflow-hidden" />
        <CardSkeleton />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-10">
        <div className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-8 flex flex-col items-center text-center gap-4">
          <GhostMascot streak={stats?.streak ?? 1} goalMet={true} size="md" />
          <h1 className="text-2xl font-bold text-[#EDEDED] text-balance">
            All caught up for now
          </h1>
          <p className="text-sm text-[#9B9B9B] text-pretty max-w-md">
            No cards are due right now. Visit the concept path to inspect memory health or use time travel to preview future reviews.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to={deckId ? `/path?deck_id=${encodeURIComponent(deckId)}` : '/path'}
              className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#131209] text-base font-semibold inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Graph weight="bold" className="w-5 h-5" />
              <span>Open concept path</span>
            </Link>
            <Link
              to="/"
              className="py-2 px-3 rounded-lg bg-[#272727] hover:bg-[#313131] border border-[#313131] text-base font-semibold text-[#EDEDED] inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <House weight="bold" className="w-5 h-5" />
              <span>Back home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (sessionDone) {
    const accuracyPct =
      answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 100;

    return (
      <div className="max-w-3xl mx-auto px-4 pt-10 flex flex-col gap-6">
        <motion.section
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, ease: EASE }}
          className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-8 flex flex-col items-center text-center gap-6"
          aria-labelledby="session-complete-heading"
        >
          <GhostMascot
            streak={stats?.streak ?? 1}
            goalMet={Boolean(stats?.goal_met)}
            size="lg"
          />

          <div className="flex flex-col gap-2">
            <span className="px-3 py-1 rounded-full bg-[#272727] border border-[#313131] text-xs font-semibold text-amber-400 mx-auto">
              {stats?.goal_met ? 'Goal reached.' : 'Session complete.'}
            </span>
            <h1
              id="session-complete-heading"
              className="text-3xl font-bold text-[#EDEDED] text-balance"
            >
              {stats?.goal_met
                ? 'Goal reached. Your notes stay sharp.'
                : 'Review session complete.'}
            </h1>
            <p className="text-base text-[#9B9B9B] text-pretty">
              <span className="font-mono font-semibold text-[#EDEDED]">
                {dueBuckets.tomorrow}
              </span>{' '}
              cards return tomorrow,{' '}
              <span className="font-mono font-semibold text-[#EDEDED]">
                {dueBuckets.nextWeek}
              </span>{' '}
              next week
            </p>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-[#272727] border border-[#313131] p-4 flex flex-col items-center gap-1">
              <span className="text-xs text-[#9B9B9B]">XP gained</span>
              <span className="font-mono text-2xl font-bold text-amber-400 inline-flex items-center gap-1">
                <Lightning weight="fill" className="w-5 h-5" />
                +{sessionXp}
              </span>
            </div>

            <div className="rounded-lg bg-[#272727] border border-[#313131] p-4 flex flex-col items-center gap-1">
              <span className="text-xs text-[#9B9B9B]">Accuracy</span>
              <span className="font-mono text-2xl font-bold text-[#EDEDED]">
                {accuracyPct}%
              </span>
            </div>

            <div className="rounded-lg bg-[#272727] border border-[#313131] p-4 flex flex-col items-center gap-1">
              <span className="text-xs text-[#9B9B9B]">Reviewed</span>
              <span className="font-mono text-2xl font-bold text-[#EDEDED]">
                {answeredCount}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to={deckId ? `/path?deck_id=${encodeURIComponent(deckId)}` : '/path'}
              className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#131209] text-base font-semibold inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Graph weight="bold" className="w-5 h-5" />
              <span>View concept path</span>
            </Link>
            <Link
              to="/"
              className="py-2 px-3 rounded-lg bg-[#272727] hover:bg-[#313131] border border-[#313131] text-base font-semibold text-[#EDEDED] inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <House weight="bold" className="w-5 h-5" />
              <span>Return home</span>
            </Link>
          </div>
        </motion.section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#9B9B9B]">
          <span className="font-semibold text-[#EDEDED]">
            Card <span className="font-mono">{currentIndex + 1}</span> of{' '}
            <span className="font-mono">{cards.length}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-amber-400">
            <Lightning weight="fill" className="w-3.5 h-3.5" />
            +{sessionXp} XP
          </span>
        </div>
        <div
          className="w-full h-2 rounded-full bg-[#1F1F1F] border border-[#313131] overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progressFraction * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            className="h-full bg-amber-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(progressFraction * 100)}%` }}
            transition={{ duration: 0.3, ease: EASE }}
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-[#1F1F1F] border border-red-500/50 p-4 flex items-center gap-3 text-sm text-red-400"
        >
          <WarningCircle weight="fill" className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.section
          key={currentCard.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: EASE }}
          aria-label="Review question"
          className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-6 flex flex-col gap-6"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-[#272727] border border-[#313131] text-xs font-semibold text-amber-400">
              {TYPE_LABELS[currentCard.type] || 'Review card'}
            </span>
            {!feedbackState && (
              <span className="text-xs text-[#9B9B9B]">
                {currentCard.type === 'mcq' ? (
                  <>
                    Keys <span className="font-mono text-[#EDEDED]">1</span> to{' '}
                    <span className="font-mono text-[#EDEDED]">4</span>
                  </>
                ) : (
                  <>
                    Press <span className="font-mono text-[#EDEDED]">Enter</span> to submit
                  </>
                )}
              </span>
            )}
          </div>

          {currentCard.type === 'cloze' ? (
            renderClozePrompt(currentCard.prompt)
          ) : (
            <h1 className="text-xl sm:text-2xl font-semibold text-[#EDEDED] leading-snug text-balance">
              {currentCard.prompt}
            </h1>
          )}

          {currentCard.type === 'mcq' && Array.isArray(currentCard.options) && (
            <div className="grid grid-cols-1 gap-3">
              {currentCard.options.map((option, idx) => {
                const isChosen = selectedOption === option;
                const isRightOption =
                  feedbackState && option.trim() === currentCard.answer.trim();
                const isWrongChosen =
                  feedbackState && isChosen && !feedbackState.isCorrect;

                let cardStyle =
                  'bg-[#272727] border-[#313131] text-[#EDEDED] hover:bg-[#313131]';
                if (isRightOption) {
                  cardStyle =
                    'bg-[#272727] border-amber-400 text-[#EDEDED] shadow-[0_0_20px_rgba(245,158,11,0.16)]';
                } else if (isWrongChosen) {
                  cardStyle = 'bg-[#272727] border-red-500 text-red-300';
                }

                return (
                  <button
                    key={option}
                    type="button"
                    disabled={Boolean(feedbackState) || grading}
                    onClick={() => handleMcqSelect(option)}
                    className={`w-full rounded-lg border p-3 text-left flex items-center justify-between gap-3 transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${cardStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#131209] border border-[#313131] font-mono text-xs font-semibold text-amber-400 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-base font-medium text-pretty">{option}</span>
                    </div>
                    {isRightOption && (
                      <CheckCircle weight="fill" className="w-5 h-5 text-amber-400 shrink-0" />
                    )}
                    {isWrongChosen && (
                      <XCircle weight="fill" className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {currentCard.type === 'cloze' && !feedbackState && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={!clozeInput.trim() || grading}
                onClick={handleClozeSubmit}
                className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#131209] text-base font-semibold inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
              >
                <span>Check answer</span>
                <ArrowRight weight="bold" className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentCard.type === 'explain' && (
            <div className="flex flex-col gap-3">
              <textarea
                ref={explainInputRef}
                rows={4}
                value={explainInput}
                disabled={Boolean(feedbackState) || grading}
                onChange={(e) => setExplainInput(e.target.value)}
                placeholder="Write your explanation in your own words. Press Enter to submit."
                aria-label="Your explanation"
                className="w-full rounded-lg bg-[#131209] border border-[#313131] p-3 text-base text-[#EDEDED] placeholder:text-[#9B9B9B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
              {!feedbackState && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    disabled={!explainInput.trim() || grading}
                    onClick={handleExplainSubmit}
                    className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#131209] text-base font-semibold inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
                  >
                    <span>{grading ? 'Grading with Gemma' : 'Grade explanation'}</span>
                    <ArrowRight weight="bold" className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      {grading && currentCard.type === 'explain' && <ExplainFeedbackSkeleton />}

      {feedbackState && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          aria-live="polite"
          className="rounded-2xl bg-[#1F1F1F] border border-[#313131] p-6 flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {feedbackState.isCorrect ? (
                <CheckCircle weight="fill" className="w-6 h-6 text-amber-400 shrink-0" />
              ) : (
                <XCircle weight="fill" className="w-6 h-6 text-red-400 shrink-0" />
              )}
              <span className="text-lg font-bold text-[#EDEDED]">
                {feedbackState.grade === 'good'
                  ? 'Correct'
                  : feedbackState.grade === 'hard'
                    ? 'Partially correct'
                    : 'Needs another look'}
              </span>
              {typeof feedbackState.score === 'number' && (
                <span className="px-2 py-0.5 rounded-full bg-[#131209] border border-[#313131] font-mono text-xs text-amber-400">
                  Score {Math.round(feedbackState.score * 100)}%
                </span>
              )}
            </div>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#131209] border border-[#313131] font-mono text-xs font-semibold text-amber-400">
              <Lightning weight="fill" className="w-3.5 h-3.5" />
              +{feedbackState.xpGained} XP
            </span>
          </div>

          <p className="text-sm text-[#9B9B9B] text-pretty">{feedbackState.feedbackText}</p>

          <div className="rounded-lg bg-[#272727] border border-[#313131] p-3 flex flex-col gap-1">
            <span className="text-xs font-medium text-[#9B9B9B]">Grounded answer</span>
            <p className="text-sm font-medium text-[#EDEDED] text-pretty">
              {feedbackState.correctAnswer}
            </p>
          </div>

          {feedbackState.source && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSnippetOpen((prev) => !prev)}
                aria-expanded={snippetOpen}
                className="w-max px-3 py-1 rounded-full bg-[#131209] hover:bg-[#272727] border border-amber-400/50 text-xs font-semibold text-amber-400 inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <BookOpen weight="bold" className="w-4 h-4" />
                <span>
                  From page <span className="font-mono">{feedbackState.source.page}</span>
                </span>
                {snippetOpen ? (
                  <CaretUp weight="bold" className="w-3.5 h-3.5" />
                ) : (
                  <CaretDown weight="bold" className="w-3.5 h-3.5" />
                )}
              </button>

              {snippetOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="rounded-lg bg-[#131209] border border-[#313131] p-4 flex flex-col gap-1"
                >
                  <span className="text-xs font-medium text-[#9B9B9B]">
                    Verbatim PDF excerpt · Page{' '}
                    <span className="font-mono text-[#EDEDED]">
                      {feedbackState.source.page}
                    </span>
                  </span>
                  <p className="text-sm text-[#EDEDED] text-pretty leading-relaxed">
                    “{feedbackState.source.snippet}”
                  </p>
                </motion.div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {feedbackState.isCorrect && currentCard.type !== 'explain' ? (
              <button
                type="button"
                disabled={easyApplied}
                onClick={handleMarkEasy}
                className="py-2 px-3 rounded-lg bg-[#272727] hover:bg-[#313131] border border-[#313131] text-base font-semibold text-[#EDEDED] inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
              >
                <Sparkle weight="fill" className="w-4 h-4 text-amber-400" />
                <span>{easyApplied ? 'Scheduled as easy' : 'Mark as easy'}</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleNextCard}
              className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#131209] text-base font-semibold inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span>
                {currentIndex + 1 < cards.length ? 'Continue (Enter)' : 'Finish session (Enter)'}
              </span>
              <ArrowRight weight="bold" className="w-4 h-4" />
            </button>
          </div>
        </motion.section>
      )}
    </div>
  );
}
