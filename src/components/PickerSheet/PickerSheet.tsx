"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";

/**
 * The part of the screen the keyboard leaves visible. A phone's keyboard
 * covers the page without shrinking the layout viewport, so a plain
 * `fixed inset-0` sheet would put its list under the keyboard; sizing to the
 * visual viewport keeps the search field and the results above it.
 */
function useVisibleViewport(): CSSProperties {
  const [box, setBox] = useState<CSSProperties>({ top: 0, height: "100dvh" });

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const visual = viewport;
    function update() {
      setBox({ top: visual.offsetTop, height: visual.height });
    }
    update();
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    return () => {
      visual.removeEventListener("resize", update);
      visual.removeEventListener("scroll", update);
    };
  }, []);

  return box;
}

interface PickerSheetProps {
  title: string;
  onClose: () => void;
  /** The search field, pinned under the title. */
  search?: ReactNode;
  /** The scrolling list of options. */
  children: ReactNode;
}

/**
 * A full-screen picker for phones: title and close button, an optional
 * search field, then the options filling the rest of the visible screen.
 * Replaces the desktop dropdowns, which on a phone open under the keyboard
 * or off the bottom of a small screen. Locks the page's scroll while open.
 */
export function PickerSheet({ title, onClose, search, children }: PickerSheetProps) {
  const t = useMessages();
  const box = useVisibleViewport();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={box}
      className="fixed inset-x-0 z-50 flex flex-col bg-zinc-50 text-zinc-900"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <Icon name={IconName.Close} size={20} />
        </button>
      </div>
      {search && <div className="shrink-0 border-b border-zinc-200 p-2">{search}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">{children}</div>
    </div>,
    document.body,
  );
}

/** The sheet's search input: 16px text so iOS doesn't zoom the page in when it's focused. */
export const pickerSheetSearchClassName =
  "w-full rounded-lg border border-zinc-300 bg-field px-3 py-2 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";
