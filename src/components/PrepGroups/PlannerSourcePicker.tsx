"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import type { PrepGroup } from "@/types";
import { cn } from "@/lib/utils";

interface PlannerSourcePickerProps {
  /** The open list: "personal" or a group id. */
  source: string;
  activeGroups: PrepGroup[];
  archivedGroups: PrepGroup[];
  isSignedIn: boolean;
  onSelect: (source: string) => void;
  onCreateGroup: () => void;
  onSignIn: () => void;
}

const ITEM_CLASSES =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100";

/**
 * The Matchup Planner's heading, as a menu: switches between your own
 * opponent list and your prep groups (see docs/prep-groups.md), and starts a
 * new group.
 */
export function PlannerSourcePicker({
  source,
  activeGroups,
  archivedGroups,
  isSignedIn,
  onSelect,
  onCreateGroup,
  onSignIn,
}: PlannerSourcePickerProps) {
  const t = useMessages();
  const [isOpen, setIsOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = [...activeGroups, ...archivedGroups].find((group) => group.id === source);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
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

  function pick(next: string) {
    onSelect(next);
    setIsOpen(false);
  }

  function groupItem(group: PrepGroup) {
    return (
      <button
        key={group.id}
        type="button"
        role="menuitemradio"
        aria-checked={source === group.id}
        onClick={() => pick(group.id)}
        className={cn(ITEM_CLASSES, source === group.id && "font-semibold text-zinc-900")}
      >
        <Icon name={IconName.Group} size={16} className="shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1 truncate">{group.name}</span>
        <span className="shrink-0 text-xs text-zinc-400">
          {t.groups.members(group.memberUids.length)}
        </span>
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t.groups.switchList}
        className="flex min-w-0 items-center gap-1 rounded-lg py-0.5 pr-1 text-left hover:bg-zinc-100"
      >
        {current && <Icon name={IconName.Group} size={20} className="shrink-0 text-zinc-500" />}
        <span className="truncate text-xl font-semibold text-zinc-900">
          {current ? current.name : t.groups.myOpponents}
        </span>
        <Icon name={IconName.ExpandMore} size={20} className="shrink-0 text-zinc-500" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t.groups.switchList}
          className="absolute top-full left-0 z-30 mt-1 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={source === "personal" || !current}
            onClick={() => pick("personal")}
            className={cn(ITEM_CLASSES, !current && "font-semibold text-zinc-900")}
          >
            <Icon name={IconName.Description} size={16} className="shrink-0 text-zinc-500" />
            {t.groups.myOpponents}
          </button>

          {isSignedIn ? (
            <>
              {activeGroups.length > 0 && (
                <p className="border-t border-zinc-200 px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                  {t.groups.groupsHeading}
                </p>
              )}
              {activeGroups.map(groupItem)}
              {archivedGroups.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowArchived((value) => !value)}
                    aria-expanded={showArchived}
                    className="flex w-full items-center justify-between border-t border-zinc-200 px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700"
                  >
                    {t.groups.archivedHeading} ({archivedGroups.length})
                    <Icon
                      name={showArchived ? IconName.ExpandLess : IconName.ExpandMore}
                      size={14}
                    />
                  </button>
                  {showArchived && archivedGroups.map(groupItem)}
                </>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onCreateGroup();
                }}
                className={cn(ITEM_CLASSES, "border-t border-zinc-200")}
              >
                <Icon name={IconName.Add} size={16} className="shrink-0 text-zinc-500" />
                {t.groups.newGroup}
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onSignIn();
              }}
              className={cn(ITEM_CLASSES, "border-t border-zinc-200 text-zinc-500")}
            >
              <Icon name={IconName.Group} size={16} className="shrink-0" />
              {t.groups.signInForGroups}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
