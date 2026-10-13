"use client";

import { candidateGroupsFrom, findVariantCandidates, type OpponentGroup } from "@/lib/opponentVariants";
import type { Opponent } from "@/types";
import { Modal } from "../Modal";
import { TeamRoster } from "../TeamRoster";
import { useMessages } from "@/hooks/useLanguage";

interface MakeVariantPickerProps {
  opponent: Opponent;
  /** The regulation's groups, excluding `opponent`'s own. */
  groups: OpponentGroup[];
  onPick: (mainId: string) => void;
  onCancel: () => void;
}

/**
 * Picks which group `opponent` should join — the manual path for teams that
 * were imported before variants existed, or that the detection rules didn't
 * flag. Groups the rules *do* match are listed first as suggestions; every
 * other main follows, since the rules are a guide, not a gate.
 */
export function MakeVariantPicker({ opponent, groups, onPick, onCancel }: MakeVariantPickerProps) {
  const t = useMessages();
  const suggested = findVariantCandidates(opponent.team.pokemon, candidateGroupsFrom(groups));
  const suggestedIds = new Set(suggested.map((candidate) => candidate.main.id));
  const others = groups.map((group) => group.main).filter((main) => !suggestedIds.has(main.id));

  function option(main: Opponent, note?: string) {
    return (
      <li key={main.id}>
        <button
          type="button"
          onClick={() => onPick(main.id)}
          className="flex w-full flex-col gap-1 p-3 text-left hover:bg-zinc-100"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
            {main.label}
            {note && <span className="ml-2 font-normal normal-case text-zinc-500">{note}</span>}
          </span>
          <div className="self-start">
            <TeamRoster pokemon={main.team.pokemon} speedMode="range" />
          </div>
        </button>
      </li>
    );
  }

  return (
    <Modal onClose={onCancel} labelledBy="make-variant-title" size="wide">
      <h2 id="make-variant-title" className="mb-1 text-lg font-semibold text-zinc-900">
        {t.makeVariant.title(opponent.label)}
      </h2>
      <p className="mb-4 text-sm text-zinc-600">
        {t.makeVariant.intro}
      </p>
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
        {suggested.length > 0 && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t.makeVariant.suggested}
            </h3>
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
              {suggested.map(({ main, comparison }) =>
                option(
                  main,
                  t.makeVariant.shared(comparison.sharedPokemon, comparison.sharedMegas > 0),
                ),
              )}
            </ul>
          </section>
        )}
        {others.length > 0 && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {suggested.length > 0 ? t.makeVariant.allOther : t.makeVariant.teams}
            </h3>
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
              {others.map((main) => option(main))}
            </ul>
          </section>
        )}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        {t.common.cancel}
      </button>
    </Modal>
  );
}
