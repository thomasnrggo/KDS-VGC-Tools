"use client";

import { useEffect, useRef } from "react";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Icon
        name={IconName.Search}
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mauve-400"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-full border border-mauve-300 bg-white py-2 pl-9 pr-9 text-sm text-mauve-800 placeholder:text-mauve-400 focus:outline-none focus:ring-2 focus:ring-mauve-400"
      />
      {/* Doubles as "close search" (once the query is empty) when onClose is
          given — used where a leading toggle icon is the only other way to
          close it, and hidden while the field is showing since it's
          redundant with this field's own icon. */}
      {(query || onClose) && (
        <button
          type="button"
          onClick={() => (query ? onQueryChange("") : onClose?.())}
          aria-label={query ? "Clear search" : "Close search"}
          title={query ? "Clear search" : "Close search"}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-mauve-400 hover:bg-mauve-100 hover:text-mauve-700"
        >
          <Icon name={IconName.Close} size={14} />
        </button>
      )}
    </div>
  );
}
