import Image from "next/image";
import type { ReactNode } from "react";

/**
 * The card every account surface is drawn on: the sign-in card in all three of
 * its homes, and the set-a-password page. Only the frame — each caller fills
 * it, starting with `AuthCardLogo`.
 */
export default function AuthCard({
  onClose,
  className = "",
  children,
}: {
  /** Adds a close button in the corner, for the modal. */
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "relative rounded-3xl border border-ink/10 bg-white p-6 shadow-[0_1px_2px_rgba(20,25,35,0.05),0_24px_56px_-24px_rgba(20,25,35,0.4)] " +
        className
      }
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <div className="relative">{children}</div>
    </div>
  );
}

export function AuthCardLogo() {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={40}
      height={40}
      className="rounded-xl shadow-[0_1px_2px_rgba(20,25,35,0.1)] ring-1 ring-ink/10"
    />
  );
}
