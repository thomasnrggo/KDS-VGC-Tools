export interface ParsedPokemon {
  /** Canonical Showdown species name, e.g. "Landorus-Therian" — used to resolve the sprite. */
  species: string;
  item?: string;
  /** Display-only in the hover card — never validated or computed on. */
  ability?: string;
  moves?: string[];
  /**
   * These two are shown as pasted, but are also fed into calculateFinalStats
   * (see src/lib/stats/) to compute Level 50 stats for the hover card. A
   * missing evs line defaults to 0 per stat there. There's no ivs field — this
   * app targets Pokémon Champions, which removed IVs entirely (every Pokémon
   * is always 31 in every stat), so nothing would ever populate it.
   */
  nature?: string;
  /**
   * Raw EVs line as pasted, e.g. "32 HP / 4 SpD / 32 Spe". In Pokémon Champions
   * these values are Stat Points (0-32 per stat, 66 total), not classic 0-252
   * EVs, despite the paste still labeling the line "EVs:" — calculateFinalStats
   * converts (1 SP = 8 EV) before applying the stat formula.
   */
  evs?: string;
}

/** An index into this team's own `pokemon`, or null for "not picked yet" — same convention as MatchupPlan's PokemonSlot (see opponent.ts), just referencing this team's roster instead of an opponent-planning team. */
export type TeamPokemonSlot = number | null;

/**
 * A named Lead/Back combination for this team — the Team Report page's
 * "Common combinations" panel supports adding any number of these, each
 * independent (unlike MatchupPlan, which is one plan per opponent — a
 * combination isn't tied to any particular opponent).
 */
export interface TeamCombination {
  id: string;
  leadPair: [TeamPokemonSlot, TeamPokemonSlot];
  backPair: [TeamPokemonSlot, TeamPokemonSlot];
  leadMega: [boolean, boolean];
  backMega: [boolean, boolean];
  notes: string;
}

/** Which way a calc goes, from the team owner's side: their Pokémon attacking, or being attacked. */
export type TeamCalcSide = "offensive" | "defensive";

/**
 * One entry of the Team Report's Calcs tab — usually a pasted Showdown-calc
 * line, sometimes a free-text comment pasted alongside them. `text` is the
 * source of truth; attacker/defender/% range are parsed from it when shown
 * (see src/lib/teamCalcs.ts and docs/team-report.md).
 */
export interface TeamCalc {
  id: string;
  text: string;
  /** speciesIdentity of the Pokémon of this team it's filed under, or null if unknown. */
  species: string | null;
  side: TeamCalcSide | null;
}

/**
 * What a shared Team Report reveals. "open" follows VGC open team sheets —
 * Pokémon, items, abilities and moves, but no Stat Points or nature (and so
 * no computed stats, and no Poképaste link, which would show them).
 * "closed" shares everything the report shows.
 */
export type TeamSheetMode = "open" | "closed";

/** Set when the team's report is shared (see src/lib/sharedTeam.ts); absent means private. */
export interface TeamShare {
  sheet: TeamSheetMode;
}

/**
 * The public copy of a shared Team Report — Firestore `sharedTeams/{teamId}`,
 * readable by anyone with the link, written only by its owner (see
 * firestore.rules). Built by toSharedTeam, which strips what an open sheet
 * hides; the owner's notes, plans and calcs are never included.
 */
export interface SharedTeam {
  id: string;
  ownerUid: string;
  name: string;
  creator?: string;
  pokepasteUrl?: string;
  replicaCode?: string;
  /** The team overview (rich text HTML), when it has any text. */
  overview?: string;
  sheet: TeamSheetMode;
  pokemon: ParsedPokemon[];
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  rawPaste: string;
  pokemon: ParsedPokemon[];
  /**
   * Regulation.id(s) (see src/data/regulations) this team is legal/usable
   * under — lets the My Teams, Tournaments, and Speed Tiers pages filter by
   * regulation, same reasoning as Opponent.regulationId. Always has at least
   * one entry: the regulation it was originally built under. A team can be
   * tagged with additional regulations later (see addRegulationTag in
   * src/lib/team.ts) when its roster is also legal there — regulations
   * aren't guaranteed to be supersets of each other (bans happen, not just
   * additions), so this is never inferred automatically from release order.
   * Teams saved before this field existed, or before it was pluralized, are
   * backfilled/migrated to a single-entry array by normalizeTeam.
   */
  regulationIds: string[];
  /**
   * Rich text (HTML from RichTextEditor, see src/components/RichTextEditor)
   * notes shown on the Team Report page — overall team notes, not tied to any
   * one Pokémon or combination. A value saved before the field was rich text
   * is still plain text, which RichTextEditor displays fine as-is (TipTap
   * treats an un-tagged string as a single paragraph) — no migration needed.
   */
  notes?: string;
  /** Rich text (HTML) "what does this team struggle against" notes, shown on the Team Report page — see notes' doc comment for the plain-text/HTML compatibility note, which applies here too. */
  weaknesses?: string;
  /** Per-Pokémon notes on the Team Report page, keyed by index into `pokemon`. */
  pokemonNotes?: Record<number, string>;
  /** "Common combinations" the Team Report page lists — add as many as you want. */
  combinations?: TeamCombination[];
  /** "Team overview" — rich text (RichTextEditor HTML) describing the team. Unlike notes, it's part of a shared report. */
  overview?: string;
  /** Who built the team — shown on the Team Report (and its shared copy). */
  creator?: string;
  /** Link to the team on pokepast.es. */
  pokepasteUrl?: string;
  /** In-game replica code for renting the team. */
  replicaCode?: string;
  /** Present when the report is shared — see TeamShare. */
  share?: TeamShare;
  /** Benchmark damage calcs on the Team Report's Calcs tab, in pasted order. */
  calcs?: TeamCalc[];
  /** ISO timestamp of when this team was archived, or absent/undefined if it's active. Archiving is reversible (see unarchiveTeam) — it just moves the team out of the switcher and the My Teams "Active" tab, it never deletes anything. */
  archivedAt?: string;
  /**
   * Manual My Teams list position — higher sorts first (see sortByCustomOrder
   * in useMyTeams.ts), so a freshly created team (sortOrder: Date.now(), the
   * largest value in practice) lands at the top by default. Dragging to
   * reorder (see reorderTeams in src/lib/team.ts) only ever redistributes the
   * sortOrder values already held by the *visible* teams being reordered —
   * it never touches a team outside that set, so reordering one regulation's
   * list can't disturb another's. Teams saved before this field existed are
   * backfilled by normalizeTeam using their own updatedAt as a stand-in,
   * which preserves their prior creation-order relative to each other.
   */
  sortOrder: number;
  updatedAt: string;
}
