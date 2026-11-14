"use client";

import { useState } from "react";
import { IconName } from "@/enums";
import { cn } from "@/lib/utils";
import { Icon } from "../Icon";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "../ui/drawer";

/**
 * Phones: a page's tabs as one button showing the current one, opening a
 * bottom sheet with all of them — instead of pill tabs wrapping onto two
 * rows. Hidden from `sm` up, where the pills show (the page renders those).
 */
export function SectionPicker<T extends string>({
  title,
  options,
  value,
  onChange,
  className,
}: {
  /** The sheet's title, and the button's label ("Team sections: Overview"). */
  title: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen} showSwipeHandle>
      <DrawerTrigger
        render={
          <button
            type="button"
            aria-label={`${title}: ${current?.label ?? ""}`}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-raised px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 sm:hidden",
              className,
            )}
          />
        }
      >
        {current?.label}
        <Icon name={IconName.ExpandMore} size={18} className="text-zinc-500" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-1 p-3 pt-1 pb-6">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-current={option.value === value ? "page" : undefined}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "flex min-h-12 items-center justify-between rounded-lg px-3 text-left text-base font-medium",
                option.value === value
                  ? "bg-chrome-600 text-white"
                  : "text-zinc-800 active:bg-zinc-200",
              )}
            >
              {option.label}
              {option.value === value && <Icon name={IconName.Check} size={18} />}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
