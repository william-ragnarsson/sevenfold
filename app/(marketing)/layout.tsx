import MarketingShell from "@/components/layout/MarketingShell";

/** The public site: the landing page, sign-in and the OAuth consent screen. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
