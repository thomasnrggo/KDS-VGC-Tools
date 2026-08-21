"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * App-wide toast host, mounted once in the root layout — call the `toast()`
 * function (re-exported from this folder's index) from anywhere to show one.
 * Styled to match this app's mauve palette/card look (border-mauve-200,
 * rounded-lg) instead of sonner's default theme; success/error keep the
 * green-600/red-600 this app already uses elsewhere (e.g. the Damage
 * Calculator's copy-confirmation checkmark, import error text).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-mauve-200 bg-white shadow-lg p-4 flex gap-3 items-start",
          title: "text-sm font-medium text-mauve-900",
          description: "text-sm text-mauve-600",
          closeButton:
            "!bg-white !border-mauve-200 !text-mauve-500 hover:!text-mauve-700",
          success: "!border-green-200 [&_[data-icon]]:!text-green-600",
          error: "!border-red-200 [&_[data-icon]]:!text-red-600",
        },
      }}
    />
  );
}
