"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalProps {
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
  /** "wide" for content that needs more than the default form width, e.g. a roster next to a picker. */
  size?: "default" | "wide";
  /**
   * Below sm, fill the whole screen (no backdrop margin or rounded card) as a
   * flex column: give the part that should take the spare height `flex-1`
   * (e.g. a paste textarea) and the actions end up at the bottom.
   */
  fullScreenOnPhone?: boolean;
}

export function Modal({
  onClose,
  labelledBy,
  children,
  size = "default",
  fullScreenOnPhone,
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className={cn(
        // Centered with auto margins, not items-center: a dialog taller than the
        // window then scrolls from its top instead of being cut off above it.
        "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 sm:p-4",
        fullScreenOnPhone ? "" : "p-4 pt-16",
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "w-full sm:my-auto",
          size === "wide" ? "max-w-3xl" : "max-w-xl",
          "bg-zinc-50 shadow-xl sm:rounded-lg sm:p-6",
          fullScreenOnPhone
            ? "flex h-dvh flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:block sm:h-auto"
            : "rounded-lg p-6",
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** The dialog's heading — pass the same `id` as the Modal's `labelledBy`. */
export function ModalTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("mb-1 text-lg font-semibold text-zinc-900", className)} {...props} />;
}

/** The line of explanation under the title. */
export function ModalDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mb-4 text-sm text-zinc-600", className)} {...props} />;
}

/** The row of buttons at the bottom. */
export function ModalActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 flex gap-2", className)} {...props} />;
}
