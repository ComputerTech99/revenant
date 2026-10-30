import { Link } from 'react-router-dom';
import { House } from '@phosphor-icons/react';
import GhostMascot from '../components/GhostMascot.jsx';

export default function NotFoundPage() {
  return (
    <section
      aria-labelledby="not-found-heading"
      className="max-w-xl mx-auto px-4 pt-16 flex flex-col items-center text-center"
    >
      <div className="w-full rounded-2xl bg-[#1F1F1F] border border-[#313131] p-2">
        <div className="rounded-lg bg-[#272727] p-8 flex flex-col items-center gap-4">
          <GhostMascot streak={0} goalMet={false} size="lg" />
          <span className="px-3 py-1 rounded-full bg-[#1F1F1F] border border-[#313131] font-mono text-xs font-semibold text-amber-400">
            404
          </span>
          <h1
            id="not-found-heading"
            className="text-3xl font-bold text-[#EDEDED] text-balance"
          >
            This page drifted into the mist
          </h1>
          <p className="text-sm text-[#9B9B9B] text-pretty max-w-sm">
            The route you requested does not exist in Revenant. Return to your decks to continue revising.
          </p>
          <Link
            to="/"
            className="mt-2 py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#131209] text-base font-semibold inline-flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <House weight="bold" className="w-5 h-5" />
            <span>Return home</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

