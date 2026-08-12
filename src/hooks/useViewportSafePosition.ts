"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";

const SAFE_MARGIN = 8;

/**
 * Positions a floating element (tooltip/dropdown) against its trigger,
 * clamped to stay within the viewport instead of spilling off an edge —
 * centered under the trigger by default, sliding left/right as needed, and
 * flipping above the trigger when it wouldn't fit below. Re-measured on every
 * animation frame while open (not just once) because the page can still be
 * reflowing shortly after load — sprite/item images and fonts loading in
 * shift row heights — and a one-shot measurement goes stale if that happens
 * while the floating element is already open.
 */
export function useViewportSafePosition(
  isOpen: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!isOpen) return;

    let frameId: number;

    function updatePosition() {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (trigger && content) {
        const triggerRect = trigger.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();

        const idealLeft = triggerRect.left + triggerRect.width / 2 - contentRect.width / 2;
        const maxLeft = window.innerWidth - contentRect.width - SAFE_MARGIN;
        const left = Math.min(Math.max(idealLeft, SAFE_MARGIN), Math.max(maxLeft, SAFE_MARGIN));

        const fitsBelow =
          triggerRect.bottom + 4 + contentRect.height + SAFE_MARGIN <= window.innerHeight;
        const top = fitsBelow
          ? triggerRect.bottom + 4
          : triggerRect.top - contentRect.height - 4;

        setStyle((prev) =>
          prev.left === left && prev.top === top ? prev : { position: "fixed", left, top },
        );
      }
      frameId = requestAnimationFrame(updatePosition);
    }

    frameId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable, don't need to be deps
  }, [isOpen]);

  return style;
}
