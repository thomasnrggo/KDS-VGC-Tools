"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
  /** "wide" for content that needs more than the default form width, e.g. a roster next to a picker. */
  size?: "default" | "wide";
}

export function Modal({ onClose, labelledBy, children, size = "default" }: ModalProps) {
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16 sm:items-center sm:pt-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
        className={`w-full ${size === "wide" ? "max-w-3xl" : "max-w-xl"} rounded-lg bg-zinc-50 p-6 shadow-xl`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
