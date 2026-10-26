import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/Toast";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Sets the "dark" class on <html> before the page paints, so there's no
 * flash of the wrong theme while React hydrates — this has to run as a
 * blocking (not deferred) script, since the whole point is that it finishes
 * before first paint. Mirrors useTheme's own storage key/fallback exactly
 * (localStorage "theme" if the user's picked one before, else the OS-level
 * prefers-color-scheme) so the class this sets is never immediately
 * contradicted once useTheme's effect runs on mount. Also sets <html lang>
 * from the app language (see useLanguage), for screen readers and spelling.
 */
const THEME_INIT_SCRIPT = `
  (function () {
    try {
      var stored = localStorage.getItem("theme");
      var isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) document.documentElement.classList.add("dark");
      var language = localStorage.getItem("appLanguage");
      if (language === "es") document.documentElement.lang = language;
    } catch (e) {}
  })();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VGC Box",
  description:
    "Plan Pokémon VGC matchups: your team, opponent teams, and lead/back game plans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-zinc-50 pb-[calc(var(--mobile-bar-height,0px)+var(--calc-bar-height,0px))] xl:pb-0">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <TooltipProvider>
          {children}
          <Footer />
        </TooltipProvider>
        <Toaster />
        <FirebaseAnalytics />
      </body>
    </html>
  );
}
