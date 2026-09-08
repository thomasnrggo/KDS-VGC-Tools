import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/Toast";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VGC Tools",
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
      <body className="min-h-full flex flex-col bg-mauve-50 pb-[var(--mobile-bar-height,0px)] lg:pb-0">
        {children}
        <Footer />
        <Toaster />
        <FirebaseAnalytics />
      </body>
    </html>
  );
}
