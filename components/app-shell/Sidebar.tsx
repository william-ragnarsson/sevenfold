"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { useLiveRun, type LiveRun } from "@/components/features/analyze/useLiveRun";
import { ROUTES, signInPath } from "@/lib/routes";

/** Associate's `.side-item`: a quiet row that turns white on the page you're on. */
const ITEM =
  "mx-3 flex gap-2.5 rounded-lg px-3 text-sm leading-[1.55] transition-colors focus-visible:outline-2 focus-visible:outline-accent-bright ";
const ITEM_ON = "bg-white/10 font-semibold text-white";
const ITEM_OFF = "text-on-ink hover:bg-white/[0.04] hover:text-white";

/**
 * The dashboard's sidebar, after Associate's (vc-fund-manager/src/app/App.tsx
 * and src/styles/app.css): a dark 232px column with the wordmark, the app's
 * sections, a Setup group, and who's signed in at the bottom. AppShell puts
 * it beside the page from `lg` up and in a drawer below that; `onNavigate`
 * lets the drawer close when a link is followed, even one to the page you're
 * already on.
 */
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const run = useLiveRun();
  const onRun = run !== null && pathname === run.href;

  return (
    <div className="flex h-full w-[232px] flex-col overflow-y-auto bg-ink py-6">
      <Link
        href={ROUTES.home}
        onClick={onNavigate}
        className="mx-6 mb-5 self-start whitespace-nowrap rounded-sm text-xl font-semibold tracking-[-0.02em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
      >
        SevenFold
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <SideLink
          href={ROUTES.decks}
          active={pathname.startsWith(ROUTES.decks) && !onRun}
          onNavigate={onNavigate}
        >
          Analyse pitch deck
        </SideLink>
        {/* The run carries on while you look at anything else, so the way back
            to it sits under the section it belongs to. */}
        {run && <RunLink run={run} active={onRun} onNavigate={onNavigate} />}

        <p className="mx-6 mb-2 mt-7 text-[10px] uppercase tracking-[0.1em] text-on-ink-muted">
          Setup
        </p>
        <SideLink
          href={ROUTES.context}
          active={pathname === ROUTES.context}
          onNavigate={onNavigate}
        >
          Context
        </SideLink>
      </nav>

      <UserBlock pathname={pathname} onNavigate={onNavigate} />
    </div>
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

function RunLink({
  run,
  active,
  onNavigate,
}: {
  run: LiveRun;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={run.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={ITEM + "items-start py-2 " + (active ? ITEM_ON : ITEM_OFF)}
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

/** Associate's `.side-avatar`. */
function Avatar({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-[11px] font-semibold uppercase text-white">
      {children}
    </span>
  );
}

/**
 * Who's signed in, pinned to the bottom, leading to their settings. Until
 * there's a real account it offers one, coming back here afterwards.
 */
function UserBlock({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { user, isIdentified, loading, configured } = useAuth();

  // No Supabase project configured: accounts aren't part of this deployment.
  if (!configured) return null;
  // Hold the space until the session resolves, so it doesn't flash "Log in".
  if (loading) return <div className="mt-auto h-[54px] shrink-0" aria-hidden />;

  if (!isIdentified) {
    return (
      <Link
        href={signInPath(pathname)}
        onClick={onNavigate}
        className={ITEM + "mt-auto items-center py-2 " + ITEM_OFF}
      >
        <Avatar>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
          </svg>
        </Avatar>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-white">Log in / Sign up</span>
          <span className="block text-xs text-on-ink-muted">Keep your reports</span>
        </span>
      </Link>
    );
  }

  const email = user?.email ?? "";
  const name = (user?.user_metadata?.full_name as string | undefined) ?? email;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const active = pathname.startsWith(ROUTES.settings);

  return (
    <Link
      href={ROUTES.settings}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={ITEM + "mt-auto items-center py-2 " + (active ? "bg-white/10" : "hover:bg-white/[0.04]")}
    >
      <Avatar>
        {avatarUrl ? (
          // Provider avatars come from arbitrary CDNs, as in UserMenu.
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
  );
}
