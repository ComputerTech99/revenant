export default function Footer({ healthInfo }) {
  return (
    <footer className="mt-16 mb-8 px-4">
      <div className="max-w-5xl mx-auto rounded-2xl bg-[#1F1F1F] border border-[#313131] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <p className="text-xs text-[#9B9B9B] text-pretty">
          Runs locally. Your PDFs never leave this laptop. MIT licence ·{' '}
          <a
            href="https://github.com/ComputerTech99/revenant"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#EDEDED] hover:text-amber-400 underline underline-offset-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Source on GitHub
          </a>
        </p>
        {healthInfo?.ok && healthInfo?.model && (
          <span className="px-2 py-0.5 rounded-full bg-[#131209] border border-[#313131] text-xs text-[#9B9B9B] shrink-0">
            <span className="font-mono text-[#EDEDED]">{healthInfo.model}</span>
          </span>
        )}
      </div>
    </footer>
  );
}
