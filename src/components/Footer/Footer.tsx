"use client";

import { useMessages } from "@/hooks/useLanguage";

const TWITTER_URL = "https://x.com/AnthosVGC";

export function Footer() {
  const t = useMessages();
  return (
    <footer className="bg-zinc-100 px-6 py-4 text-center text-xs text-zinc-700">
      <p className="font-medium">
        {t.footer.credit} [
        <a
          href={TWITTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-900 underline hover:text-zinc-700"
        >
          Twitter
        </a>
        ]
      </p>
      <p className="mt-1 text-zinc-500">
        {t.footer.disclaimer}
      </p>
    </footer>
  );
}
