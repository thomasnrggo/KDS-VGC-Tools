/**
 * Which moves each species learns: the generated learnsets
 * (src/data/learnsets.json, see scripts/generate-learnsets.mjs — Showdown's
 * data, which has no Pokémon Champions movepools) plus the admin's
 * corrections on top (appConfig/learnsetOverrides, edited at
 * /admin/learnsets). Moves are moves.json keys, species species.json keys.
 */

export interface LearnsetData {
  /** Every move key, once — each species lists indexes into it. */
  moves: string[];
  learnsets: Record<string, number[]>;
}

/** The admin's correction to one species' generated learnset. */
export interface LearnsetOverride {
  /** Moves it learns that the generated learnset misses. */
  add?: string[];
  /** Generated moves it doesn't learn (in Champions). */
  remove?: string[];
}

export type LearnsetOverrides = Record<string, LearnsetOverride>;

let learnsetsPromise: Promise<LearnsetData> | null = null;

/** The generated learnsets — ~350 KB, so loaded only where it's needed (the builder, the admin page). */
export function loadLearnsets(): Promise<LearnsetData> {
  learnsetsPromise ??= import("@/data/learnsets.json").then(
    (module) => module.default as LearnsetData,
  );
  return learnsetsPromise;
}

/** A species' generated moves, or null when the data doesn't cover it. */
export function generatedMoves(data: LearnsetData, speciesKey: string): Set<string> | null {
  const indexes = data.learnsets[speciesKey];
  return indexes ? new Set(indexes.map((index) => data.moves[index])) : null;
}

/**
 * A species' moves with the admin's override applied: generated + added −
 * removed. Null when neither the data nor an override covers it (then every
 * move is offered).
 */
export function learnableMoves(
  data: LearnsetData,
  overrides: LearnsetOverrides,
  speciesKey: string,
): Set<string> | null {
  const generated = generatedMoves(data, speciesKey);
  const override = overrides[speciesKey];
  if (!generated && !override?.add?.length) return null;
  const moves = new Set(generated ?? []);
  for (const move of override?.add ?? []) moves.add(move);
  for (const move of override?.remove ?? []) moves.delete(move);
  return moves;
}

/**
 * The override after making `move` learnable or not — kept minimal: a
 * generated move is only ever in `remove`, any other only in `add`. Returns
 * null once there's nothing left to override.
 */
export function withMove(
  override: LearnsetOverride | undefined,
  generated: Set<string> | null,
  move: string,
  learns: boolean,
): LearnsetOverride | null {
  const add = new Set(override?.add ?? []);
  const remove = new Set(override?.remove ?? []);
  add.delete(move);
  remove.delete(move);
  const isGenerated = generated?.has(move) ?? false;
  if (learns && !isGenerated) add.add(move);
  if (!learns && isGenerated) remove.add(move);
  if (add.size === 0 && remove.size === 0) return null;
  return {
    ...(add.size > 0 && { add: [...add].sort() }),
    ...(remove.size > 0 && { remove: [...remove].sort() }),
  };
}
