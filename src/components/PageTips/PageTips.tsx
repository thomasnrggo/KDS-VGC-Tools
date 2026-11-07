"use client";

import type { ReactNode } from "react";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { IconButton } from "../Button";
import { Icon } from "../Icon";

/**
 * A tool page's tips: what the page is for and what it can do that isn't
 * obvious (a Speed search on Speed Tiers…), in a strip under its title.
 * Its ✕ hides it on this device; the "?" beside the title (PageTipsButton)
 * brings it back. Which pages' tips are hidden is a space-separated list in
 * localStorage, copied onto <html data-hidden-tips> by the root layout's
 * early script — CSS shows the strip or the "?" from it, so neither flashes
 * on load, and closing or reopening needs no re-render.
 */
export const HIDDEN_TIPS_KEY = "hiddenTips";

function setHidden(id: string, hidden: boolean) {
  const root = document.documentElement;
  const ids = new Set((root.dataset.hiddenTips ?? "").split(" ").filter(Boolean));
  if (hidden) ids.add(id);
  else ids.delete(id);
  const value = [...ids].join(" ");
  if (value) root.dataset.hiddenTips = value;
  else delete root.dataset.hiddenTips;
  try {
    if (value) localStorage.setItem(HIDDEN_TIPS_KEY, value);
    else localStorage.removeItem(HIDDEN_TIPS_KEY);
  } catch {
    // Private mode: hidden for this visit only.
  }
}

/** Each page's color, light — a hint, not a banner (the home page has the welcome). */
const ACCENTS = {
  sky: {
    box: "border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/30",
    icon: "bg-sky-600 text-white",
    dot: "bg-sky-500",
    close: "hover:bg-sky-100 dark:hover:bg-sky-900/40",
  },
} as const;

export type PageTipsAccent = keyof typeof ACCENTS;

export interface PageTip {
  /** A few bold words: what you can do. */
  lead: string;
  /** How — `backticks` mark something to type, shown as a key. */
  body: string;
}

/** A tip's body, with its `typed examples` as keys. */
function TipText({ text }: { text: string }) {
  return text.split(/`([^`]+)`/).map((part, index) =>
    index % 2 === 1 ? (
      <kbd
        key={index}
        className="rounded border border-zinc-300 bg-raised px-1 py-px font-mono text-xs text-zinc-900"
      >
        {part}
      </kbd>
    ) : (
      part
    ),
  );
}

export function PageTips({
  id,
  icon,
  accent,
  title,
  body,
  tips,
}: {
  /** Which page — what's stored when it's hidden. */
  id: string;
  icon: IconName;
  accent: PageTipsAccent;
  title: string;
  body: ReactNode;
  tips: PageTip[];
}) {
  const t = useMessages();
  const colors = ACCENTS[accent];
  return (
    <section
      data-page-tips={id}
      aria-label={title}
      className={cn("relative flex flex-col gap-3 rounded-xl border px-4 py-3 sm:px-5", colors.box)}
    >
      {/* This page's show/hide rules (see the comment above), once per page. */}
      <style href={`page-tips-${id}`} precedence="default">
        {`[data-hidden-tips~="${id}"] [data-page-tips="${id}"] { display: none; }
[data-page-tips-reopen="${id}"] { display: none; }
[data-hidden-tips~="${id}"] [data-page-tips-reopen="${id}"] { display: inline-flex; }`}
      </style>
      <IconButton
        variant="ghost"
        onClick={() => setHidden(id, true)}
        aria-label={t.common.hideTips}
        title={t.common.hideTips}
        className={cn(
          "absolute top-2 right-2 h-8 w-8 text-zinc-500 hover:text-zinc-900",
          colors.close,
        )}
      >
        <Icon name={IconName.Close} size={18} />
      </IconButton>
      <div className="flex items-start gap-3 pr-8">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            colors.icon,
          )}
        >
          <Icon name={icon} size={18} />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          <p className="text-sm text-zinc-700">{body}</p>
        </div>
      </div>
      <ul className="grid gap-x-6 gap-y-2 lg:grid-cols-3">
        {tips.map((tip) => (
          <li key={tip.lead} className="flex gap-2 text-sm text-zinc-700">
            <span
              aria-hidden="true"
              className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)}
            />
            <span>
              <span className="font-semibold text-zinc-900">{tip.lead}</span>{" "}
              <TipText text={tip.body} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The "?" beside a page's title that brings its tips back — shown only while they're hidden. */
export function PageTipsButton({ id }: { id: string }) {
  const t = useMessages();
  return (
    <IconButton
      variant="ghost"
      data-page-tips-reopen={id}
      onClick={() => setHidden(id, false)}
      aria-label={t.common.showTips}
      title={t.common.showTips}
      className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
    >
      <Icon name={IconName.Help} size={20} />
    </IconButton>
  );
}
