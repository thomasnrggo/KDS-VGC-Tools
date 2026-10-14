"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";

interface RowActionsMenuProps {
  /** Omit to leave out the Edit item — e.g. My Teams rows, edited on the team's own page. */
  onEdit?: () => void;
  /** Omit to leave out the Remove item — e.g. a prep-group opponent someone else added. */
  onRemove?: () => void;
  /** Used for the trigger's aria-label/title and the dropdown's aria-label — e.g. "Opponent options", "Team options". */
  label: string;
  editLabel?: string;
  removeLabel?: string;
  /** An optional third item between Edit and Remove — e.g. Archive/Unarchive. Omit for rows that don't need one (opponents). */
  middleAction?: {
    label: string;
    icon: IconName;
    onClick: () => void;
  };
  /** Further items after the middle one (before Remove), e.g. an opponent's Move up/down. A disabled item stays visible but greyed out. */
  extraActions?: RowAction[];
}

export interface RowAction {
  label: string;
  icon: IconName;
  onClick: () => void;
  disabled?: boolean;
}

/** A "..." button that opens a small Edit/Remove dropdown (plus an optional middle item) — shared by any row that used to show separate edit/delete icon buttons (opponents, teams). */
export function RowActionsMenu({
  onEdit,
  onRemove,
  label,
  editLabel,
  removeLabel,
  middleAction,
  extraActions = [],
}: RowActionsMenuProps) {
  const t = useMessages();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const clickedTrigger = menuRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={label}
        title={t.rowActions.moreOptions}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-400 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-100 hover:text-zinc-500"
      >
        <Icon name={IconName.MoreVert} size={16} />
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 py-1 shadow-lg"
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onEdit();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
            >
              <Icon name={IconName.Edit} size={16} />
              {editLabel ?? t.common.edit}
            </button>
          )}
          {middleAction && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                middleAction.onClick();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
            >
              <Icon name={middleAction.icon} size={16} />
              {middleAction.label}
            </button>
          )}
          {extraActions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
            >
              <Icon name={action.icon} size={16} />
              {action.label}
            </button>
          ))}
          {onRemove && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onRemove();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Icon name={IconName.Delete} size={16} />
              {removeLabel ?? t.common.remove}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
