import { createOpponent, topSortOrder } from "./opponent";
import { parseTeam } from "./parseTeam";
import { validateTeamSize } from "./team";
import { teamFingerprint } from "./teamIdentity";
import {
  asVariantOf,
  candidateGroupsFrom,
  findVariantCandidates,
  groupOpponents,
  type TeamComparison,
} from "./opponentVariants";
import type { BulkImportResult, Opponent, ParsedPokemon } from "@/types";

export interface ImportEntry {
  label: string;
  rawPaste: string;
  pokepasteUrl?: string;
}

/** A group an incoming team could join: an opponent already saved, or an earlier team in the same paste. */
export type ImportTarget =
  | { kind: "existing"; opponent: Opponent }
  | { kind: "entry"; index: number };

export interface ImportCandidate {
  target: ImportTarget;
  /** The group's name as shown in the review — the main opponent's or the earlier entry's label. */
  label: string;
  comparison: TeamComparison;
}

export interface ImportRow {
  label: string;
  rawPaste: string;
  pokepasteUrl?: string;
  pokemon: ParsedPokemon[];
  /** Why this team can't be imported at all (e.g. no Pokémon found). */
  error?: string;
  /** Label of the saved opponent / earlier entry this is an exact duplicate of. */
  duplicateOf?: string;
  /** Groups it could join as a variant, best first. */
  candidates: ImportCandidate[];
}

export type ImportDecision =
  | { action: "new" }
  | { action: "skip" }
  | { action: "variant"; candidateIndex: number };

/**
 * Sorts each incoming team into: can't import (error), exact duplicate (of
 * a saved opponent or an earlier team in this paste), or importable — with
 * any variant candidates attached. Earlier teams in the same paste count as
 * candidate groups too, so a folder holding both halves of a variant pair
 * (e.g. Perish - Kommoo and Perish - Archa) offers to group them.
 *
 * `existing` is one regulation's opponents, in list order.
 */
export function analyzeImport(entries: ImportEntry[], existing: Opponent[]): ImportRow[] {
  const savedGroups = candidateGroupsFrom(groupOpponents(existing)).map((group) => ({
    main: { kind: "existing", opponent: group.main } as ImportTarget,
    members: group.members,
  }));
  const seen = new Map(
    existing.map((opponent) => [teamFingerprint(opponent.team.pokemon), opponent.label]),
  );
  const earlierGroups: typeof savedGroups = [];
  const rows: ImportRow[] = [];

  entries.forEach((entry, index) => {
    const label = entry.label.trim() || "Unnamed team";
    const rawPaste = entry.rawPaste.trim();
    const pokemon = parseTeam(rawPaste);
    const row: ImportRow = {
      label,
      rawPaste,
      pokepasteUrl: entry.pokepasteUrl,
      pokemon,
      candidates: [],
    };
    rows.push(row);

    const error = validateTeamSize(pokemon);
    if (error) {
      row.error = error;
      return;
    }
    const fingerprint = teamFingerprint(pokemon);
    const duplicateOf = seen.get(fingerprint);
    if (duplicateOf !== undefined) {
      row.duplicateOf = duplicateOf;
      return;
    }
    seen.set(fingerprint, label);

    row.candidates = findVariantCandidates(pokemon, [...savedGroups, ...earlierGroups]).map(
      ({ main, comparison }) => ({
        target: main,
        label: main.kind === "existing" ? main.opponent.label : rows[main.index].label,
        comparison,
      }),
    );
    earlierGroups.push({ main: { kind: "entry", index }, members: [pokemon] });
  });

  return rows;
}

/** What the review step pre-selects: skip what can't or shouldn't be imported, join the best variant group if there is one. */
export function defaultDecision(row: ImportRow): ImportDecision {
  if (row.error || row.duplicateOf !== undefined) return { action: "skip" };
  if (row.candidates.length > 0) return { action: "variant", candidateIndex: 0 };
  return { action: "new" };
}

/** True when the review step has something to ask — any importable team with a variant candidate. */
export function importNeedsReview(rows: ImportRow[]): boolean {
  return rows.some(
    (row) => !row.error && row.duplicateOf === undefined && row.candidates.length > 0,
  );
}

/**
 * Builds the opponents to save from the reviewed rows. New teams land on top
 * of the list as a block, in paste order (see docs/opponent-organization.md).
 * A variant of an earlier entry joins whatever group that entry ended up in
 * — its main if it became a variant itself, keeping groups one level deep —
 * or is added as a new team if that entry was skipped.
 */
export function buildImport(
  rows: ImportRow[],
  decisions: ImportDecision[],
  existing: Opponent[],
  regulationId: string,
  importedAt: number = Date.now(),
): { created: Opponent[]; result: BulkImportResult } {
  const created: Opponent[] = [];
  const createdByIndex = new Map<number, Opponent>();
  const byId = new Map(existing.map((opponent) => [opponent.id, opponent]));
  const skipped: string[] = [];
  let variantCount = 0;
  const firstSortOrder = topSortOrder(existing) + rows.length;
  const now = new Date(importedAt).toISOString();

  rows.forEach((row, index) => {
    if (row.error) {
      skipped.push(`${row.label}: ${row.error}`);
      return;
    }
    if (row.duplicateOf !== undefined) {
      skipped.push(`${row.label}: same team as "${row.duplicateOf}"`);
      return;
    }
    const decision = decisions[index] ?? defaultDecision(row);
    if (decision.action === "skip") {
      skipped.push(`${row.label}: skipped`);
      return;
    }

    // createdAt is staggered by 1ms per entry so compareOpponentOrder's
    // createdAt tie-break agrees with the paste order too.
    const timestamp = new Date(importedAt - created.length).toISOString();
    let opponent: Opponent = {
      ...createOpponent(
        row.label,
        row.rawPaste,
        regulationId,
        row.pokepasteUrl,
        firstSortOrder - created.length,
      ),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (decision.action === "variant") {
      const target = row.candidates[decision.candidateIndex]?.target;
      let main: Opponent | undefined;
      if (target?.kind === "existing") {
        main = target.opponent;
      } else if (target?.kind === "entry") {
        main = createdByIndex.get(target.index);
      }
      if (main?.variantOf) main = byId.get(main.variantOf) ?? main;
      if (main) {
        opponent = asVariantOf(opponent, main, now);
        variantCount += 1;
      }
    }

    created.push(opponent);
    createdByIndex.set(index, opponent);
    byId.set(opponent.id, opponent);
  });

  return { created, result: { importedCount: created.length, variantCount, skipped } };
}
