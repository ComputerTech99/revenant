import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Lightning } from '@phosphor-icons/react';
import GhostMascot from './GhostMascot.jsx';

const EASE = [0.32, 0.72, 0, 1];

const LINE_ONE = ['Notes', 'that', 'come', 'back'];
const LINE_TWO = ['to', 'haunt', 'you,', 'on', 'schedule.'];

const GOALS = [
  { value: 5, label: 'Casual', detail: 'Light daily check in' },
  { value: 15, label: 'Regular', detail: 'Steady exam preparation' },
  { value: 30, label: 'Serious', detail: 'Deep mastery sprint' },
];

export default function OnboardingModal({ currentGoal = 5, onSelectGoal, onClose }) {
  const [selected, setSelected] = useState(currentGoal || 5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const handleConfirm = async (goalValue) => {
    setSelected(goalValue);
    setSaving(true);
    setError('');
    try {
      await onSelectGoal(goalValue);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save your daily goal.');
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tagline"
      className="fixed inset-0 z-50 bg-[#131209]/95 backdrop-blur-3xl flex flex-col items-center justify-center px-4 py-8 overflow-y-auto"
    >
      <div className="w-full max-w-[680px] mx-auto flex flex-col items-center text-center gap-8">
        <GhostMascot streak={1} goalMet={true} size="md" />

        <h1
          id="onboarding-tagline"
          className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight text-balance max-w-[680px] text-[#EDEDED]"
        >
          <span className="block">
            {LINE_ONE.map((word, idx) => (
              <motion.span
                key={`l1-${word}`}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: 1 }}
                transition={{
                  delay: idx * 0.12,
                  duration: 0.5,
                  ease: EASE,
                }}
                className="inline-block mr-3 last:mr-0"
              >
                {word}
              </motion.span>
            ))}
          </span>
          <span className="block mt-1">
            {LINE_TWO.map((word, idx) => {
              const globalIdx = LINE_ONE.length + idx;
              return (
                <motion.span
                  key={`l2-${word}`}
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: globalIdx * 0.12,
                    duration: 0.5,
                    ease: EASE,
                  }}
                  className="inline-block mr-3 last:mr-0"
                >
                  {word}
                </motion.span>
              );
            })}
          </span>
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 1.15, duration: 0.8, ease: EASE }}
          className="w-full flex flex-col items-center gap-6"
        >
          <p className="text-base text-[#9B9B9B] text-pretty max-w-md">
            Pick a daily card target to start revising.
          </p>

          <div className="w-full rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {GOALS.map((goal) => {
              const isSelected = selected === goal.value;
              return (
                <button
                  key={goal.value}
                  type="button"
                  disabled={saving}
                  onClick={() => handleConfirm(goal.value)}
                  className={`rounded-lg p-4 text-left border transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#272727] border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.14)]'
                      : 'bg-[#1F1F1F] border-[#313131] hover:bg-[#272727]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold text-[#EDEDED]">{goal.label}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#131209] border border-[#313131] font-mono text-xs font-semibold text-amber-400">
                      <Flame weight="fill" className="w-3.5 h-3.5" />
                      {goal.value}
                    </span>
                  </div>
                  <p className="text-xs text-[#9B9B9B] text-pretty">{goal.detail}</p>
                </button>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleConfirm(selected)}
              className="py-2 px-3 rounded-lg bg-amber-400 text-[#131209] text-base font-semibold hover:bg-amber-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Lightning weight="fill" className="w-4 h-4" />
              <span>
                {saving ? 'Saving goal' : `Continue with ${selected} cards`}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
