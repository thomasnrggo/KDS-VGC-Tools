import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** A monospace text box for Showdown pastes (import and export). */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
