"use client";

import { useState } from "react";
import { calculateStatBreakdown } from "@/lib/stats/calculateFinalStats";
import { applyStatOverrides, type StatOverrides } from "@/lib/stats/applyStatOverrides";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { parseTeam } from "@/lib/parseTeam";
import { formatPokemonPaste, formatTeamPaste } from "@/lib/formatPokemonPaste";
import { WEATHER_SPEED_DOUBLING_ABILITIES, NATURE_MODIFIERS } from "@/constants";
import { REGULATIONS, megaStoneItemsForSpecies } from "@/data/regulations";
import abilitiesData from "@/data/abilities.json";
import movesData from "@/data/moves.json";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { TypeIcon } from "../TypeIcon";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { toast } from "../Toast";
import { IconName } from "@/enums";
import { SearchableSelect, type SearchableSelectOption } from "./SearchableSelect";
import type { DamageCalcOptions, MoveData, Opponent, ParsedPokemon, StatKey } from "@/types";

const NATURE_NAMES = Object.keys(NATURE_MODIFIERS);
const ABILITIES = abilitiesData as unknown as Record<string, string[]>;
const MOVES = movesData as unknown as Record<string, MoveData>;

/** Every legal Regulation M-B species — only one regulation exists today, see src/data/regulations/index.ts. This is the *only* way to pick a Pokémon's identity now (team/opponent selection is deliberately omitted, see PLANNING.md) — the header's active team is reachable only via the side "teammates" strip. */
const SPECIES_OPTIONS: SearchableSelectOption[] = REGULATIONS[0].speciesKeys.map((key) => {
  const label = formatSpeciesDisplayName(key);
  return { id: key, label, sprite: label };
});

/** Every move in the data set, for the move-search combobox — moves aren't Regulation-gated (this app doesn't enforce per-species learnsets, see PLANNING.md). */
const MOVE_OPTIONS: SearchableSelectOption[] = Object.entries(MOVES).map(([key, move]) => ({
  id: key,
  label: move.name ?? key,
}));


/** Builds a fresh from-scratch Pokémon for a given species.json key — defaults to its first (non-hidden) ability, no item, Hardy nature, no moves. Shared by the species search here and by DamageCalculator's "no active team" default. */
export function buildCustomPokemon(speciesKey: string): ParsedPokemon {
  return {
    species: formatSpeciesDisplayName(speciesKey),
    ability: ABILITIES[speciesKey]?.[0],
    nature: "Hardy",
    moves: [],
  };
}

/** The very first Regulation M-B species (used as the ultimate fallback default when no team is active). */
export const DEFAULT_SPECIES_KEY = REGULATIONS[0].speciesKeys[0];

/** One entry in a side's sidebar — the working roster for that side, up to MAX_SIDEBAR_POKEMON. `isCustom` tracks whether this entry came from the species search (freely editable ability/item/moves) or was loaded from a real pasted team (read-only identity). */
export interface SidebarEntry {
  pokemon: ParsedPokemon;
  isCustom: boolean;
}

export const MAX_SIDEBAR_POKEMON = 6;

export const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};
const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];

function natureLabel(name: string): string {
  const modifier = NATURE_MODIFIERS[name];
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  if (!modifier?.increased || !modifier.decreased) return capitalized;
  return `${capitalized} (+${STAT_LABELS[modifier.increased]}, -${STAT_LABELS[modifier.decreased]})`;
}

function clampStatPoints(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(32, Math.round(value)));
}

/** All 25 natures, for the nature search combobox — id is the lowercase key `applyStatOverrides` expects, label is the human-readable "+/-" form `natureLabel` already produces. */
const NATURE_OPTIONS: SearchableSelectOption[] = NATURE_NAMES.map((name) => ({
  id: name,
  label: natureLabel(name),
}));

/** The standard 7-value status list — only Burned (damage) and Paralyzed (Speed) currently change any computed number; the rest are tracked for reference only, same as the reference calculator's dropdown. */
export type PokemonStatus =
  | "Healthy"
  | "Burned"
  | "Poisoned"
  | "Badly Poisoned"
  | "Paralyzed"
  | "Asleep"
  | "Frozen";

const STATUS_OPTIONS: PokemonStatus[] = [
  "Healthy",
  "Burned",
  "Poisoned",
  "Badly Poisoned",
  "Paralyzed",
  "Asleep",
  "Frozen",
];

/** Per-Pokémon battle state (as opposed to per-side Field conditions) — status, current HP, and stat stages all belong to the individual Pokémon, not the side. */
export interface PokemonBattleState {
  status: PokemonStatus;
  /** 0-100, percent of max HP. */
  currentHpPercent: number;
  atkStage: number;
  defStage: number;
  spaStage: number;
  spdStage: number;
  speStage: number;
}

export const DEFAULT_BATTLE_STATE: PokemonBattleState = {
  status: "Healthy",
  currentHpPercent: 100,
  atkStage: 0,
  defStage: 0,
  spaStage: 0,
  spdStage: 0,
  speStage: 0,
};

const STAGE_OPTIONS = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6];

const STAGE_KEY_BY_STAT: Partial<Record<StatKey, keyof PokemonBattleState>> = {
  atk: "atkStage",
  def: "defStage",
  spa: "spaStage",
  spd: "spdStage",
  spe: "speStage",
};

/** Same -6..+6 stage formula the engine uses (calculateDamage.ts's STAT_STAGE_MULTIPLIERS) — duplicated here only for display purposes (the Speed badge), not fed back into the damage formula itself. */
function statStageMultiplier(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

interface RosterPokemonPickerProps {
  title: string;
  /** This side's working roster (up to MAX_SIDEBAR_POKEMON) — the sidebar strip's content, and the source of the currently displayed Pokémon (`sidebar[selectedIndex]`). Seeded differently per side by DamageCalculator.tsx (Attacker from the header's active team if any, Defender starts with a single default species) but edited identically here. */
  sidebar: SidebarEntry[];
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  /** Adds a species (from either the main search or the sidebar's own "+" tile) — appends if under the cap, otherwise replaces the currently selected entry. */
  onAddPokemon: (pokemon: ParsedPokemon) => void;
  /** Importing more than one Pokémon at once (a full team paste) replaces this side's whole sidebar rather than appending, since a multi-mon paste represents "this is my team," not "add one more." */
  onImportTeam: (pokemon: ParsedPokemon[]) => void;
  onRemovePokemon: (index: number) => void;
  mega: boolean;
  onMegaChange: (mega: boolean) => void;
  weather?: DamageCalcOptions["weather"];
  tailwind?: boolean;
  battleState: PokemonBattleState;
  onBattleStateChange: (state: PokemonBattleState) => void;
  statOverrides: StatOverrides;
  onStatOverridesChange: (overrides: StatOverrides) => void;
  onAbilityChange?: (ability: string) => void;
  onItemChange?: (item: string | undefined) => void;
  onMovesChange?: (moves: string[]) => void;
  /** Saved opponents from the Matchup Planner, for a "Load Team" picker — only passed for the Defender side (the Attacker already seeds from the header's active team), so the button only renders there. */
  loadableOpponents?: Opponent[];
}

export function RosterPokemonPicker({
  title,
  sidebar,
  selectedIndex,
  onSelectIndex,
  onAddPokemon,
  onImportTeam,
  onRemovePokemon,
  mega,
  onMegaChange,
  weather,
  tailwind,
  battleState,
  onBattleStateChange,
  statOverrides,
  onStatOverridesChange,
  onAbilityChange,
  onItemChange,
  onMovesChange,
  loadableOpponents,
}: RosterPokemonPickerProps) {
  const [isAddingToSidebar, setIsAddingToSidebar] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isExportTeamOpen, setIsExportTeamOpen] = useState(false);
  const [isLoadOpponentOpen, setIsLoadOpponentOpen] = useState(false);
  const selected = selectedIndex !== null ? sidebar[selectedIndex] : undefined;
  const pokemon = selected?.pokemon ?? null;

  function submitImport() {
    const trimmed = importText.trim();
    if (!trimmed) {
      setImportError("Paste a Pokémon's (or a full team's) Showdown export text first.");
      return;
    }
    try {
      const parsed = parseTeam(trimmed);
      if (parsed.length === 0) {
        setImportError("Couldn't read that as a Pokémon — check the format and try again.");
        return;
      }
      if (parsed.length === 1) {
        onAddPokemon(parsed[0]);
      } else {
        onImportTeam(parsed.slice(0, MAX_SIDEBAR_POKEMON));
      }
      setImportText("");
      setImportError(null);
      setIsImportOpen(false);
    } catch {
      // parseTeam only throws via parsePokemonBlock on a genuinely empty
      // block, already excluded by splitIntoBlocks — this catch is a
      // defensive fallback, not a real expected path, so the message stays
      // generic.
      setImportError("Couldn't read that as a Pokémon — check the format and try again.");
    }
  }

  function closeImport() {
    setIsImportOpen(false);
    setImportText("");
    setImportError(null);
  }

  const importModalTitleId = `${title.toLowerCase()}-import-modal-title`;
  const loadOpponentModalTitleId = `${title.toLowerCase()}-load-opponent-modal-title`;

  function loadOpponentTeam(opponent: Opponent) {
    onImportTeam(opponent.team.pokemon.slice(0, MAX_SIDEBAR_POKEMON));
    setIsLoadOpponentOpen(false);
    toast.success(`Loaded ${opponent.label} onto ${title}`);
  }

  async function copyExportText() {
    if (!pokemon) return;
    try {
      await navigator.clipboard.writeText(formatPokemonPaste(pokemon));
      toast.success(`Copied ${pokemon.species} to clipboard`);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  const teamExportText = formatTeamPaste(sidebar.map((entry) => entry.pokemon));
  const exportTeamModalTitleId = `${title.toLowerCase()}-export-team-modal-title`;

  async function copyTeamExportText() {
    try {
      await navigator.clipboard.writeText(teamExportText);
      toast.success(`Copied ${title} team (${sidebar.length} Pokémon) to clipboard`);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  const hasMegaForm = pokemon
    ? candidateFormKeys(pokemon.species, pokemon.item).length > 1
    : false;
  const effectivePokemon =
    pokemon && hasMegaForm && !mega ? { ...pokemon, item: undefined } : pokemon;
  // Edited Stat Points/nature layer on top of the pasted build — theorycraft
  // only, never written back to the saved team.
  const overriddenPokemon = effectivePokemon
    ? applyStatOverrides(effectivePokemon, statOverrides)
    : undefined;
  const breakdown = overriddenPokemon ? calculateStatBreakdown(overriddenPokemon) : null;
  const finalStats = breakdown?.final ?? null;
  const effectiveAbility = effectivePokemon
    ? resolveEffectiveAbility(
        effectivePokemon.species,
        effectivePokemon.item,
        effectivePokemon.ability,
      )
    : undefined;
  const currentNature = overriddenPokemon?.nature ?? "Hardy";
  // Ability options for the current FORM (mega-aware — Charizard-Mega-X only
  // has Tough Claws, not Blaze/Solar Power) — only meaningful when
  // onAbilityChange is provided (a custom Pokémon), since a pasted team's
  // ability line is read-only.
  const abilityFormKey = effectivePokemon
    ? candidateFormKeys(effectivePokemon.species, effectivePokemon.item)[0]
    : undefined;
  const abilityOptions = abilityFormKey ? (ABILITIES[abilityFormKey] ?? []) : [];
  const abilitySelectOptions: SearchableSelectOption[] = abilityOptions.map((name) => ({
    id: name,
    label: name,
  }));
  const megaStoneOptions = pokemon ? megaStoneItemsForSpecies(normalizeSpeciesKey(pokemon.species)) : [];
  // Flat, searchable item list (mirrors MOVE_OPTIONS' shape) — a real
  // pasted team's item might not be in the Regulation M-B list (an
  // older/off-meta paste), so it's injected as its own option first so the
  // combobox still reflects it accurately instead of silently dropping it.
  const itemOptions: SearchableSelectOption[] = pokemon
    ? [
        ...(pokemon.item &&
        !megaStoneOptions.includes(pokemon.item) &&
        !REGULATIONS[0].items.includes(pokemon.item)
          ? [{ id: pokemon.item, label: pokemon.item }]
          : []),
        ...megaStoneOptions.map((item) => ({ id: item, label: `${item} (Mega Stone)` })),
        ...REGULATIONS[0].items.map((item) => ({ id: item, label: item })),
      ]
    : [];

  function updateSp(stat: StatKey, value: number) {
    onStatOverridesChange({
      ...statOverrides,
      sp: { ...statOverrides.sp, [stat]: clampStatPoints(value) },
    });
  }

  const speedDoublingAbility = weather ? WEATHER_SPEED_DOUBLING_ABILITIES[weather] : undefined;
  const abilityDoublesSpeed = !!effectiveAbility && effectiveAbility === speedDoublingAbility;
  const speStageMultiplier = statStageMultiplier(battleState.speStage);
  const paralysisMultiplier = battleState.status === "Paralyzed" ? 0.5 : 1;
  // Swift Swim/Chlorophyll/etc., Tailwind, the Speed stat stage, and
  // Paralysis all stack multiplicatively — not modeling other Speed-changers
  // (Quick Feet, Unburden; Choice Scarf is already handled by
  // calculateFinalStats) beyond what's already covered elsewhere.
  const abilityTailwindMultiplier = (abilityDoublesSpeed ? 2 : 1) * (tailwind ? 2 : 1);
  const totalSpeedMultiplier = abilityTailwindMultiplier * speStageMultiplier * paralysisMultiplier;
  const speedLabelParts = [
    abilityDoublesSpeed ? effectiveAbility : null,
    tailwind ? "Tailwind" : null,
    battleState.speStage !== 0
      ? `${battleState.speStage > 0 ? "+" : ""}${battleState.speStage} stage`
      : null,
    battleState.status === "Paralyzed" ? "Paralyzed" : null,
  ].filter((source): source is string => !!source);
  const effectiveSpe = finalStats ? Math.floor(finalStats.spe * totalSpeedMultiplier) : 0;
  // Display-only rounding — a -4 stage's exact multiplier is a repeating
  // decimal (1/3 = 0.3333...), which reads as noise in the UI; the actual
  // Speed math above still uses the full-precision totalSpeedMultiplier.
  const roundedSpeedMultiplier = Math.round(totalSpeedMultiplier * 100) / 100;

  const maxHp = finalStats?.hp ?? 0;
  const currentHp = Math.max(1, Math.round((battleState.currentHpPercent / 100) * maxHp));

  function updateBattleState(patch: Partial<PokemonBattleState>) {
    onBattleStateChange({ ...battleState, ...patch });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-mauve-200 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
        {title}
      </h3>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-mauve-500">
            Regulation: {REGULATIONS[0].label}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            {loadableOpponents && (
              <button
                type="button"
                onClick={() => setIsLoadOpponentOpen(true)}
                aria-label={`Load a saved opponent's team onto ${title}`}
                title="Load a saved opponent's team"
                className="flex items-center gap-1 text-xs font-medium text-mauve-500 hover:text-mauve-700"
              >
                <Icon name={IconName.Download} size={14} />
                Load Team
              </button>
            )}
            {sidebar.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExportTeamOpen(true)}
                aria-label={`Export the whole ${title} team as Showdown export text`}
                title="Export team as Showdown export text"
                className="flex items-center gap-1 text-xs font-medium text-mauve-500 hover:text-mauve-700"
              >
                <Icon name={IconName.ContentCopy} size={14} />
                Export Team
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsImportOpen(true);
                setImportError(null);
              }}
              aria-label={`Import a ${title} Pokémon from Showdown export text`}
              title="Import from Showdown export text"
              className="flex items-center gap-1 text-xs font-medium text-mauve-500 hover:text-mauve-700"
            >
              <Icon name={IconName.ContentPaste} size={14} />
              Import
            </button>
          </div>
        </div>
        <SearchableSelect
          options={SPECIES_OPTIONS}
          placeholder="Search for a Pokémon…"
          ariaLabel={`${title} Pokémon`}
          onSelect={(option) => onAddPokemon(buildCustomPokemon(option.id))}
        />
      </div>

      {isImportOpen && (
        <Modal onClose={closeImport} labelledBy={importModalTitleId}>
          <h2 id={importModalTitleId} className="mb-1 text-lg font-semibold text-mauve-900">
            Import {title}
          </h2>
          <p className="mb-4 text-sm text-mauve-600">
            Paste one Pokémon, or a full team (blank line between each) to replace this side&apos;s
            whole roster.
          </p>
          <textarea
            value={importText}
            onChange={(event) => {
              setImportText(event.target.value);
              setImportError(null);
            }}
            placeholder={
              "Charizard @ Charizardite Y\nAbility: Blaze\nEVs: 17 HP / 25 Def / 11 SpA / 13 Spe\nModest Nature\n- Heat Wave\n- Weather Ball\n- Solar Beam\n- Protect"
            }
            rows={12}
            autoFocus
            aria-label={`${title} Showdown export text to import`}
            className="w-full resize-y rounded-lg border border-mauve-300 bg-white p-3 font-mono text-sm text-mauve-900 focus:outline-none focus:ring-2 focus:ring-mauve-400"
          />
          {importError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {importError}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={submitImport}
              className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
            >
              Import
            </button>
            <button
              type="button"
              onClick={closeImport}
              className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {isLoadOpponentOpen && loadableOpponents && (
        <Modal onClose={() => setIsLoadOpponentOpen(false)} labelledBy={loadOpponentModalTitleId}>
          <h2 id={loadOpponentModalTitleId} className="mb-1 text-lg font-semibold text-mauve-900">
            Load {title} Team
          </h2>
          <p className="mb-4 text-sm text-mauve-600">
            Pick a saved opponent from the Matchup Planner to replace this side&apos;s whole roster.
          </p>
          {loadableOpponents.length === 0 ? (
            <p className="text-sm text-mauve-600">
              No opponents saved yet — add one in the Matchup Planner first.
            </p>
          ) : (
            <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
              {loadableOpponents.map((opponent) => (
                <button
                  key={opponent.id}
                  type="button"
                  onClick={() => loadOpponentTeam(opponent)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-mauve-200 px-3 py-2 text-left hover:bg-mauve-100"
                >
                  <span className="truncate text-sm font-medium text-mauve-900">{opponent.label}</span>
                  <span className="shrink-0 text-xs text-mauve-500">
                    {opponent.team.pokemon.length} Pokémon
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setIsLoadOpponentOpen(false)}
              className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {isExportTeamOpen && (
        <Modal onClose={() => setIsExportTeamOpen(false)} labelledBy={exportTeamModalTitleId}>
          <h2 id={exportTeamModalTitleId} className="mb-1 text-lg font-semibold text-mauve-900">
            Export {title} Team
          </h2>
          <p className="mb-4 text-sm text-mauve-600">
            The whole {title.toLowerCase()} roster ({sidebar.length} Pokémon) as Showdown export text.
          </p>
          <textarea
            readOnly
            value={teamExportText}
            rows={12}
            onFocus={(event) => event.target.select()}
            aria-label={`${title} team Showdown export text`}
            className="w-full resize-y rounded-lg border border-mauve-300 bg-white p-3 font-mono text-sm text-mauve-900 focus:outline-none focus:ring-2 focus:ring-mauve-400"
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={copyTeamExportText}
              className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
            >
              Copy to clipboard
            </button>
            <button
              type="button"
              onClick={() => setIsExportTeamOpen(false)}
              className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      <div className="flex gap-3">
        {pokemon && (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-mauve-100">
              <PokemonSprite
                species={pokemon.species}
                item={mega ? pokemon.item : undefined}
                fill
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-mauve-900">
                  {pokemon.species}
                </span>
                {hasMegaForm && (
                  <button
                    type="button"
                    onClick={() => onMegaChange(!mega)}
                    aria-pressed={mega}
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors ${
                      mega
                        ? "border-mauve-600 bg-mauve-600 text-white"
                        : "border-mauve-300 text-mauve-500 hover:bg-mauve-100"
                    }`}
                  >
                    Mega
                  </button>
                )}
                <button
                  type="button"
                  onClick={copyExportText}
                  aria-label={`Copy ${title} as Showdown export text`}
                  title="Copy as Showdown export text"
                  className="ml-auto flex shrink-0 h-6 w-6 items-center justify-center rounded-full text-mauve-400 transition-colors hover:bg-mauve-100 hover:text-mauve-700"
                >
                  <Icon name={IconName.ContentCopy} size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-mauve-500">
                {onAbilityChange ? (
                  <div className="min-w-0 flex-1">
                    <SearchableSelect
                      options={abilitySelectOptions}
                      placeholder="Select ability…"
                      ariaLabel={`${title} ability`}
                      // Shows the CURRENTLY ACTIVE ability (mega-aware —
                      // Mega Blastoise displays "Mega Launcher", not the
                      // pasted base form's "Torrent") even though picking a
                      // new option still writes to the base pokemon.ability
                      // field, same as before — a Mega form only ever has
                      // one ability anyway, so this only changes what's
                      // shown while mega is toggled on, not what gets saved.
                      value={effectiveAbility}
                      onSelect={(option) => onAbilityChange(option.id)}
                      compact
                    />
                  </div>
                ) : (
                  effectiveAbility && <span className="truncate">{effectiveAbility}</span>
                )}
                <div className="min-w-0 flex-1">
                  <SearchableSelect
                    options={NATURE_OPTIONS}
                    placeholder="Select nature…"
                    ariaLabel={`${title} nature`}
                    value={natureLabel(currentNature.toLowerCase())}
                    onSelect={(option) =>
                      onStatOverridesChange({ ...statOverrides, nature: option.id })
                    }
                    compact
                  />
                </div>
              </div>
              {onItemChange && (
                <SearchableSelect
                  options={itemOptions}
                  placeholder="Add a held item…"
                  ariaLabel={`${title} held item`}
                  value={pokemon.item}
                  onSelect={(option) => onItemChange(option.id)}
                  onClear={() => onItemChange(undefined)}
                  compact
                />
              )}
            </div>
          </div>

          {breakdown ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-xs text-mauve-700">
                <thead>
                  <tr className="text-mauve-500">
                    <th className="py-0.5 text-left font-normal">Stat</th>
                    <th className="text-right font-normal">Base</th>
                    <th className="text-right font-normal">SP</th>
                    <th className="text-right font-normal">Final</th>
                    <th className="pl-2 text-right font-normal">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {STAT_ORDER.map((stat) => {
                    const stageKey = STAGE_KEY_BY_STAT[stat];
                    const isIncreased = breakdown.final.increasedStat === stat;
                    const isDecreased = breakdown.final.decreasedStat === stat;
                    return (
                      <tr key={stat}>
                        <td className="py-0.5">
                          {STAT_LABELS[stat]}
                          {isIncreased && (
                            <span className="text-mauve-900" title="Boosted by nature">
                              {" "}
                              ↑
                            </span>
                          )}
                          {isDecreased && (
                            <span className="text-mauve-400" title="Lowered by nature">
                              {" "}
                              ↓
                            </span>
                          )}
                        </td>
                        <td className="text-right">{breakdown.base[stat]}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            max={32}
                            value={breakdown.statPoints[stat]}
                            onChange={(event) => updateSp(stat, Number(event.target.value))}
                            aria-label={`${title} ${STAT_LABELS[stat]} Stat Points`}
                            className="w-12 rounded border border-mauve-300 bg-white px-1 py-0.5 text-right text-xs text-mauve-900"
                          />
                        </td>
                        <td className="text-right font-medium">
                          {stat === "spe" && totalSpeedMultiplier !== 1 ? (
                            <span
                              title={`${speedLabelParts.join(", ")} multiplies Speed by ×${roundedSpeedMultiplier}`}
                            >
                              {effectiveSpe}{" "}
                              <span className="text-mauve-500">
                                (×{roundedSpeedMultiplier} {speedLabelParts.join(", ")})
                              </span>
                            </span>
                          ) : (
                            breakdown.final[stat]
                          )}
                        </td>
                        <td className="pl-2 text-right">
                          {stageKey ? (
                            <select
                              value={battleState[stageKey]}
                              onChange={(event) =>
                                updateBattleState({ [stageKey]: Number(event.target.value) })
                              }
                              aria-label={`${title} ${STAT_LABELS[stat]} stage`}
                              className="rounded border border-mauve-300 bg-white px-1 py-0.5 text-xs text-mauve-900"
                            >
                              {STAGE_OPTIONS.map((stage) => (
                                <option key={stage} value={stage}>
                                  {stage > 0 ? `+${stage}` : stage === 0 ? "--" : stage}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-amber-600">
              No base stats found for this species/form.
            </p>
          )}

          {breakdown && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-medium text-mauve-600">
                  Status
                  <select
                    value={battleState.status}
                    onChange={(event) =>
                      updateBattleState({ status: event.target.value as PokemonStatus })
                    }
                    className="rounded border border-mauve-300 bg-white px-1 py-0.5 text-xs text-mauve-900"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-mauve-600">
                  Current HP: {currentHp}/{maxHp} ({battleState.currentHpPercent}%)
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={battleState.currentHpPercent}
                  onChange={(event) =>
                    updateBattleState({ currentHpPercent: Number(event.target.value) })
                  }
                  aria-label={`${title} current HP percent`}
                  className="w-full accent-mauve-600"
                />
              </div>
            </div>
          )}

          {onMovesChange && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-mauve-600">Moves</span>
              <div className="flex flex-col gap-1.5">
                {[0, 1, 2, 3].map((slot) => {
                  const moves = pokemon.moves ?? [];
                  const move = moves[slot];
                  // A Pokémon can't know the same move twice — excluding
                  // whatever's already picked in the OTHER slots (not this
                  // one, so re-opening a slot still shows its own current
                  // move) also sidesteps the duplicate-value React key
                  // collision that caused stale/overlapping rows above.
                  const usedElsewhere = moves.filter((_, i) => i !== slot);
                  const availableOptions = MOVE_OPTIONS.filter(
                    (option) => !usedElsewhere.includes(option.label),
                  );
                  const moveInfo = move ? MOVES[normalizeSpeciesKey(move)] : undefined;
                  return (
                    <div key={slot} className="flex items-center gap-2">
                      <div className="w-56 shrink-0">
                        <SearchableSelect
                          options={availableOptions}
                          placeholder="Add a move…"
                          ariaLabel={`${title} move ${slot + 1}`}
                          value={move}
                          onSelect={(option) => {
                            if (slot < moves.length) {
                              const next = [...moves];
                              next[slot] = option.label;
                              onMovesChange(next);
                            } else {
                              onMovesChange([...moves, option.label]);
                            }
                          }}
                          onClear={() => {
                            const next = [...moves];
                            next.splice(slot, 1);
                            onMovesChange(next);
                          }}
                        />
                      </div>
                      {moveInfo && (
                        <span className="flex flex-1 items-center gap-1 text-xs text-mauve-500">
                          {/* 38px matches the compact SearchableSelect input's own rendered height, so the icon lines up edge-to-edge with the move field beside it. */}
                          <TypeIcon type={moveInfo.type} size={38} />
                          {moveInfo.power !== null && moveInfo.power}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        )}

        <div
          className="flex shrink-0 flex-col gap-1.5"
          role="listbox"
          aria-label={`${title} sidebar`}
        >
          {sidebar.map((entry, index) => {
            const isSelected = selectedIndex === index;
            return (
              <div key={index} className="relative">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  title={
                    entry.pokemon.item
                      ? `${entry.pokemon.species} @ ${entry.pokemon.item}`
                      : entry.pokemon.species
                  }
                  onClick={() => onSelectIndex(index)}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 bg-mauve-50 transition-colors ${
                    isSelected
                      ? "border-mauve-600"
                      : "border-transparent hover:border-mauve-300"
                  }`}
                >
                  <PokemonSprite species={entry.pokemon.species} fill />
                  {entry.pokemon.item && (
                    <span className="absolute -bottom-1 -right-1">
                      <ItemIcon item={entry.pokemon.item} size={16} />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onRemovePokemon(index)}
                  aria-label={`Remove ${entry.pokemon.species}`}
                  title={`Remove ${entry.pokemon.species}`}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-mauve-400 text-mauve-700 hover:bg-mauve-500 hover:text-mauve-200"
                >
                  <Icon name={IconName.Close} size={12} />
                </button>
              </div>
            );
          })}
          {sidebar.length < MAX_SIDEBAR_POKEMON && (
            <button
              type="button"
              onClick={() => setIsAddingToSidebar((open) => !open)}
              aria-pressed={isAddingToSidebar}
              aria-label="Add a Pokémon"
              title="Add a Pokémon"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-mauve-500 transition-colors hover:border-mauve-600 hover:bg-mauve-300/50"
            >
              <Icon className="text-mauve-500" name={IconName.Add} size={18} />
            </button>
          )}
        </div>
      </div>

      {isAddingToSidebar && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-mauve-200 bg-mauve-50 p-3">
          <span className="text-xs font-medium text-mauve-600">
            Regulation: {REGULATIONS[0].label}
          </span>
          <SearchableSelect
            options={SPECIES_OPTIONS}
            placeholder="Search for a Pokémon…"
            ariaLabel={`${title} add Pokémon to sidebar`}
            autoFocus
            onSelect={(option) => {
              onAddPokemon(buildCustomPokemon(option.id));
              setIsAddingToSidebar(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
