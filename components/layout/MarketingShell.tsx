"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import Footer from "./Footer";

/**
 * The chrome around the public pages: the floating nav, the page, the footer.
 * The document scrolls, so there's a single (body) scrollbar. The dashboard
 * under /app has its own shell (`components/app-shell/AppShell`).
 */
export default function MarketingShell({ children }: { children: React.ReactNode }) {
  const isHome = usePathname() === "/";

  return (
    <div className="relative flex min-h-dvh flex-col">
      <NavBar />
      {/* The nav is `fixed`, so it takes no room in the flow; this spacer does.
          The home page skips it: its hero card starts at the very top and
          reserves the clearance in its own padding, because the nav sits
          inside the card until you scroll. */}
      {!isHome && <div aria-hidden className="h-20 shrink-0" />}
      {/* Pages set their own max-width. The trailing padding is for pages that
          end on bare paper and would otherwise run their last line into the
          footer rule. The home page ends in a full-bleed band with generous
          padding of its own, which butts straight up against the footer. */}
      <main className={"flex-1 " + (isHome ? "" : "pb-24")}>{children}</main>
      <Footer flush={isHome} />
    </div>
  );
}
