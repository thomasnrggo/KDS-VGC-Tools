"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

interface RowActionsMenuProps {
  onEdit: () => void;
  onRemove: () => void;
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
}

/** A "..." button that opens a small Edit/Remove dropdown (plus an optional middle item) — shared by any row that used to show separate edit/delete icon buttons (opponents, teams). */
export function RowActionsMenu({
  onEdit,
  onRemove,
  label,
  editLabel = "Edit",
  removeLabel = "Remove",
  middleAction,
}: RowActionsMenuProps) {
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
        title="More options"
        className="flex h-7 w-7 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700"
      >
        <Icon name={IconName.MoreVert} size={16} />
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-mauve-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onEdit();
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mauve-700 hover:bg-mauve-100"
          >
            <Icon name={IconName.Edit} size={16} />
            {editLabel}
          </button>
          {middleAction && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                middleAction.onClick();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mauve-700 hover:bg-mauve-100"
            >
              <Icon name={middleAction.icon} size={16} />
              {middleAction.label}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onRemove();
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Icon name={IconName.Delete} size={16} />
            {removeLabel}
          </button>
        </div>
      )}
    </div>
  );
}
