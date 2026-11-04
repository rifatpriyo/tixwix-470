import type { Metadata } from "next";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "./globals.css";
import { Navigation } from "@/components/navigation";

export const metadata: Metadata = {
  title: {
    default: "TixWix | Good things happen together",
    template: "%s | TixWix",
  },
  description:
    "Your TixWix account connects you to the world of live events. Apply to become an approved organizer.",
};
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only fixed left-4 top-4 z-50 rounded-md bg-white p-3 focus:not-sr-only"
        >
          Skip to content
        </a>
        <Navigation />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-5 py-6 text-xs text-muted-foreground sm:px-8">
            <span>© TixWix · Made for shared experiences.</span>
            <span>Accounts & organizer onboarding</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
