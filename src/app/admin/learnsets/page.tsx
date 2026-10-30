"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useLearnsetOverrides } from "@/hooks/useLearnsetOverrides";
import { AuthMenu } from "@/components/AuthMenu";
import { Button, TextAction } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { PokemonSprite } from "@/components/PokemonSprite";
import { TypeIcon } from "@/components/TypeIcon";
import { toast } from "@/components/Toast";
import { IconName } from "@/enums";
import movesData from "@/data/moves.json";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import {
  generatedMoves,
  learnableMoves,
  loadLearnsets,
  withMove,
  type LearnsetData,
} from "@/lib/learnsets";
import type { MoveData } from "@/types";
import { cn } from "@/lib/utils";

const MOVES = movesData as unknown as Record<string, MoveData>;
const MAX_SPECIES = 150;
const MAX_MOVE_RESULTS = 30;

function moveName(key: string): string {
  return MOVES[key]?.name ?? key;
}

const byName = (a: string, b: string) => moveName(a).localeCompare(moveName(b));

/**
 * Corrects the Team Builder's learnsets: the generated ones come from
 * Showdown's data (scripts/generate-learnsets.mjs), which has no Pokémon
 * Champions movepools — here the admin removes moves a Pokémon doesn't learn
 * in Champions and adds ones it misses. Each change is saved right away to
 * appConfig/learnsetOverrides (see src/lib/learnsets.ts). Admin-only, so
 * English-only like the other admin pages.
 */
export default function AdminLearnsetsPage() {
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { overrides, isLoading: overridesLoading, saveSpecies } = useLearnsetOverrides();
  const [data, setData] = useState<LearnsetData | null>(null);
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [editedOnly, setEditedOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [moveQuery, setMoveQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLearnsets().then((loaded) => {
      if (!cancelled) setData(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-zinc-700">Sign in to continue.</p>
        <Button onClick={signInWithGoogle}>Sign in with Google</Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-zinc-900">Not authorized</p>
        <p className="text-sm text-zinc-600">This page is only available to the site admin.</p>
        <Link href="/matchup-planner" className="text-sm font-medium text-zinc-600 hover:underline">
          ← Back to Matchup Planner
        </Link>
      </div>
    );
  }

  const speciesKeys = data
    ? [...new Set([...Object.keys(data.learnsets), ...Object.keys(overrides)])].sort((a, b) =>
        formatSpeciesDisplayName(a).localeCompare(formatSpeciesDisplayName(b)),
      )
    : [];
  const foldedSpecies = foldForSearch(speciesQuery.trim());
  const matchingSpecies = speciesKeys.filter(
    (key) =>
      (!editedOnly || overrides[key]) &&
      (!foldedSpecies || foldForSearch(formatSpeciesDisplayName(key)).includes(foldedSpecies)),
  );

  const generated = data && selected ? generatedMoves(data, selected) : null;
  const learnable = data && selected ? learnableMoves(data, overrides, selected) : null;
  const override = selected ? overrides[selected] : undefined;
  const added = new Set(override?.add ?? []);
  const learned = [...(learnable ?? [])].sort(byName);
  const removed = [...(override?.remove ?? [])].sort(byName);
  const foldedMove = foldForSearch(moveQuery.trim());
  const addable = foldedMove
    ? Object.keys(MOVES)
        .filter(
          (key) =>
            !learnable?.has(key) &&
            (foldForSearch(moveName(key)).includes(foldedMove) || key.includes(foldedMove)),
        )
        .sort(byName)
        .slice(0, MAX_MOVE_RESULTS)
    : [];

  async function setLearns(move: string, learns: boolean) {
    if (!selected) return;
    setIsSaving(true);
    try {
      await saveSpecies(selected, withMove(override, generated, move, learns));
      toast.success(
        `${learns ? "Added" : "Removed"} ${moveName(move)} ${learns ? "to" : "from"} ${formatSpeciesDisplayName(selected)}`,
      );
    } catch (error) {
      console.error("[admin/learnsets] save failed:", error);
      toast.error("Couldn't save that change.");
    } finally {
      setIsSaving(false);
    }
  }

  async function reset() {
    if (!selected) return;
    setIsSaving(true);
    try {
      await saveSpecies(selected, null);
      toast.success(`${formatSpeciesDisplayName(selected)} is back to the generated learnset`);
    } catch (error) {
      console.error("[admin/learnsets] reset failed:", error);
      toast.error("Couldn't save that change.");
    } finally {
      setIsSaving(false);
    }
  }

  function moveRow(move: string, action: { label: string; onClick: () => void }, tag?: string) {
    const data = MOVES[move];
    return (
      <li
        key={move}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-zinc-900 hover:bg-zinc-100"
      >
        <span className="min-w-0 flex-1 truncate font-medium">{moveName(move)}</span>
        {tag && (
          <span className="shrink-0 rounded-full bg-green-100 px-1.5 text-[10px] font-semibold text-green-800 uppercase">
            {tag}
          </span>
        )}
        {data && <TypeIcon type={data.type} size={14} />}
        <span className="w-14 shrink-0 text-[10px] text-zinc-500 uppercase">{data?.category}</span>
        <button
          type="button"
          onClick={action.onClick}
          disabled={isSaving}
          aria-label={`${action.label} ${moveName(move)}`}
          title={`${action.label} ${moveName(move)}`}
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-50"
        >
          {action.label}
        </button>
      </li>
    );
  }

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-field px-2.5 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-chrome-600 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/matchup-planner"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            ← Matchup Planner
          </Link>
          <h1 className="text-lg font-semibold text-white">Admin: Learnsets</h1>
          <Link
            href="/admin/features"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            Features →
          </Link>
        </div>
        <AuthMenu
          user={user}
          isLoading={isAuthLoading}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
        />
      </header>

      <div className="flex flex-col gap-4 p-6">
        <p className="max-w-3xl text-sm text-zinc-600">
          The Team Builder lists only the moves a Pokémon learns. They come from Showdown&apos;s
          learnsets (any generation, pre-evolutions included), which don&apos;t have Pokémon
          Champions&apos; movepools — correct them here. Each change is saved right away and applies
          to everyone.
        </p>

        {!data || overridesLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
            {/* Pick a Pokémon. */}
            <section className="flex min-w-0 flex-col gap-2">
              <input
                value={speciesQuery}
                onChange={(event) => setSpeciesQuery(event.target.value)}
                placeholder="Search Pokémon…"
                aria-label="Search Pokémon"
                className={inputClass}
              />
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={editedOnly}
                  onChange={(event) => setEditedOnly(event.target.checked)}
                />
                Only edited ({Object.keys(overrides).length})
              </label>
              <ul className="flex max-h-[70vh] flex-col overflow-y-auto rounded-lg border border-zinc-200 p-1">
                {matchingSpecies.slice(0, MAX_SPECIES).map((key) => {
                  const edit = overrides[key];
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(key);
                          setMoveQuery("");
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-zinc-900 hover:bg-zinc-100",
                          selected === key && "bg-zinc-200",
                        )}
                      >
                        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded">
                          <PokemonSprite species={formatSpeciesDisplayName(key)} fill />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {formatSpeciesDisplayName(key)}
                        </span>
                        {edit && (
                          <span className="shrink-0 text-[11px] font-medium text-zinc-500 tabular-nums">
                            {edit.add?.length ? `+${edit.add.length}` : ""}
                            {edit.add?.length && edit.remove?.length ? " " : ""}
                            {edit.remove?.length ? `−${edit.remove.length}` : ""}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {matchingSpecies.length === 0 && (
                  <li className="p-2 text-xs text-zinc-500">No Pokémon match.</li>
                )}
                {matchingSpecies.length > MAX_SPECIES && (
                  <li className="p-2 text-[11px] text-zinc-500">
                    Showing the first {MAX_SPECIES} — type to narrow down.
                  </li>
                )}
              </ul>
            </section>

            {/* Its moves. */}
            {selected ? (
              <section className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-500/20">
                    <PokemonSprite species={formatSpeciesDisplayName(selected)} fill />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <h2 className="text-lg font-semibold text-zinc-900">
                      {formatSpeciesDisplayName(selected)}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      {learned.length} moves · {generated?.size ?? 0} generated
                      {added.size > 0 && ` · ${added.size} added`}
                      {removed.length > 0 && ` · ${removed.length} removed`}
                    </p>
                  </div>
                  {override && (
                    <TextAction onClick={reset} disabled={isSaving} className="ml-auto">
                      <Icon name={IconName.Close} size={14} />
                      Reset to generated
                    </TextAction>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Add a move
                  </h3>
                  <input
                    value={moveQuery}
                    onChange={(event) => setMoveQuery(event.target.value)}
                    placeholder="Search moves it doesn't learn yet…"
                    aria-label="Search moves to add"
                    className={cn(inputClass, "max-w-md")}
                  />
                  {foldedMove && (
                    <ul className="flex max-w-xl flex-col rounded-lg border border-zinc-200 p-1">
                      {addable.length === 0 ? (
                        <li className="p-2 text-xs text-zinc-500">No moves match.</li>
                      ) : (
                        addable.map((move) =>
                          moveRow(move, { label: "Add", onClick: () => setLearns(move, true) }),
                        )
                      )}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      Learns ({learned.length})
                    </h3>
                    <ul className="flex flex-col rounded-lg border border-zinc-200 p-1">
                      {learned.map((move) =>
                        moveRow(
                          move,
                          { label: "Remove", onClick: () => setLearns(move, false) },
                          added.has(move) ? "Added" : undefined,
                        ),
                      )}
                    </ul>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      Removed ({removed.length})
                    </h3>
                    {removed.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        None — every generated move is listed.
                      </p>
                    ) : (
                      <ul className="flex flex-col rounded-lg border border-zinc-200 p-1">
                        {removed.map((move) =>
                          moveRow(move, { label: "Restore", onClick: () => setLearns(move, true) }),
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <p className="text-sm text-zinc-500">Pick a Pokémon to see and correct its moves.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
