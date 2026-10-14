import Link from "next/link";
import PlaybookBody from "@/components/features/playbook/PlaybookBody";
import { ROUTES } from "@/lib/routes";

export default function PlaybookPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6">
      <header className="pt-10 sm:pt-14 space-y-5">
        <Link href={ROUTES.home} className="text-sm text-muted hover:text-ink transition-colors">← Back</Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper/60 backdrop-blur px-3 py-1 text-xs font-medium text-accent uppercase tracking-[0.2em]">
          Context database
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1] text-ink">
          How I evaluated 800+ decks
        </h1>
        <p className="text-lg text-muted max-w-xl leading-relaxed">
          The exact criteria the AI uses, drawn from a year of weekly deal reviews,
          not generic startup advice.
        </p>
      </header>

      <PlaybookBody />

      <div className="pt-8">
        <Link
          href={ROUTES.home}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ink text-paper font-semibold hover:bg-accent transition-colors"
        >
          Analyze your deck →
        </Link>
      </div>
    </div>
  );
}
