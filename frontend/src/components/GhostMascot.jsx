import { motion, useReducedMotion } from 'framer-motion';

const EASE = [0.32, 0.72, 0, 1];

export default function GhostMascot({ streak = 0, goalMet = false, size = 'lg', className = '' }) {
  const prefersReducedMotion = useReducedMotion();

  let targetOpacity = 0.35;
  if (goalMet) {
    targetOpacity = 1.0;
  } else if (streak > 0) {
    targetOpacity = 0.7;
  }

  const dimensions =
    size === 'sm' ? 'w-12 h-12' : size === 'md' ? 'w-20 h-20' : 'w-28 h-28';

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center select-none ${dimensions} ${className}`}
      initial={{ opacity: targetOpacity, scale: 0.96 }}
      animate={{
        opacity: targetOpacity,
        scale: goalMet ? [1, 1.08, 1] : 1,
        y: prefersReducedMotion ? 0 : [0, -6, 0],
      }}
      transition={{
        opacity: { duration: 0.4, ease: EASE },
        scale: { duration: 0.5, ease: EASE },
        y: prefersReducedMotion
          ? { duration: 0 }
          : { duration: 3.6, repeat: Infinity, ease: EASE },
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full ${
          goalMet
            ? 'drop-shadow-[0_0_24px_rgba(245,158,11,0.35)]'
            : streak > 0
              ? 'drop-shadow-[0_0_14px_rgba(237,237,237,0.12)]'
              : ''
        }`}
      >
        <path
          d="M60 12C35.7 12 16 31.7 16 56V102C16 105.1 19.6 106.8 22 104.8L31.6 96.6C33.8 94.7 37.1 94.8 39.2 96.8L47.8 105C50 107.1 53.5 107.1 55.7 105L60 100.9L64.3 105C66.5 107.1 70 107.1 72.2 105L80.8 96.8C82.9 94.8 86.2 94.7 88.4 96.6L98 104.8C100.4 106.8 104 105.1 104 102V56C104 31.7 84.3 12 60 12Z"
          fill="#EDEDED"
          stroke={goalMet ? '#F59E0B' : '#313131'}
          strokeWidth="2.5"
        />
        <path
          d="M30 48C30 31.4 43.4 18 60 18"
          stroke="#9B9B9B"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.45"
        />
        <circle cx="45" cy="52" r="6" fill="#131209" />
        <circle cx="75" cy="52" r="6" fill="#131209" />
        <circle
          cx="47"
          cy="50"
          r="2.2"
          fill={goalMet ? '#F59E0B' : '#EDEDED'}
        />
        <circle
          cx="77"
          cy="50"
          r="2.2"
          fill={goalMet ? '#F59E0B' : '#EDEDED'}
        />
        {goalMet ? (
          <path
            d="M52 67C54.5 70.5 65.5 70.5 68 67"
            stroke="#131209"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ) : (
          <ellipse cx="60" cy="68" rx="5" ry="3.5" fill="#131209" />
        )}
        <ellipse
          cx="35"
          cy="61"
          rx="4.5"
          ry="2.5"
          fill="#F59E0B"
          opacity={goalMet ? '0.45' : '0.18'}
        />
        <ellipse
          cx="85"
          cy="61"
          rx="4.5"
          ry="2.5"
          fill="#F59E0B"
          opacity={goalMet ? '0.45' : '0.18'}
        />
      </svg>
    </motion.div>
  );
}

