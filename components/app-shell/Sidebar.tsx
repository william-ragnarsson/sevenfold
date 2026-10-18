"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { useReport, type OpenReport } from "@/components/features/analyze/ReportProvider";
import { useLiveRun, type LiveRun } from "@/components/features/analyze/useLiveRun";
import {
  PRODUCT_SLUGS,
  ProductTabIcon,
  STATUS_META,
  tabStatus,
} from "@/components/features/analyze/productTabs";
import ProductIcon from "@/components/layout/ProductIcon";
import { productPage, productSlugOf } from "@/lib/products";
import { analysisPath, DASHBOARD_PAGES, ROUTES } from "@/lib/routes";

/** A quiet row that turns white on the page you're on. */
const ITEM =
  "mx-3 flex gap-2.5 rounded-lg px-3 text-sm leading-[1.55] transition-colors focus-visible:outline-2 focus-visible:outline-accent-bright ";
const ITEM_ON = "bg-white/10 font-semibold text-white";
const ITEM_OFF = "text-on-ink hover:bg-white/[0.04] hover:text-white";

/**
 * The dashboard's sidebar: a dark 232px column — the same near-black as the
 * landing page's hero card — with the logo, the dashboard's pages, and who's
 * signed in at the bottom. Inside an analysis the pages give way to that
 * analysis's tabs: its overview, one per product with how far it got, and the
 * full report. AppShell puts it beside the page from `lg` up and in a drawer
 * below that; `onNavigate` lets the drawer close when a link is followed, even
 * one to the page you're already on.
 */
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const run = useLiveRun();
  const report = useReport();

  return (
    <div className="flex h-full w-[232px] flex-col overflow-y-auto bg-ink py-6">
      <Link
        href={ROUTES.home}
        onClick={onNavigate}
        className="group mx-6 mb-6 flex items-center gap-2 self-start whitespace-nowrap rounded-sm font-semibold tracking-tight text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
      >
        <Image src="/logo.png" alt="" width={28} height={28} className="rounded-md" />
        <span className="transition-opacity group-hover:opacity-70">SevenFold</span>
      </Link>

      {report ? (
        <AnalysisNav report={report} pathname={pathname} run={run} onNavigate={onNavigate} />
      ) : (
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {DASHBOARD_PAGES.map((page) => (
            <div key={page.id} className="contents">
              <SideLink
                href={page.href}
                // Every page sits under /dashboard; only its own url lights it.
                active={page.id === "dashboard" ? pathname === page.href : pathname.startsWith(page.href)}
                onNavigate={onNavigate}
              >
                <ProductIcon id={page.id} className="h-[18px] w-[18px] opacity-80" />
                {page.label}
              </SideLink>
              {/* The run carries on while you look at anything else, so the way
                  back to it sits under the list it'll land in. */}
              {page.id === "analyses" && run && <RunLink run={run} onNavigate={onNavigate} />}
            </div>
          ))}
        </nav>
      )}

      <UserBlock pathname={pathname} onNavigate={onNavigate} />
    </div>
  );
}

/** Inside one analysis: the way out, its name, and a tab per page of it. */
function AnalysisNav({
  report,
  pathname,
  run,
  onNavigate,
}: {
  report: OpenReport;
  pathname: string;
  run: LiveRun | null;
  onNavigate?: () => void;
}) {
  const { state, settled } = report;

  return (
    <nav aria-label="Analysis" className="flex flex-col gap-0.5">
      <SideLink href={ROUTES.analyses} active={false} onNavigate={onNavigate}>
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
        All analyses
      </SideLink>
      {/* A run going on for another deck stays one click away. */}
      {run && !report.isLive && <RunLink run={run} onNavigate={onNavigate} />}

      {/* Nothing saved under this url: no name or tabs to show, just the way out. */}
      {!(settled && !state) && <AnalysisTabs report={report} pathname={pathname} onNavigate={onNavigate} />}
    </nav>
  );
}

/** The open analysis's name, then its overview, a tab per product, and the full report. */
function AnalysisTabs({
  report,
  pathname,
  onNavigate,
}: {
  report: OpenReport;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { id, name, state, active, failure, settled } = report;
  const current = productSlugOf(pathname);
  const stopped = !active && failure !== null;
  const full = productPage("report");

  return (
    <>
      <div className="mx-6 mt-5 mb-2 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-ink-muted">Analysis</p>
        <p className="truncate text-sm font-semibold text-white" title={settled ? name : undefined}>
          {settled ? name : "Loading…"}
        </p>
      </div>

      <SideLink href={analysisPath(id)} active={current === null} onNavigate={onNavigate}>
        <ProductTabIcon slug="overview" className="h-[18px] w-[18px] opacity-80" />
        Overview
      </SideLink>
      {PRODUCT_SLUGS.map((slug) => {
        const status = state ? tabStatus(slug, state, active, stopped) : null;
        return (
          <SideLink key={slug} href={analysisPath(id, slug)} active={current === slug} onNavigate={onNavigate}>
            <ProductTabIcon slug={slug} className="h-[18px] w-[18px] opacity-80" />
            <span className="min-w-0 flex-1 truncate">{productPage(slug).label}</span>
            {status && (
              <>
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[status].dot}`} aria-hidden />
                <span className="sr-only">({STATUS_META[status].label})</span>
              </>
            )}
          </SideLink>
        );
      })}
      <div className="mx-6 my-2 border-t border-white/[0.08]" aria-hidden />
      <SideLink href={analysisPath(id, "report")} active={current === "report"} onNavigate={onNavigate}>
        <ProductTabIcon slug="report" className="h-[18px] w-[18px] opacity-80" />
        {full.label}
      </SideLink>
    </>
  );
}

function SideLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={ITEM + "items-center py-2.5 " + (active ? ITEM_ON : ITEM_OFF)}
    >
      {children}
    </Link>
  );
}

/** The way back to the run going on in this tab, from anywhere outside it. */
function RunLink({ run, onNavigate }: { run: LiveRun; onNavigate?: () => void }) {
  return (
    <Link
      href={run.href}
      onClick={onNavigate}
      // Indented to sit under its section's label, past the icon.
      className={ITEM + "items-start py-2 pl-[1.4rem] " + ITEM_OFF}
    >
      <span className="relative mt-[7px] flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-accent-bright opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-bright" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="sr-only">Analysing </span>
          <span className="truncate">{run.name}</span>
          <span className="ml-auto shrink-0 text-xs font-normal tabular-nums opacity-60">
            {run.step}/{run.steps}
          </span>
        </span>
        <span className="block truncate text-xs font-normal text-on-ink-muted">{run.label}…</span>
      </span>
    </Link>
  );
}

function Avatar({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-[11px] font-semibold uppercase text-white">
      {children}
    </span>
  );
}

/** Who's signed in, pinned to the bottom: their account page, and signing out. */
function UserBlock({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { user, isIdentified, loading, configured, signOut } = useAuth();

  // No Supabase project configured: accounts aren't part of this deployment.
  if (!configured) return null;
  // Hold the space until the session resolves. Signed out mid-visit, AppShell
  // is already on its way to the home page.
  if (loading || !isIdentified) return <div className="mt-auto h-[94px] shrink-0" aria-hidden />;

  const email = user?.email ?? "";
  const name = (user?.user_metadata?.full_name as string | undefined) ?? email;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const active = pathname.startsWith(ROUTES.account);

  return (
    <div className="mt-auto flex flex-col gap-0.5 border-t border-white/[0.08] pt-4">
      <Link
        href={ROUTES.account}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={ITEM + "items-center py-2 " + (active ? "bg-white/10" : "hover:bg-white/[0.04]")}
      >
        <Avatar>
          {avatarUrl ? (
            // Provider avatars come from arbitrary CDNs; a plain <img> avoids
            // having to allow-list every one of them in next.config.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (name || "?").charAt(0)
          )}
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-white">
            {name || "Signed in"}
          </span>
          <span className="block truncate text-xs text-on-ink-muted">
            {email && name !== email ? email : "Account"}
          </span>
        </span>
      </Link>
      <button
        type="button"
        // AppShell sees the session go and takes you home.
        onClick={() => void signOut()}
        className={ITEM + "items-center py-2 text-left " + ITEM_OFF}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px] shrink-0 opacity-80"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" />
        </svg>
        Sign out
      </button>
    </div>
  );
}
