import Link from "next/link";
import { ROUTES } from "@/lib/routes";

const LINKS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/william-ragnarsson/" },
  { label: "GitHub", href: "https://github.com/william-ragnarsson" },
  { label: "Email", href: "mailto:william.ragnarsson@gmail.com" },
];

/**
 * The public site's footer, rendered by MarketingShell under every page there.
 *
 * `sheet` is for the home page, where every section sits on a solid sheet over
 * the dot grid. The footer becomes the last of them: the same inset, border and
 * colour, slimmer and less rounded, so its text doesn't land on the bare grid
 * either and the page ends in the shape it was built from. Elsewhere it's a
 * hairline rule over the paper.
 */
export default function Footer({ sheet = false }: { sheet?: boolean }) {
  return (
    <footer className={sheet ? "px-3 pb-3 sm:px-6 sm:pb-6" : "mt-16 border-t border-ink/10 px-6 py-8"}>
      <div
        className={
          sheet
            ? "rounded-[28px] border border-ink/[0.09] bg-sheet px-6 py-7 shadow-[0_1px_2px_rgba(20,19,15,0.04)]"
            : ""
        }
      >
        {/* The home page's sheets are `max-w-6xl` inside, so the default
            `max-w-3xl` would leave the footer's two ends floating inside the
            column the rest of that page lines up to. */}
        <div
          className={
            "mx-auto flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center " +
            (sheet ? "max-w-6xl" : "max-w-3xl")
          }
        >
          <div>
            <p className="font-semibold tracking-tight text-ink">William Ragnarsson</p>
            <p className="text-sm text-muted">VC analyst, distilled into an AI.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target={l.href.startsWith("http") ? "_blank" : undefined}
                rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ))}
            <Link href={ROUTES.model} className="text-sm font-medium text-muted transition-colors hover:text-ink">
              How the model works
            </Link>
            <Link href={ROUTES.rubric} className="text-sm font-medium text-muted transition-colors hover:text-ink">
              Rubric
            </Link>
            <span className="text-sm text-muted/60">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
