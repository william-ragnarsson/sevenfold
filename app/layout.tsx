import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import AnalysisProvider from "@/components/features/analyze/AnalysisProvider";
import AuthProvider from "@/components/features/auth/AuthProvider";
import "./globals.css";

// Archivo is Associate's typeface. Italic is loaded too, for the few places
// that use it (playbook emphasis, form placeholders), so they aren't faked.
const archivo = Archivo({
  variable: "--font-archivo",
  style: ["normal", "italic"],
  subsets: ["latin"],
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vcanalyst.williamragnarsson.dev";
const title = "SevenFold - AI VC analyst, 800+ decks distilled";
const description =
  "Top 6 of 250. 800 pitch decks reviewed. Everything I learned, distilled into an AI.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "SevenFold",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${geistMono.variable} antialiased`}
    >
      <body className="relative min-h-screen overflow-x-hidden">
        {/* Auth wraps analysis: starting a run needs a user, so AnalysisProvider
            consumes useAuth(). This layout stays a static server component —
            the session is read client-side, which keeps the landing page
            statically rendered. The one gate, on /app, is in proxy.ts, so
            nothing here needs to know who the user is before the first paint.
            The chrome around the page comes from the route groups:
            (marketing) has the floating nav and footer, (app) the dashboard's
            sidebar. Both sit inside these providers, so a run keeps going
            across the two. */}
        <AuthProvider>
          <AnalysisProvider>{children}</AnalysisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
