"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * App-wide toast host, mounted once in the root layout — call the `toast()`
 * function (re-exported from this folder's index) from anywhere to show one.
 * Styled to match this app's zinc palette/card look (border-zinc-200,
 * rounded-lg) instead of sonner's default theme; success/error keep the
 * green-600/red-600 this app already uses elsewhere (e.g. the Damage
 * Calculator's copy-confirmation checkmark, import error text).
 */
// Toasts sit above whichever bar is fixed to the bottom of the screen — the
// Damage Calculator's roster bar (--calc-bar-height, MobileRosterBar) or the
// Matchup Planner's team bar (--mobile-bar-height, MyTeamHeader) — instead of
// covering it. Both are 0 when there's no bar. 24px/16px are sonner's own
// desktop/phone gaps.
const bottomBars = "var(--calc-bar-height, 0px) + var(--mobile-bar-height, 0px)";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      offset={{ bottom: `calc(${bottomBars} + 24px)` }}
      mobileOffset={{ bottom: `calc(${bottomBars} + 16px)` }}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-zinc-200 bg-zinc-50 shadow-lg p-4 flex gap-3 items-start",
          title: "text-sm font-medium text-zinc-900",
          description: "text-sm text-zinc-600",
          closeButton:
            "!bg-zinc-50 !border-zinc-200 !text-zinc-500 hover:!text-zinc-700",
          success: "!border-green-200 [&_[data-icon]]:!text-green-600",
          error: "!border-red-200 [&_[data-icon]]:!text-red-600",
        },
      }}
    />
  );
}
