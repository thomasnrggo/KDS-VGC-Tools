"use client";

import { useState } from "react";
import { Button, TextAction } from "../Button";
import { Modal, ModalActions, ModalDescription, ModalTitle } from "../Modal";
import { PokemonReportCard } from "../PokemonReportCard";
import { PokemonSprite } from "../PokemonSprite";
import { toast } from "../Toast";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import {
  createSnapshot,
  matchesSnapshot,
  restoreSlotMap,
  restoreSnapshot,
  snapshotChanges,
  teamFromSnapshot,
  withSnapshot,
  withoutSnapshot,
  type SnapshotChange,
} from "@/lib/teamSnapshots";
import { timeAgo } from "@/lib/timeAgo";
import type { SlotMap } from "@/lib/rosterSlots";
import { cn } from "@/lib/utils";
import type { Team, TeamSnapshot } from "@/types";

const FIELD_CLASSES =
  "min-w-0 flex-1 rounded-lg border border-zinc-300 bg-field px-3 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none";

/** Changes listed per snapshot before "and N more". */
const SHOWN_CHANGES = 6;

interface TeamVersionsProps {
  team: Team;
  /** Applies an edit to the team (the page's updateTeam). */
  onUpdate: (updater: (team: Team) => Team) => void;
  /** A snapshot made a team of its own: save it and open it. */
  onCopy: (team: Team, name: string) => void;
  /** After a restore moved the roster: plans and logged games that pick from it follow (restorePokemonEverywhere). */
  onRemap: (map: SlotMap) => void;
  /** Who's saving, on a collaborative team. */
  createdBy?: string;
  onClose: () => void;
}

/**
 * The team's versions (src/lib/teamSnapshots.ts), from its page's ⋯: save the
 * team as it is now, and for each saved one see what's changed since, view
 * it, restore it (the team now is saved first), make it a team of its own,
 * or delete it.
 */
export function TeamVersions({
  team,
  onUpdate,
  onCopy,
  onRemap,
  createdBy,
  onClose,
}: TeamVersionsProps) {
  const t = useMessages();
  const v = t.versions;
  const { appLanguage } = useLanguageSettings();
  const [name, setName] = useState("");
  const snapshots = team.snapshots ?? [];
  const unchanged = snapshots.find((snapshot) => matchesSnapshot(team, snapshot));
  const defaultName = new Date().toLocaleDateString(appLanguage, { dateStyle: "medium" });

  function save() {
    const snapshot = createSnapshot(team, name.trim() || defaultName, { createdBy });
    onUpdate((current) => withSnapshot(current, snapshot));
    setName("");
  }

  return (
    <Modal onClose={onClose} labelledBy="team-versions-title" size="wide">
      <ModalTitle id="team-versions-title">{v.title}</ModalTitle>
      <ModalDescription>{v.description}</ModalDescription>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={v.namePlaceholder(defaultName)}
          aria-label={v.nameLabel}
          maxLength={80}
          className={FIELD_CLASSES}
        />
        <Button type="submit" disabled={!!unchanged} className="px-4 py-1.5 text-sm">
          {v.save}
        </Button>
      </form>
      {unchanged && <p className="-mt-2 text-xs text-zinc-500">{v.noChanges(unchanged.name)}</p>}

      {snapshots.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          {v.empty}
        </p>
      ) : (
        <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
          {snapshots.map((snapshot) => (
            <SnapshotRow
              key={snapshot.id}
              team={team}
              snapshot={snapshot}
              when={timeAgo(snapshot.createdAt, appLanguage)}
              onRestore={() => {
                onUpdate((current) =>
                  restoreSnapshot(current, snapshot, v.beforeRestoreName(snapshot.name), {
                    createdBy,
                  }),
                );
                const map = restoreSlotMap(team.pokemon, snapshot.data.pokemon);
                if (map) onRemap(map);
                toast.success(v.restored(snapshot.name));
                onClose();
              }}
              onCopy={() =>
                onCopy(teamFromSnapshot(team, snapshot), v.copyName(team.name, snapshot.name))
              }
              onDelete={() => onUpdate((current) => withoutSnapshot(current, snapshot.id))}
            />
          ))}
        </ul>
      )}

      <ModalActions className="justify-end">
        <Button variant="outline" onClick={onClose} className="px-4 py-2 text-sm">
          {t.common.close}
        </Button>
      </ModalActions>
    </Modal>
  );
}

function SnapshotRow({
  team,
  snapshot,
  when,
  onRestore,
  onCopy,
  onDelete,
}: {
  team: Team;
  snapshot: TeamSnapshot;
  when: string;
  onRestore: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const t = useMessages();
  const v = t.versions;
  const [isViewing, setIsViewing] = useState(false);
  const [confirming, setConfirming] = useState<"restore" | "delete" | null>(null);
  const isCurrent = matchesSnapshot(team, snapshot);
  const changes = isCurrent ? [] : snapshotChanges(snapshot.data, team);
  const describe = useChangeText();

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-raised p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-zinc-900">{snapshot.name}</span>
        {snapshot.auto && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
            {v.automatic}
          </span>
        )}
        <span className="text-xs text-zinc-500">
          {when}
          {snapshot.createdBy && ` · ${v.by(snapshot.createdBy)}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-0.5">
        {snapshot.data.pokemon.map((mon, index) => (
          <PokemonSprite key={index} species={mon.species} item={mon.item} size={36} />
        ))}
      </div>
      {isCurrent ? (
        <p className="text-xs font-medium text-green-700 dark:text-green-400">{v.current}</p>
      ) : (
        <div className="text-xs text-zinc-600">
          <p className="font-medium text-zinc-500">{v.changedSince}</p>
          <ul className="mt-0.5 flex flex-col">
            {changes.slice(0, SHOWN_CHANGES).map((change, index) => (
              <li key={index}>{describe(change)}</li>
            ))}
            {changes.length > SHOWN_CHANGES && (
              <li className="text-zinc-400">{v.more(changes.length - SHOWN_CHANGES)}</li>
            )}
          </ul>
        </div>
      )}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-zinc-700">
            {confirming === "restore" ? v.confirmRestore : v.confirmDelete}
          </span>
          <TextAction
            onClick={confirming === "restore" ? onRestore : onDelete}
            className={cn(confirming === "delete" && "text-red-700 dark:text-red-400")}
          >
            {confirming === "restore" ? v.restore : v.delete}
          </TextAction>
          <TextAction onClick={() => setConfirming(null)}>{t.common.cancel}</TextAction>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <TextAction onClick={() => setIsViewing((open) => !open)} aria-expanded={isViewing}>
            {isViewing ? v.hide : v.view}
          </TextAction>
          {!isCurrent && (
            <TextAction onClick={() => setConfirming("restore")}>{v.restore}</TextAction>
          )}
          <TextAction onClick={onCopy}>{v.copy}</TextAction>
          <TextAction
            onClick={() => setConfirming("delete")}
            className="text-red-700 dark:text-red-400"
          >
            {v.delete}
          </TextAction>
        </div>
      )}

      {isViewing && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.data.pokemon.map((mon, index) => (
            <PokemonReportCard key={index} pokemon={mon} />
          ))}
        </div>
      )}
    </li>
  );
}

/** One change since a snapshot, in words: "Charizard: Charizardite Y → Choice Specs · +Air Slash, −Overheat". */
function useChangeText() {
  const t = useMessages();
  const v = t.versions;
  const text = usePokemonText();
  const none = "—";
  const signed = (value: number) => (value > 0 ? `+${value}` : `−${-value}`);
  return (change: SnapshotChange): string => {
    switch (change.kind) {
      case "added":
        return v.added(text.species(change.species));
      case "removed":
        return v.removed(text.species(change.species));
      case "strategy":
        return v.strategy(change.parts.map((part) => v.parts[part]).join(", "));
      case "changed": {
        const parts: string[] = [];
        if (change.item) {
          const [from, to] = change.item.map((item) => (item ? text.item(item) : none));
          parts.push(`${from} → ${to}`);
        }
        if (change.ability) {
          const [from, to] = change.ability.map((ability) =>
            ability ? text.ability(ability) : none,
          );
          parts.push(`${from} → ${to}`);
        }
        if (change.nature) {
          const [from, to] = change.nature.map((nature) => (nature ? text.nature(nature) : none));
          parts.push(`${from} → ${to}`);
        }
        const moves = [
          ...change.movesAdded.map((move) => `+${text.move(move)}`),
          ...change.movesRemoved.map((move) => `−${text.move(move)}`),
        ];
        if (moves.length) parts.push(moves.join(", "));
        if (change.points.length) {
          parts.push(
            change.points
              .map(({ stat, delta }) => `${signed(delta)} ${t.stats.short[stat]}`)
              .join(", "),
          );
        }
        return `${text.species(change.species)}: ${parts.join(" · ") || v.formChanged}`;
      }
    }
  };
}
