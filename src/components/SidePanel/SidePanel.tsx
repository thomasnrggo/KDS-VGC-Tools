"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "../ui/drawer";
import { useIsPhone } from "@/hooks/useIsPhone";
import { cn } from "@/lib/utils";

interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The panel's name, for screen readers. */
  label: string;
  /** Its top bar (tabs, a title, the close button). */
  header: ReactNode;
  children: ReactNode;
}

/**
 * A panel beside a page's content — the Team Builder's analysis and
 * calculator, the Team Report's activity. On desktop it slides in by
 * growing from no width, pushing the content over instead of covering it
 * (place it as the last child of a `flex items-start` row); on phones, where
 * there's no room beside anything, it's a drawer filling the screen.
 */
export function SidePanel({ open, onOpenChange, label, header, children }: SidePanelProps) {
  const isPhone = useIsPhone();
  // Desktop: stays mounted while it slides out (see onTransitionEnd).
  const [isMounted, setIsMounted] = useState(open);
  if (open && !isMounted) setIsMounted(true);
  // Without the transition (reduced motion), nothing's left to wait for.
  if (
    !open &&
    isMounted &&
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    setIsMounted(false);
  }

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
        <DrawerContent style={{ "--drawer-content-width": "100vw" } as CSSProperties}>
          <DrawerTitle className="sr-only">{label}</DrawerTitle>
          {header}
          {open && children}
        </DrawerContent>
      </Drawer>
    );
  }

  if (!isMounted) return null;
  // The panel inside keeps its width, so it's revealed, not squeezed.
  return (
    <aside
      aria-label={label}
      inert={!open}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === "width" && !open) {
          setIsMounted(false);
        }
      }}
      className={cn(
        "sticky top-4 shrink-0 overflow-hidden transition-[width,margin-left,opacity] duration-300 ease-out motion-reduce:transition-none",
        open
          ? "ml-4 w-[min(42rem,45vw)] opacity-100 starting:ml-0 starting:w-0 starting:opacity-0"
          : "ml-0 w-0 opacity-0",
      )}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-[min(42rem,45vw)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-raised">
        {header}
        {children}
      </div>
    </aside>
  );
}
