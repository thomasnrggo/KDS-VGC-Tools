"use client";

import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

/**
 * What a page shows while its saved data loads (a spinner and "Loading…"),
 * so the list appears once, already complete — rather than an empty state or
 * a local copy that the cloud sync then replaces.
 */
export function LoadingState({ className }: { className?: string }) {
  const t = useMessages();
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-3 py-16 text-sm text-zinc-500",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"
      />
      {t.common.loading}
    </div>
  );
}
