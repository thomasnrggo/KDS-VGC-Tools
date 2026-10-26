import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("rounded-full px-5 py-2 text-sm font-medium transition-colors", {
  variants: {
    variant: {
      /** The main action of a dialog or form (Import, Save, Copy). Same color in both themes. */
      primary: "bg-chrome-600 text-white hover:bg-chrome-700 disabled:opacity-60",
      /** The secondary action beside it (Cancel, Close). */
      outline: "border border-zinc-300 text-zinc-700 hover:bg-zinc-100",
      /** Destructive confirmations (Remove team). */
      danger: "bg-red-600 text-white hover:bg-red-700",
    },
  },
  defaultVariants: { variant: "primary" },
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

/** The app's pill button. Defaults to `type="button"`, so it never submits a form by accident. */
export function Button({ variant, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}

const iconButtonVariants = cva("flex shrink-0 items-center justify-center transition-colors", {
  variants: {
    variant: {
      /** A bordered square (the calc's copy/save buttons). */
      outlined:
        "h-8 w-8 rounded-md border border-zinc-200 bg-raised text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-200",
      /** A small borderless circle (save set, add to roster). */
      ghost: "h-6 w-6 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700",
    },
  },
  defaultVariants: { variant: "outlined" },
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants>;

/** A button holding just one icon — give it an `aria-label`. */
export function IconButton({ variant, className, type = "button", ...props }: IconButtonProps) {
  return (
    <button type={type} className={cn(iconButtonVariants({ variant }), className)} {...props} />
  );
}

/** A quiet text-and-icon link-style action (the calc panels' Import / Export row). */
export function TextAction({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700",
        className,
      )}
      {...props}
    />
  );
}

/** An on/off pill (Mega, Tailwind, Helping Hand…): filled while `active`. */
export function TogglePill({
  active,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-zinc-600 bg-chrome-600 text-white"
          : "border-zinc-300 text-zinc-700 hover:bg-zinc-100",
        className,
      )}
      {...props}
    />
  );
}
