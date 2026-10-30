"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cva, type VariantProps } from "class-variance-authority";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

const triggerVariants = cva(
  "flex min-w-0 items-center whitespace-nowrap select-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none",
  {
    variants: {
      variant: {
        /** A small rounded pill — the list pages' regulation filter. */
        pill: "shrink-0 gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 py-1 pr-2.5 pl-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 data-popup-open:bg-zinc-100",
        /** Full width, matching the text inputs beside it in a form. */
        field:
          "w-full justify-between gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-left text-sm text-zinc-900",
        /** Tight, for controls inside a dense row (the calculator's stages and hit counts). */
        compact: "shrink-0 gap-0.5 rounded-full border px-1.5 py-0.5 text-xs",
      },
    },
    defaultVariants: { variant: "pill" },
  },
);

interface SelectProps extends VariantProps<typeof triggerVariants> {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Leave out when a wrapping `<label>` names it. */
  ariaLabel?: string;
  title?: string;
  /** Merged onto the trigger. */
  className?: string;
}

/**
 * The app's dropdown for picking one of a set of options — use it instead of
 * a native `<select>`, whose popup is the platform's own (a tiny floating menu
 * on iOS) rather than the app's.
 */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  title,
  variant,
  className,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      items={options}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next);
      }}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        title={title}
        className={cn(triggerVariants({ variant }), className)}
      >
        <SelectPrimitive.Value className="truncate" />
        <SelectPrimitive.Icon className="flex shrink-0 opacity-70">
          <Icon name={IconName.ExpandMore} size={variant === "compact" ? 12 : 14} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        {/* Above dialogs and sheets (z-50), which some of these sit in. */}
        <SelectPrimitive.Positioner
          alignItemWithTrigger={false}
          align={variant === "field" ? "start" : "end"}
          sideOffset={6}
          className="z-60 outline-none select-none"
        >
          <SelectPrimitive.Popup className="min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-zinc-200 bg-raised p-1 shadow-lg transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <SelectPrimitive.List className="max-h-[min(var(--available-height),20rem)] overflow-y-auto">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  // Phones get a full-height tap target; desktop a compact row.
                  className="flex min-h-11 cursor-default items-center justify-between gap-4 rounded-lg px-3 text-sm text-zinc-800 outline-none data-highlighted:bg-zinc-100 md:min-h-8 data-selected:font-semibold"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="flex text-zinc-700">
                    <Icon name={IconName.Check} size={16} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
