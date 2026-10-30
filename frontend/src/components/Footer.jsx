export default function Footer() {
  return (
    <footer className="mt-20 mb-8 px-4">
      <div className="max-w-5xl mx-auto rounded-2xl bg-[#1F1F1F] border border-[#313131] px-4 py-3 text-center">
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
      </div>
    </footer>
  );
}
