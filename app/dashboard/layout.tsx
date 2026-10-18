import AppShell from "@/components/app-shell/AppShell";

/** The signed-in app. `proxy.ts` sends anyone without an account to sign in first. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
