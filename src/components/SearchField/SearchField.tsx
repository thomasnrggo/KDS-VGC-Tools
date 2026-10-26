"use client";

import { useEffect, useRef } from "react";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

interface SearchFieldProps {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** Omit when the field is always visible (e.g. desktop) — there's nothing to "close" then, so the trailing button only clears once there's a query. */
  onClose?: () => void;
  /** Only for a field that mounts in response to a toggle action (e.g. tapping a search icon) — autofocusing an always-visible field would steal focus on every render. */
  autoFocus?: boolean;
  className?: string;
}

/** A search input with a leading icon and a trailing clear/close button — shared by any section that used to hand-roll this (opponents, teams). */
export function SearchField({
  query,
  onQueryChange,
  placeholder,
  ariaLabel,
  onClose,
  autoFocus = false,
  className,
}: SearchFieldProps) {
  const t = useMessages();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={cn("relative", className ?? "")}>
      <Icon
        name={IconName.Search}
        size={18}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-full border border-zinc-300 bg-zinc-50 py-2 pr-9 pl-9 text-sm text-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
      />
      {/* Doubles as "close search" (once the query is empty) when onClose is
          given — used where a leading toggle icon is the only other way to
          close it, and hidden while the field is showing since it's
          redundant with this field's own icon. */}
      {(query || onClose) && (
        <button
          type="button"
          onClick={() => (query ? onQueryChange("") : onClose?.())}
          aria-label={query ? t.search.clear : t.search.close}
          title={query ? t.search.clear : t.search.close}
          className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <Icon name={IconName.Close} size={14} />
        </button>
      )}
    </div>
  );
}
