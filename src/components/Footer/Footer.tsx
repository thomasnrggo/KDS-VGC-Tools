"use client";

import { usePathname } from "next/navigation";
import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

const TWITTER_URL = "https://x.com/AnthosVGC";
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/thomasnrggo";

export function Footer() {
  const t = useMessages();
  // Hidden on the Damage Calculator below lg: its roster bar is fixed to the
  // bottom there, and the footer only added scrolling under it.
  const isCalc = usePathname() === "/damage-calc";
  return (
    <footer
      className={cn(
        "bg-zinc-100 px-6 py-4 text-center text-xs text-zinc-700",
        isCalc && "hidden lg:block",
      )}
    >
      {/* One line: the credit, then the coffee button — wrapping onto two on narrow screens. */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-medium">
        <p>
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
        <span aria-hidden="true" className="hidden text-zinc-400 sm:inline">
          ·
        </span>
        <p className="flex items-center gap-2">
          {t.footer.enjoying}
          {/* Buy Me a Coffee's own yellow and black, the same in both themes. */}
          <a
            href={BUY_ME_A_COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FFDD00] px-3 py-1 font-semibold text-black transition-opacity hover:opacity-85"
          >
            <span aria-hidden="true">☕</span>
            {t.footer.buyMeACoffee}
          </a>
        </p>
      </div>
      <p className="mt-2 text-zinc-500">{t.footer.disclaimer}</p>
    </footer>
  );
}
