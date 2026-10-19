"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/features/auth/AuthProvider";
import ReportProvider from "@/components/features/analyze/ReportProvider";
import { useLiveRun } from "@/components/features/analyze/useLiveRun";
import { ROUTES } from "@/lib/routes";
import ResumeStashedDeck from "./ResumeStashedDeck";
import Sidebar from "./Sidebar";

/**
 * The dashboard's frame: the sidebar beside the page from `lg` up; below that
 * a slim bar in the sidebar's colours whose menu button opens the same sidebar
 * as a drawer.
 *
 * The frame is exactly one screen tall and `main` is the scroll region, so the
 * sidebar stays put and there is one scrollbar. A page that needs a scroll box
 * of its own (the report, for its chapter scroll-spy) fills `main` with an
 * `h-full overflow-y-auto` box, and then `main` itself never overflows.
 *
 * Inside an analysis (`/dashboard/analyses/<id>/…`) the report is loaded once,
 * here, for both the page and the sidebar's tabs beside it (`ReportProvider`).
 *
 * `proxy.ts` only lets signed-in accounts in, so the pages inside can take
 * one for granted. A sign-out while you're here (the sidebar's button,
 * deleting the account, another tab) leaves for the home page — the one
 * destination all three agree on, so they can't race to different places.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { configured, loading, isIdentified } = useAuth();
  const signedOut = configured && !loading && !isIdentified;

  useEffect(() => {
    if (signedOut) router.replace(ROUTES.home);
  }, [signedOut, router]);

  // The page the drawer was opened on rather than a plain flag: moving to
  // another page closes it, with no effect needed to reset it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const drawerOpen = openOn === pathname;
  const close = useCallback(() => setOpenOn(null), []);

  return (
    <ReportProvider>
      <div className="flex h-dvh flex-col lg:flex-row">
        <ResumeStashedDeck />
        <aside className="hidden shrink-0 lg:block">
          <Sidebar />
        </aside>
        <MobileBar expanded={drawerOpen} onOpen={() => setOpenOn(pathname)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
        {drawerOpen && <Drawer onClose={close} />}
      </div>
    </ReportProvider>
  );
}

/** Below `lg`: the menu button, the wordmark, and the way back to a live run. */
function MobileBar({ expanded, onOpen }: { expanded: boolean; onOpen: () => void }) {
  const run = useLiveRun();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-ink/10 bg-paper px-3 lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        className="grid h-9 w-9 place-items-center rounded-lg text-ink/70 transition-colors hover:bg-white/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>
      <Link
        href={ROUTES.home}
        className="flex items-center gap-2 rounded-sm font-semibold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Image src="/logo.png" alt="" width={24} height={24} className="rounded-md" />
        SevenFold
      </Link>
      {run && (
        <Link
          href={run.href}
          className="ml-auto flex shrink-0 items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/15"
        >
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          <span className="sr-only">Analysing {run.name}, step </span>
          <span className="tabular-nums">
            {run.step}/{run.steps}
          </span>
        </Link>
      )}
    </header>
  );
}

/**
 * The sidebar sliding in over the page. Focus moves into it on open and back
 * to whatever had it (the menu button) on close; Escape, the backdrop, the
 * close button and following any link all close it.
 */
function Drawer({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fade-in absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        className="drawer-in absolute inset-y-0 left-0 max-w-[85vw] shadow-[0_24px_60px_-12px_rgba(20,19,15,0.5)] outline-none"
      >
        <Sidebar onNavigate={onClose} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-5 grid h-8 w-8 place-items-center rounded-lg text-ink/70 transition-colors hover:bg-white/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
