"use client";

import { useState } from "react";
import { Modal, ModalActions, ModalDescription, ModalTitle } from "../Modal";
import { OpponentTeamPreview } from "../OpponentTeamPreview";
import { LoadingState } from "../LoadingState";
import { Button, TogglePill } from "@/components/Button";
import { useMessages } from "@/hooks/useLanguage";
import { useAllGroupOpponents } from "@/hooks/useAllGroupOpponents";
import { sameTeamKey } from "@/lib/matchupList";
import { groupOpponents } from "@/lib/opponentVariants";
import { cn } from "@/lib/utils";
import type { Opponent, PrepGroup } from "@/types";

interface AddFromListDialogProps {
  /** The open list's name — where the teams go. */
  targetName: string;
  regulationId: string;
  /** What the open list already has, so teams already in it can't be added twice. */
  targetOpponents: Opponent[];
  /** Your own opponents — offered when the open list is a group; omit it when it's your own list. */
  myOpponents?: Opponent[];
  /** The other prep groups for this regulation. */
  groups: PrepGroup[];
  /** The picked teams, in their list's order — the dialog closes after. */
  onAdd: (opponents: Opponent[]) => void;
  onClose: () => void;
}

const MINE = "mine";

/**
 * Brings teams into the open list from another one — your own opponents or a
 * prep group's, for the same regulation — as copies with your picks and
 * notes for them. Teams the open list already has (the same Pokémon and
 * items, see sameTeamKey) are shown but can't be picked.
 */
export function AddFromListDialog({
  targetName,
  regulationId,
  targetOpponents,
  myOpponents,
  groups,
  onAdd,
  onClose,
}: AddFromListDialogProps) {
  const t = useMessages();
  const groupLists = useAllGroupOpponents(groups);
  const sources = [
    ...(myOpponents ? [{ id: MINE, name: t.groups.myOpponents, opponents: myOpponents }] : []),
    ...groupLists.lists.map(({ group, opponents }) => ({
      id: group.id,
      name: group.name,
      opponents,
    })),
  ];
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const source = sources.find((s) => s.id === sourceId) ?? null;
  const isLoading = sourceId !== MINE && groupLists.isLoading;

  const existing = new Set(targetOpponents.map(sameTeamKey));
  // Mains, each followed by its variants — the order they're added in, too.
  const entries = groupOpponents(
    (source?.opponents ?? []).filter((opponent) => opponent.regulationId === regulationId),
  ).flatMap((group) => [
    { opponent: group.main, isVariant: false },
    ...group.variants.map((variant) => ({ opponent: variant, isVariant: true })),
  ]);
  const available = entries.filter(({ opponent }) => !existing.has(sameTeamKey(opponent)));
  const allPicked =
    available.length > 0 && available.every(({ opponent }) => picked.has(opponent.id));

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function chooseSource(id: string) {
    setSourceId(id);
    setPicked(new Set());
  }

  return (
    <Modal onClose={onClose} labelledBy="add-from-list-title" size="wide" fullScreenOnPhone>
      <ModalTitle id="add-from-list-title">{t.groups.addFrom.title(targetName)}</ModalTitle>
      <ModalDescription className="mb-3">{t.groups.addFrom.intro}</ModalDescription>

      {sources.length === 0 ? (
        <p className="text-sm text-zinc-500">{t.groups.addFrom.noLists}</p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label={t.groups.addFrom.fromList}
            className="mb-3 flex flex-wrap gap-1.5"
          >
            {sources.map((s) => (
              <TogglePill
                key={s.id}
                role="tab"
                aria-selected={s.id === sourceId}
                active={s.id === sourceId}
                onClick={() => chooseSource(s.id)}
              >
                {s.name}
              </TogglePill>
            ))}
          </div>

          {isLoading ? (
            <LoadingState />
          ) : entries.length === 0 ? (
            <p className="text-sm text-zinc-500">{t.groups.addFrom.empty}</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                <input
                  type="checkbox"
                  checked={allPicked}
                  disabled={available.length === 0}
                  onChange={() =>
                    setPicked(
                      allPicked ? new Set() : new Set(available.map(({ opponent }) => opponent.id)),
                    )
                  }
                />
                {t.groups.addFrom.selectAll(available.length)}
              </label>
              <ul className="flex max-h-[50vh] min-h-0 flex-1 flex-col divide-y divide-zinc-200 overflow-y-auto rounded-lg border border-zinc-200 sm:max-h-[55vh]">
                {entries.map(({ opponent, isVariant }) => {
                  const isHere = existing.has(sameTeamKey(opponent));
                  return (
                    <li key={opponent.id}>
                      <label
                        className={cn(
                          "flex items-center gap-3 px-3 py-2",
                          isVariant && "pl-8",
                          isHere ? "opacity-50" : "cursor-pointer hover:bg-zinc-100",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isHere || picked.has(opponent.id)}
                          disabled={isHere}
                          onChange={() => toggle(opponent.id)}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <span className="truncate text-xs font-semibold tracking-wide text-zinc-700 uppercase sm:w-48 sm:shrink-0">
                            {opponent.label}
                          </span>
                          <OpponentTeamPreview pokemon={opponent.team.pokemon} />
                        </span>
                        {isHere && (
                          <span className="shrink-0 text-[11px] text-zinc-500">
                            {t.groups.addFrom.alreadyHere}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      <ModalActions className="justify-end">
        <Button variant="outline" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button
          disabled={picked.size === 0}
          onClick={() =>
            onAdd(
              entries.map(({ opponent }) => opponent).filter((opponent) => picked.has(opponent.id)),
            )
          }
        >
          {t.groups.addFrom.add(picked.size)}
        </Button>
      </ModalActions>
    </Modal>
  );
}
