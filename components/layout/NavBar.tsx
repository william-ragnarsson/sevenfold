"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { useLiveRun } from "@/components/features/analyze/useLiveRun";
import ProductIcon from "./ProductIcon";
import { PRODUCTS, ROUTES, signInPath } from "@/lib/routes";

/**
 * The public site's top nav, fixed over the page rather than sitting in the
 * flow: Home, a Products menu, and the way into the dashboard.
 *
 * On the home page it starts *inside* the hero card — no pill chrome, light
 * text on the dark card — so the first screen reads as one surface. The moment
 * you scroll it detaches into the floating paper pill it is everywhere else.
 * Shows a glowing pill while an analysis runs in the background.
 */
export default function NavBar() {
  const pathname = usePathname();
  const run = useLiveRun();
  const [scrolled, setScrolled] = useState(false);
  // Only the home page has a dark card under the nav to merge into.
  const onCard = pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const link = (active: boolean) =>
    // Tighter padding below `sm`: the links are `shrink-0`, so at 375px they
    // plus the logo overflowed the pill and the last one was clipped by its
    // own rounded edge.
    "shrink-0 rounded-full px-2 py-1.5 text-sm font-medium transition-colors duration-300 sm:px-3 " +
    (onCard
      ? active
        ? "bg-white/10 text-white"
        : "text-white/60 hover:bg-white/5 hover:text-white"
      : active
        ? "bg-ink/[0.06] text-ink"
        : "text-muted hover:bg-ink/[0.04] hover:text-ink");

  return (
    // While merged into the card, the nav's gutter is the page gutter plus the
    // card's own padding, so the logo lines up with the headline below it.
    <nav
      className={
        "fixed inset-x-0 z-50 transition-[top,padding] duration-300 " +
        (onCard ? "top-6 px-9 sm:top-10 sm:px-18" : "top-6 px-4")
      }
    >
      {/* Only background/border/shadow transition — animating the pill's size
          makes it jitter against the scroll. `relative` because on phones the
          Products panel anchors to the whole pill rather than its button. */}
      <div
        className={
          "relative flex items-center justify-between gap-2 rounded-full border py-2 pl-4 pr-2 backdrop-blur-xl transition-[background-color,border-color,box-shadow,max-width] duration-300 sm:gap-4 " +
          (onCard
            ? "max-w-none border-transparent bg-transparent shadow-none"
            : "mx-auto max-w-3xl border-ink/15 bg-paper/85 shadow-[0_1px_2px_rgba(20,19,15,0.05),0_12px_32px_-12px_rgba(20,19,15,0.35)]")
        }
      >
        <Link href={ROUTES.home} className="group flex shrink-0 items-center gap-2">
          <Image src="/logo.png" alt="SevenFold" width={28} height={28} className="rounded-md" priority />
          <span
            className={
              "hidden font-semibold tracking-tight transition-[color,opacity] duration-300 group-hover:opacity-60 sm:inline " +
              (onCard ? "text-white" : "text-ink")
            }
          >
            SevenFold
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {run && (
            <Link
              href={run.href}
              className={
                "flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm font-medium shadow-[0_0_14px_-2px_var(--accent-bright)] transition-colors duration-300 sm:px-3.5 " +
                (onCard
                  ? "border-accent-bright/40 bg-accent-bright/10 text-accent-bright hover:bg-accent-bright/20"
                  : "border-accent/30 bg-accent/10 text-accent hover:bg-accent/15")
              }
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-bright opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-bright" />
              </span>
              <span className="tabular-nums">{run.step}/{run.steps}</span>
              <span className="hidden sm:inline">{run.label}…</span>
            </Link>
          )}
          {/* Hidden below `sm`: the logo already goes home, and dropping it is
              what lets the rest fit the pill at 375px. */}
          <Link href={ROUTES.home} className={"hidden sm:block " + link(pathname === "/")}>
            Home
          </Link>
          <ProductsMenu onCard={onCard} buttonClass={link(false)} />
          <span className="mx-1 hidden h-5 w-px shrink-0 bg-current opacity-15 sm:block" />
          <AccountLinks onCard={onCard} linkClass={link(false)} />
        </div>
      </div>
    </nav>
  );
}

/**
 * "Products ▾": the dashboard's pages, each with a line on what it does.
 *
 * A mouse opens it by hovering; a click, a tap or the keyboard opens it too,
 * and one opened that way stays open until you pick something, click
 * elsewhere or press Escape — it doesn't vanish just because the pointer
 * drifted off. Signed out, each link goes through sign-in first (`proxy.ts`).
 */
function ProductsMenu({ onCard, buttonClass }: { onCard: boolean; buttonClass: string }) {
  // How it was opened decides how it closes: hover-opened closes when the
  // pointer leaves; anything else waits for a deliberate close.
  const [openedBy, setOpenedBy] = useState<"hover" | "click" | null>(null);
  const open = openedBy !== null;
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenedBy(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenedBy(null);
      // Hand focus back to the button if it was in the panel, so it isn't lost.
      if (rootRef.current?.contains(document.activeElement)) {
        rootRef.current.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  return (
    // Only a positioning anchor from `sm` up. On a phone a fixed-width panel
    // hung off this button runs past the screen edge, so there it anchors to
    // the nav pill instead and spans its full width.
    <div
      ref={rootRef}
      className="shrink-0 sm:relative"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        cancelClose();
        if (!open) setOpenedBy("hover");
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse" || openedBy !== "hover") return;
        // A short grace period, so cutting a corner on the way down to the
        // panel doesn't snap it shut.
        closeTimer.current = setTimeout(() => setOpenedBy(null), 150);
      }}
      onBlur={(e) => {
        // Tabbing out of the menu closes it.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenedBy(null);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          cancelClose();
          // A click on a menu the pointer just opened pins it rather than
          // closing it again under the cursor.
          setOpenedBy(openedBy === "click" ? null : "click");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpenedBy("click");
          }
        }}
        className={"flex items-center gap-1 " + buttonClass + (open ? (onCard ? " text-white" : " text-ink") : "")}
      >
        Products
        <svg
          viewBox="0 0 12 12"
          className={"h-3 w-3 transition-transform duration-200 " + (open ? "rotate-180" : "")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        // The panel's top padding, rather than a margin, is what spaces it
        // from the nav: it keeps the pointer inside the menu all the way down.
        <div
          id={panelId}
          className="absolute inset-x-0 top-full z-50 pt-2 sm:inset-x-auto sm:left-1/2 sm:w-[22rem] sm:-translate-x-1/2 sm:pt-4"
        >
          <ul className="pop-in origin-top overflow-hidden rounded-2xl border border-ink/12 bg-paper p-1.5 shadow-[0_1px_2px_rgba(20,19,15,0.05),0_16px_40px_-16px_rgba(20,19,15,0.4)]">
            {PRODUCTS.map((product) => (
              <li key={product.id}>
                <Link
                  href={product.href}
                  // Close on the way out, even for the page you're already on.
                  onClick={() => setOpenedBy(null)}
                  className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink/[0.04] focus-visible:bg-ink/[0.04] focus-visible:outline-none"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                    <ProductIcon id={product.id} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{product.label}</span>
                    <span className="block text-xs leading-relaxed text-muted">{product.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** "Log in" and "Sign up" until there's an account, then the way back to the dashboard. */
function AccountLinks({ onCard, linkClass }: { onCard: boolean; linkClass: string }) {
  const { isIdentified, loading, configured } = useAuth();

  const filled =
    "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300 " +
    (onCard ? "bg-white text-ink hover:bg-white/85" : "bg-ink text-paper hover:bg-ink-2");

  // No Supabase project configured: nothing is gated, so the dashboard is
  // simply open.
  if (!configured) {
    return (
      <Link href={ROUTES.dashboard} className={filled}>
        Dashboard →
      </Link>
    );
  }

  // Hold the space but stay blank until the session resolves, so the nav
  // doesn't flash "Log in" at someone who is already signed in.
  if (loading) return <div className="h-8 w-16 shrink-0" aria-hidden="true" />;

  if (isIdentified) {
    return (
      <Link href={ROUTES.dashboard} className={filled}>
        Dashboard →
      </Link>
    );
  }

  // Both open the same page — with Google, logging in and signing up are the
  // same round trip — but people look for the word that matches what they
  // came to do.
  const href = signInPath(ROUTES.dashboard);
  return (
    <>
      <Link href={href} className={linkClass}>
        Log in
      </Link>
      <Link href={href} className={filled}>
        Sign up
      </Link>
    </>
  );
}
