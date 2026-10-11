"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { NATURE_MODIFIERS } from "@/constants";
import { REGULATIONS } from "@/data/regulations";
import abilitiesData from "@/data/abilities.json";
import movesData from "@/data/moves.json";
import speciesTypesData from "@/data/speciesTypes.json";
import baseStatsData from "@/data/baseStats.json";
import type { StatOverrides } from "@/lib/stats/applyStatOverrides";
import type { BaseStats, MoveData, ParsedPokemon, SpeciesAbility, StatKey } from "@/types";
import { SearchableSelect, type SearchableSelectOption } from "../SearchableSelect";
import { PokemonSprite } from "../PokemonSprite";
import { TypeIcon } from "../TypeIcon";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { computePokemonBuild } from "./computePokemonBuild";

const ABILITIES = abilitiesData as unknown as Record<string, SpeciesAbility[]>;
const MOVES = movesData as unknown as Record<string, MoveData>;
const SPECIES_TYPES = speciesTypesData as unknown as Record<string, string[]>;
const BASE_STATS = baseStatsData as unknown as Record<string, BaseStats>;
const NATURE_NAMES = Object.keys(NATURE_MODIFIERS);

/** A Showdown-style sprite/name/types row on top, abilities/stat-line below — the species search's shared-panel row (see moveOptionContent for the move-picker equivalent). */
function speciesOptionContent(key: string, label: string): ReactNode {
  const types = SPECIES_TYPES[key] ?? [];
  const abilities = ABILITIES[key] ?? [];
  const stats = BASE_STATS[key];
  const bst = stats ? stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe : undefined;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-zinc-100">
        <PokemonSprite species={label} fill />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{label}</span>
          {types.map((type) => (
            <TypeIcon key={type} type={type} size={14} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
          <span className="truncate">
            {abilities.map((a) => (a.isHidden ? `${a.name} (H)` : a.name)).join(" / ")}
          </span>
          {stats && (
            <span className="shrink-0">
              {stats.hp}/{stats.atk}/{stats.def}/{stats.spa}/{stats.spd}/{stats.spe} BST {bst}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Every legal Regulation M-B species — only one regulation exists today, see src/data/regulations/index.ts. This is the *only* way to pick a Pokémon's identity (team/opponent selection is a separate, caller-provided affordance — see RosterPokemonPicker's "Load Team"). */
export const SPECIES_OPTIONS: SearchableSelectOption[] = REGULATIONS[0].speciesKeys.map((key) => {
  const label = formatSpeciesDisplayName(key);
  return { id: key, label, sprite: label, content: speciesOptionContent(key, label) };
});

/** A Showdown-style Name/Type/Category/Pow/Acc/PP row with the effect text underneath — the move search's shared-panel row. */
function moveOptionContent(move: MoveData, fallbackName: string): ReactNode {
  const name = move.name ?? fallbackName;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="truncate font-medium">{name}</span>
        <TypeIcon type={move.type} size={14} />
        <span className="shrink-0 text-[10px] uppercase text-zinc-500">{move.category}</span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] text-zinc-500">
          {move.power ? `${move.power} Pow` : "— Pow"} · {move.accuracy ? `${move.accuracy}% Acc` : "— Acc"} ·{" "}
          {move.pp ?? "—"} PP
        </span>
      </div>
      {move.shortDesc && <span className="truncate text-[11px] text-zinc-500">{move.shortDesc}</span>}
    </div>
  );
}

/** Every move in the data set, for the move-search combobox — moves aren't Regulation-gated (this app doesn't enforce per-species learnsets, see PLANNING.md). */
export const MOVE_OPTIONS: SearchableSelectOption[] = Object.entries(MOVES).map(([key, move]) => ({
  id: key,
  label: move.name ?? key,
  content: moveOptionContent(move, key),
}));

/** Builds a fresh from-scratch Pokémon for a given species.json key — defaults to its first (non-hidden) ability, no item, Hardy nature, no moves. */
export function buildCustomPokemon(speciesKey: string): ParsedPokemon {
  return {
    species: formatSpeciesDisplayName(speciesKey),
    ability: ABILITIES[speciesKey]?.[0]?.name,
    nature: "Hardy",
    moves: [],
  };
}

/** The very first Regulation M-B species (used as the ultimate fallback default when no team is active). */
export const DEFAULT_SPECIES_KEY = REGULATIONS[0].speciesKeys[0];

export const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};
export const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];

export function natureLabel(name: string): string {
  const modifier = NATURE_MODIFIERS[name];
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  if (!modifier?.increased || !modifier.decreased) return capitalized;
  return `${capitalized} (+${STAT_LABELS[modifier.increased]}, -${STAT_LABELS[modifier.decreased]})`;
}

/** All 25 natures, for the nature dropdown — id is the lowercase key `applyStatOverrides` expects, label is the human-readable "+/-" form `natureLabel` already produces. */
const NATURE_OPTIONS: SearchableSelectOption[] = NATURE_NAMES.map((name) => ({
  id: name,
  label: natureLabel(name),
}));

/**
 * Which field the shared results panel below is currently sourced from — at
 * most one at a time, same as Showdown's teambuilder (click Item while
 * browsing Moves and the panel just swaps to items). `"stats"` is the odd
 * one out — it has no option list, it swaps the panel to the full
 * Base/SP-slider/Final editor instead (`"columns"` layout only; `"stacked"`
 * keeps that table always visible and never sets this).
 */
type ActiveField =
  | { kind: "species" }
  | { kind: "ability" }
  | { kind: "item" }
  | { kind: "move"; slot: number }
  | { kind: "stats" }
  | null;

const MAX_VISIBLE_RESULTS = 40;

function filterOptions(options: SearchableSelectOption[], query: string): SearchableSelectOption[] {
  const trimmed = query.trim().toLowerCase();
  return (trimmed ? options.filter((o) => o.label.toLowerCase().includes(trimmed)) : options).slice(
    0,
    MAX_VISIBLE_RESULTS,
  );
}

const fieldInputClassName =
  "w-full rounded-lg border border-zinc-300 bg-zinc-50 py-1.5 pl-2 pr-7 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-medium text-zinc-500">{children}</span>;
}

export interface PokemonEditorProps {
  /** Used in aria-labels for every field (e.g. "Attacker ability", "Slot 1 nature"). */
  title: string;
  /** The Pokémon being edited, or null when nothing's picked yet — renders just the species search in that case. */
  pokemon: ParsedPokemon | null;
  /** Only meaningful when provided — a read-only Pokémon (e.g. a pasted team a caller doesn't want re-identified here) can omit this and the species search won't appear editable-looking in a way that implies it does anything; omit entirely to hide the species search altogether. */
  onSpeciesChange?: (pokemon: ParsedPokemon) => void;
  /** Whether to show/apply the currently-held Mega Stone's effect on stats/ability — item stays applied when omitted (or `onMegaChange` is omitted), which is the natural default for a real roster entry (no reason to ever preview "as if it weren't holding its Mega Stone"). Pass both to add an on/off toggle for theorycrafting (see RosterPokemonPicker). */
  mega?: boolean;
  onMegaChange?: (mega: boolean) => void;
  statOverrides: StatOverrides;
  onStatOverridesChange: (overrides: StatOverrides) => void;
  /** Ability/item/moves are only editable when their change handler is provided — omit any of the three to render that field read-only (ability) or hide it entirely (item/moves). */
  onAbilityChange?: (ability: string) => void;
  onItemChange?: (item: string | undefined) => void;
  onMovesChange?: (moves: string[]) => void;
  /** Caps the combined Stat Points across all six stats — a real team (Pokémon Champions' 66-point budget) should set this to 66; omit it to allow exploring past what a legal team could have (the Damage Calculator's theorycrafting use, see applyStatOverrides.ts). Always enforced alongside the per-stat 0-32 range regardless of this prop. */
  maxTotalStatPoints?: number;
  /** Extra header cell + per-row cell appended to the stat table (e.g. RosterPokemonPicker's battle Stat Stage dropdown) — omit for a plain Base/SP/Final table. */
  renderStatRowExtra?: (stat: StatKey) => ReactNode;
  /** Overrides how a stat's Final-column value is displayed (e.g. RosterPokemonPicker's Speed row, which layers a weather/Tailwind/status multiplier on top) — defaults to just the plain number. */
  renderFinalCell?: (stat: StatKey, value: number) => ReactNode;
  /** Rendered directly below the stat table, above Moves (e.g. RosterPokemonPicker's Status/current-HP controls) — a battle-state concern this editor itself knows nothing about. */
  children?: ReactNode;
  /**
   * `"stacked"` (default) is RosterPokemonPicker's narrow-column layout —
   * everything in one vertical flow. `"columns"` is a wide, Showdown-style
   * horizontal layout (Pokémon | Types+Item+Ability | 4 Moves | Stats as
   * four side-by-side columns, collapsing to stacked below the `md`
   * breakpoint) — use it only where the container is actually wide enough
   * (the Team Builder's card), since it doesn't fit the Damage Calculator's
   * narrow per-side columns.
   */
  layout?: "stacked" | "columns";
}

/**
 * The species/item/ability/nature/moves/Stat Points editor for a single
 * Pokémon, with a live Base/SP/Final stat table — the shared core behind
 * both the Damage Calculator's RosterPokemonPicker and the Team Builder.
 * Deliberately has no opinion on layout beyond its own internal rows (no
 * card border/title), and no concept of a roster/sidebar — a caller that
 * wants "add vs. replace" semantics (RosterPokemonPicker) or a fixed set of
 * slots (Team Builder) implements that around this component via
 * `onSpeciesChange`, not inside it.
 *
 * Species/ability/item/move search all share ONE results panel at the
 * bottom of the editor (see `activeField`), matching Showdown's teambuilder
 * — whichever field you're focused in, results always render in that same
 * spot, rather than each field popping its own floating dropdown open in a
 * different place depending on where it happens to sit in the layout.
 */
export function PokemonEditor({
  title,
  pokemon,
  onSpeciesChange,
  mega = true,
  onMegaChange,
  statOverrides,
  onStatOverridesChange,
  onAbilityChange,
  onItemChange,
  onMovesChange,
  maxTotalStatPoints,
  renderStatRowExtra,
  renderFinalCell,
  children,
  layout = "stacked",
}: PokemonEditorProps) {
  const {
    hasMegaForm,
    types,
    breakdown,
    currentNature,
    effectiveAbility,
    abilitySelectOptions,
    itemOptions,
  } = computePokemonBuild(pokemon, mega, statOverrides);

  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeField) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveField(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveField(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeField]);

  function activateField(field: NonNullable<ActiveField>, currentValue: string) {
    setActiveField(field);
    setQuery(currentValue);
  }

  function selectOption(option: SearchableSelectOption) {
    if (!activeField) return;
    if (activeField.kind === "species") {
      onSpeciesChange?.(buildCustomPokemon(option.id));
    } else if (activeField.kind === "ability") {
      onAbilityChange?.(option.id);
    } else if (activeField.kind === "item") {
      onItemChange?.(option.id);
    } else if (activeField.kind === "move") {
      const moves = pokemon?.moves ?? [];
      const next = [...moves];
      if (activeField.slot < moves.length) {
        next[activeField.slot] = option.label;
      } else {
        next.push(option.label);
      }
      onMovesChange?.(next);
    }
    setActiveField(null);
    setQuery("");
  }

  function updateSp(stat: StatKey, rawValue: number) {
    if (!breakdown) return;
    let maxAllowed = 32;
    if (maxTotalStatPoints !== undefined) {
      const otherTotal = STAT_ORDER.reduce(
        (sum, s) => sum + (s === stat ? 0 : breakdown.statPoints[s]),
        0,
      );
      maxAllowed = Math.max(0, Math.min(32, maxTotalStatPoints - otherTotal));
    }
    const clamped = Number.isNaN(rawValue) ? 0 : Math.max(0, Math.min(maxAllowed, Math.round(rawValue)));
    onStatOverridesChange({
      ...statOverrides,
      sp: { ...statOverrides.sp, [stat]: clamped },
    });
  }

  function defaultRenderFinalCell(_stat: StatKey, value: number): ReactNode {
    return value;
  }
  const finalCellRenderer = renderFinalCell ?? defaultRenderFinalCell;

  const totalSp = breakdown ? STAT_ORDER.reduce((sum, stat) => sum + breakdown.statPoints[stat], 0) : 0;

  let activeOptions: SearchableSelectOption[] = [];
  let activeAriaLabel = "";
  if (activeField?.kind === "species") {
    activeOptions = SPECIES_OPTIONS;
    activeAriaLabel = `${title} Pokémon`;
  } else if (activeField?.kind === "ability") {
    activeOptions = abilitySelectOptions;
    activeAriaLabel = `${title} ability`;
  } else if (activeField?.kind === "item") {
    activeOptions = itemOptions;
    activeAriaLabel = `${title} held item`;
  } else if (activeField?.kind === "move") {
    const moves = pokemon?.moves ?? [];
    // A Pokémon can't know the same move twice — excluding whatever's
    // already picked in the OTHER slots (not this one, so re-opening a slot
    // still shows its own current move as a valid option).
    const usedElsewhere = moves.filter((_, i) => i !== activeField.slot);
    activeOptions = MOVE_OPTIONS.filter((option) => !usedElsewhere.includes(option.label));
    activeAriaLabel = `${title} move ${activeField.slot + 1}`;
  }
  const filteredOptions = activeField ? filterOptions(activeOptions, query) : [];

  const speciesField = onSpeciesChange && (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>Pokémon</FieldLabel>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={activeField?.kind === "species" ? query : (pokemon?.species ?? "")}
            onFocus={(event) => {
              activateField({ kind: "species" }, pokemon?.species ?? "");
              event.target.select();
            }}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for a Pokémon…"
            aria-label={`${title} Pokémon`}
            className={fieldInputClassName}
          />
        </div>
        {hasMegaForm && onMegaChange && (
          <button
            type="button"
            onClick={() => onMegaChange(!mega)}
            aria-pressed={mega}
            className={`shrink-0 rounded-full border px-2 py-2 text-xs font-semibold transition-colors ${
              mega
                ? "border-zinc-600 bg-zinc-600 dark:bg-zinc-400 text-white"
                : "border-zinc-300 text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            Mega
          </button>
        )}
      </div>
    </div>
  );

  const typesRow = pokemon && types.length > 0 && (
    <div className="flex items-center gap-1.5">
      {types.map((type) => (
        <TypeIcon key={type} type={type} size={18} />
      ))}
    </div>
  );

  const itemField = onItemChange ? (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>Item</FieldLabel>
      <div className="relative">
        <input
          type="text"
          value={activeField?.kind === "item" ? query : (pokemon?.item ?? "")}
          onFocus={(event) => {
            activateField({ kind: "item" }, pokemon?.item ?? "");
            event.target.select();
          }}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Add a held item…"
          aria-label={`${title} held item`}
          className={fieldInputClassName}
        />
        {pokemon?.item && (
          <button
            type="button"
            onClick={() => {
              onItemChange(undefined);
              setActiveField(null);
            }}
            aria-label={`Clear ${title} held item`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <Icon name={IconName.Close} size={12} />
          </button>
        )}
      </div>
    </div>
  ) : null;

  const abilityField = onAbilityChange ? (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>Ability</FieldLabel>
      <input
        type="text"
        // Shows the CURRENTLY ACTIVE ability (mega-aware — Mega Blastoise
        // displays "Mega Launcher", not the pasted base form's "Torrent")
        // even though picking a new option still writes to the base
        // pokemon.ability field, same as before — a Mega form only ever
        // has one ability anyway, so this only changes what's shown while
        // mega is toggled on, not what gets saved.
        value={activeField?.kind === "ability" ? query : (effectiveAbility ?? "")}
        onFocus={(event) => {
          activateField({ kind: "ability" }, effectiveAbility ?? "");
          event.target.select();
        }}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Select ability…"
        aria-label={`${title} ability`}
        className={fieldInputClassName}
      />
    </div>
  ) : (
    effectiveAbility && (
      <div className="flex flex-col gap-0.5">
        <FieldLabel>Ability</FieldLabel>
        <span className="truncate text-sm text-zinc-700">{effectiveAbility}</span>
      </div>
    )
  );

  const statSection = breakdown ? (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[220px] text-xs text-zinc-700">
        <thead>
          <tr className="text-zinc-500">
            <th className="py-0.5 text-left font-normal">Stat</th>
            <th className="text-right font-normal">Base</th>
            <th className="text-right font-normal">SP</th>
            <th className="text-right font-normal">Final</th>
            {renderStatRowExtra && <th className="pl-2 text-right font-normal">Stage</th>}
          </tr>
        </thead>
        <tbody>
          {STAT_ORDER.map((stat) => {
            const isIncreased = breakdown.final.increasedStat === stat;
            const isDecreased = breakdown.final.decreasedStat === stat;
            return (
              <tr key={stat}>
                <td className="py-1">
                  {STAT_LABELS[stat]}
                  {isIncreased && (
                    <span className="text-emerald-600" title="Boosted by nature">
                      {" "}
                      ↑
                    </span>
                  )}
                  {isDecreased && (
                    <span className="text-red-500" title="Lowered by nature">
                      {" "}
                      ↓
                    </span>
                  )}
                </td>
                <td className="text-right">{breakdown.base[stat]}</td>
                <td className="py-1">
                  <div className="flex flex-col items-end gap-0.5">
                    <input
                      type="number"
                      min={0}
                      max={32}
                      value={breakdown.statPoints[stat]}
                      onChange={(event) => updateSp(stat, Number(event.target.value))}
                      aria-label={`${title} ${STAT_LABELS[stat]} Stat Points`}
                      className="w-12 rounded border border-zinc-300 bg-zinc-50 px-1 py-0.5 text-right text-xs text-zinc-900"
                    />
                    <input
                      type="range"
                      min={0}
                      max={32}
                      value={breakdown.statPoints[stat]}
                      onChange={(event) => updateSp(stat, Number(event.target.value))}
                      aria-label={`${title} ${STAT_LABELS[stat]} Stat Points slider`}
                      className="w-20 accent-zinc-600"
                    />
                  </div>
                </td>
                <td className="text-right font-medium">
                  {finalCellRenderer(stat, breakdown.final[stat])}
                </td>
                {renderStatRowExtra && <td className="pl-2 text-right">{renderStatRowExtra(stat)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p
        className={`mt-1 text-xs ${totalSp > (maxTotalStatPoints ?? Infinity) ? "text-red-600" : "text-zinc-500"}`}
      >
        {maxTotalStatPoints !== undefined
          ? `${totalSp}/${maxTotalStatPoints} Stat Points used`
          : `${totalSp} Stat Points used`}
      </p>
    </div>
  ) : (
    <p className="text-xs text-amber-600">No base stats found for this species/form.</p>
  );

  // The "columns" layout's compact stand-in for statSection — just label +
  // Stat Points per row (nature's ↑/↓ carried over from the full table, "–"
  // for an unspent stat), clickable to swap the shared results panel over to
  // the full slider editor instead of keeping it permanently inline (there's
  // no room for a 4-column Base/SP/Final table in a quarter-width column,
  // and Showdown's own teambuilder only shows the full EV editor once you've
  // actually clicked in to edit it).
  const statsSummary = breakdown && (
    <button
      type="button"
      onClick={() => setActiveField({ kind: "stats" })}
      className={`flex w-full flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors ${
        activeField?.kind === "stats"
          ? "border-zinc-600 bg-zinc-100"
          : "border-transparent hover:border-zinc-200 hover:bg-zinc-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <FieldLabel>Stats</FieldLabel>
        <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
          <Icon name={IconName.Edit} size={11} />
          Edit
        </span>
      </div>
      {STAT_ORDER.map((stat) => {
        const isIncreased = breakdown.final.increasedStat === stat;
        const isDecreased = breakdown.final.decreasedStat === stat;
        const sp = breakdown.statPoints[stat];
        return (
          <div key={stat} className="flex items-center justify-between text-xs text-zinc-700">
            <span>
              {STAT_LABELS[stat]}
              {isIncreased && <span className="text-emerald-600"> ↑</span>}
              {isDecreased && <span className="text-red-500"> ↓</span>}
            </span>
            <span className="font-medium">{sp > 0 ? sp : "–"}</span>
          </div>
        );
      })}
    </button>
  );

  const natureField = (
    <div className="max-w-[200px]">
      <FieldLabel>Nature</FieldLabel>
      <SearchableSelect
        options={NATURE_OPTIONS}
        placeholder="Select nature…"
        ariaLabel={`${title} nature`}
        value={natureLabel(currentNature.toLowerCase())}
        onSelect={(option) => onStatOverridesChange({ ...statOverrides, nature: option.id })}
        compact
      />
    </div>
  );

  const moveFields =
    onMovesChange &&
    [0, 1, 2, 3].map((slot) => {
      const moves = pokemon?.moves ?? [];
      const move = moves[slot];
      const isActive = activeField?.kind === "move" && activeField.slot === slot;
      return (
        <div key={slot} className="relative">
          <input
            type="text"
            value={isActive ? query : (move ?? "")}
            onFocus={(event) => {
              activateField({ kind: "move", slot }, move ?? "");
              event.target.select();
            }}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Add a move…"
            aria-label={`${title} move ${slot + 1}`}
            className={fieldInputClassName}
          />
          {move && (
            <button
              type="button"
              onClick={() => {
                const next = [...moves];
                next.splice(slot, 1);
                onMovesChange(next);
                setActiveField(null);
              }}
              aria-label={`Clear ${title} move ${slot + 1}`}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <Icon name={IconName.Close} size={12} />
            </button>
          )}
        </div>
      );
    });

  const resultsPanel = activeField && (
    <div
      role={activeField.kind === "stats" ? undefined : "listbox"}
      aria-label={activeField.kind === "stats" ? undefined : activeAriaLabel}
      // Deliberately the tallest thing on the page (Showdown's own
      // teambuilder gives the results list most of the screen, not the
      // compact identity/stat fields above it) — a viewport-relative
      // height rather than a fixed one so it still dominates on any window
      // size, not just the one it was tuned against. Also where the full
      // stat editor lives in "columns" layout (see statsSummary) — same
      // spot as every other field's results, just different content.
      className="flex max-h-[65vh] flex-col gap-0.5 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-1 shadow-sm"
    >
      {activeField.kind === "stats" ? (
        <div className="p-2">{statSection}</div>
      ) : filteredOptions.length === 0 ? (
        <p className="p-2 text-xs text-zinc-500">No matches.</p>
      ) : (
        filteredOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => selectOption(option)}
            className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {option.content ?? (
              <>
                {option.sprite && (
                  <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-50">
                    <PokemonSprite species={option.sprite} fill />
                  </span>
                )}
                <span className="truncate">{option.label}</span>
              </>
            )}
          </button>
        ))
      )}
    </div>
  );

  if (layout === "columns") {
    return (
      <div ref={containerRef} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_1fr_1.4fr]">
          <div className="flex flex-col gap-2">{speciesField}</div>
          {pokemon && (
            <>
              <div className="flex flex-col gap-2">
                {typesRow}
                {itemField}
                {abilityField}
              </div>
              {onMovesChange && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Moves</FieldLabel>
                  {moveFields}
                </div>
              )}
              <div className="flex flex-col gap-3">
                {statsSummary}
                {natureField}
              </div>
            </>
          )}
        </div>
        {children}
        {resultsPanel}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      {speciesField}

      {pokemon && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {itemField ?? <div />}
            {abilityField}
          </div>

          {statSection}

          {natureField}

          {children}

          {onMovesChange && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Moves</FieldLabel>
              <div className="grid grid-cols-2 gap-1.5">{moveFields}</div>
            </div>
          )}
        </>
      )}

      {resultsPanel}
    </div>
  );
}
