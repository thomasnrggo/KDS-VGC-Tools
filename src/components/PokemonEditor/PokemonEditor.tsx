"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { FLOW_FIELD, focusNextFlowField } from "@/lib/fieldFlow";
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
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { useIsPhone } from "@/hooks/useIsPhone";
import { ENGLISH_POKEMON_TEXT, type PokemonText } from "@/lib/i18n/pokemonNames";
import { MESSAGES, type Messages } from "@/lib/i18n/messages";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/Slider";

const ABILITIES = abilitiesData as unknown as Record<string, SpeciesAbility[]>;
const MOVES = movesData as unknown as Record<string, MoveData>;
const SPECIES_TYPES = speciesTypesData as unknown as Record<string, string[]>;
const BASE_STATS = baseStatsData as unknown as Record<string, BaseStats>;
const NATURE_NAMES = Object.keys(NATURE_MODIFIERS);

/** How option rows are worded: translated game terms plus the app-language labels (Pow/Acc/BST, …). */
interface OptionLabels {
  text: PokemonText;
  t: Messages;
}

const ENGLISH_OPTION_LABELS: OptionLabels = {
  text: ENGLISH_POKEMON_TEXT,
  t: MESSAGES.en,
};

/** A Showdown-style sprite/name/types row on top, abilities/stat-line below — the species search's shared-panel row (see moveOptionContent for the move-picker equivalent). */
function speciesOptionContent(
  key: string,
  englishName: string,
  { text, t }: OptionLabels = ENGLISH_OPTION_LABELS,
): ReactNode {
  const label = text.species(englishName);
  const types = SPECIES_TYPES[key] ?? [];
  const abilities = ABILITIES[key] ?? [];
  const stats = BASE_STATS[key];
  const bst = stats
    ? stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe
    : undefined;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-zinc-100">
        <PokemonSprite species={englishName} fill />
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
            {abilities
              .map((a) =>
                a.isHidden
                  ? `${text.ability(a.name)} (${t.editor.hiddenShort})`
                  : text.ability(a.name),
              )
              .join(" / ")}
          </span>
          {stats && (
            <span className="shrink-0">
              {stats.hp}/{stats.atk}/{stats.def}/{stats.spa}/{stats.spd}/{stats.spe} {t.editor.bst}{" "}
              {bst}
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
  return {
    id: key,
    label,
    sprite: label,
    content: speciesOptionContent(key, label),
  };
});

/** A Showdown-style Name/Type/Category/Pow/Acc/PP row with the effect text underneath — the move search's shared-panel row. */
function moveOptionContent(
  move: MoveData,
  fallbackName: string,
  { text, t }: OptionLabels = ENGLISH_OPTION_LABELS,
): ReactNode {
  const name = text.move(move.name ?? fallbackName);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="truncate font-medium">{name}</span>
        <TypeIcon type={move.type} size={14} />
        <span className="shrink-0 text-[10px] text-zinc-500 uppercase">
          {t.editor.categories[move.category]}
        </span>
        <span className="ml-auto shrink-0 text-[10px] whitespace-nowrap text-zinc-500">
          {move.power ?? "—"} {t.editor.power} · {move.accuracy ? `${move.accuracy}%` : "—"}{" "}
          {t.editor.accuracy} · {move.pp ?? "—"} {t.editor.pp}
        </span>
      </div>
      {move.shortDesc && (
        <span className="truncate text-[11px] text-zinc-500">{move.shortDesc}</span>
      )}
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

export function natureLabel(
  name: string,
  { text, t }: OptionLabels = ENGLISH_OPTION_LABELS,
): string {
  const modifier = NATURE_MODIFIERS[name];
  const capitalized = text.nature(name.charAt(0).toUpperCase() + name.slice(1));
  if (!modifier?.increased || !modifier.decreased) return capitalized;
  return `${capitalized} (+${t.stats.short[modifier.increased]}, -${t.stats.short[modifier.decreased]})`;
}

/**
 * The species, move and nature lists in a given language — ids stay the
 * English names that get saved; the English name is also searchable, so
 * "Swords Dance" still finds "Danza Espada". Built once per language pair.
 */
const localizedOptionsCache = new Map<
  string,
  {
    species: SearchableSelectOption[];
    moves: SearchableSelectOption[];
    natures: SearchableSelectOption[];
  }
>();

function localizedOptions(labels: OptionLabels) {
  const key = `${labels.text.language}|${labels.t === MESSAGES.en ? "en" : "es"}`;
  // While a language's names are still loading, `text` is the English one —
  // its language is "en", so it's cached under the English key, not this one.
  const cachedOptions = localizedOptionsCache.get(key);
  if (cachedOptions) return cachedOptions;
  const built = {
    species: SPECIES_OPTIONS.map((option) => ({
      ...option,
      label: labels.text.species(option.label),
      searchText: option.label,
      content: speciesOptionContent(option.id, option.label, labels),
    })),
    moves: Object.entries(MOVES).map(([moveKey, move]) => ({
      id: moveKey,
      label: labels.text.move(move.name ?? moveKey),
      searchText: move.name ?? moveKey,
      content: moveOptionContent(move, moveKey, labels),
    })),
    natures: NATURE_NAMES.map((name) => ({
      id: name,
      label: natureLabel(name, labels),
      searchText: name,
    })),
  };
  localizedOptionsCache.set(key, built);
  return built;
}

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

/**
 * Puts a move in a given slot (an empty name clears it) without shifting the
 * others: empty slots in between are kept as "" placeholders, trailing ones
 * dropped. Callers that read moves skip the empty ones.
 */
function setMoveSlot(moves: string[], slot: number, move: string): string[] {
  const next = [...moves];
  while (next.length < slot) next.push("");
  next[slot] = move;
  while (next.length > 0 && !next[next.length - 1]) next.pop();
  return next;
}

function filterOptions(options: SearchableSelectOption[], query: string): SearchableSelectOption[] {
  const trimmed = foldForSearch(query.trim());
  return (
    trimmed
      ? options.filter(
          (o) =>
            foldForSearch(o.label).includes(trimmed) ||
            (!!o.searchText && foldForSearch(o.searchText).includes(trimmed)),
        )
      : options
  ).slice(0, MAX_VISIBLE_RESULTS);
}

/** A nature-raised stat in red, a lowered one in blue — the same colors as the Pokémon card. */
function natureColor(isIncreased: boolean, isDecreased: boolean): string {
  return isIncreased
    ? "font-semibold text-red-600"
    : isDecreased
      ? "font-semibold text-blue-600"
      : "";
}

const fieldInputClassName =
  "w-full rounded-lg border border-zinc-300 bg-zinc-50 py-1.5 pl-2 pr-7 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-medium text-zinc-500">{children}</span>;
}

/** A caller-provided column of the stat table: its header and one cell per stat. */
export interface StatColumn {
  id: string;
  /** Omit for a column without a title. */
  header?: string;
  render: (stat: StatKey) => ReactNode;
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
  /** Caps the combined Stat Points across all six stats (MAX_TOTAL_STAT_POINTS, Pokémon Champions' 66) and shows what's remaining — omit it for no cap. Always enforced alongside the per-stat 0-32 range regardless of this prop. */
  maxTotalStatPoints?: number;
  /** Extra columns appended to the stat table after Final (e.g. the calc's Stage select and Battle value) — omit for a plain Base/SP/Final table. */
  extraStatColumns?: StatColumn[];
  /** Overrides how a stat's Final-column value is displayed (e.g. RosterPokemonPicker's Speed row, which layers a weather/Tailwind/status multiplier on top) — defaults to just the plain number. */
  renderFinalCell?: (stat: StatKey, value: number) => ReactNode;
  /** On phones, shown beside the nature with its label on top (the calc's Status) — elsewhere the caller renders it itself. */
  besideNature?: ReactNode;
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
  /**
   * Plain pickers for item and ability — name-only searchable dropdowns —
   * instead of the shared results panel's detailed rows (descriptions),
   * which suit building a team more than a quick calc.
   */
  simpleFields?: boolean;
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
  extraStatColumns = [],
  renderFinalCell,
  besideNature,
  children,
  layout = "stacked",
  simpleFields = false,
}: PokemonEditorProps) {
  const t = useMessages();
  const text = usePokemonText();
  const isPhone = useIsPhone();
  const options = localizedOptions({ text, t });
  const {
    hasMegaForm,
    types,
    breakdown,
    currentNature,
    effectiveAbility,
    abilitySelectOptions,
    itemOptions,
  } = computePokemonBuild(pokemon, mega, statOverrides, {
    text,
    hiddenAbility: t.editor.hiddenAbility,
    megaStone: t.editor.megaStone,
  });

  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  // What the fields show — translated; what they save stays English.
  const speciesDisplay = pokemon ? text.species(pokemon.species) : "";
  const itemDisplay = pokemon?.item ? text.item(pokemon.item) : "";
  const abilityDisplay = effectiveAbility ? text.ability(effectiveAbility) : "";
  const statLabels = t.stats.short;

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
      // Saved by its English name — the label may be translated.
      const moveName = MOVES[option.id]?.name ?? option.searchText ?? option.label;
      if (activeField.slot < moves.length) {
        next[activeField.slot] = moveName;
      } else {
        next.push(moveName);
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
    const clamped = Number.isNaN(rawValue)
      ? 0
      : Math.max(0, Math.min(maxAllowed, Math.round(rawValue)));
    onStatOverridesChange({
      ...statOverrides,
      sp: { ...statOverrides.sp, [stat]: clamped },
    });
  }

  function defaultRenderFinalCell(_stat: StatKey, value: number): ReactNode {
    return value;
  }
  const finalCellRenderer = renderFinalCell ?? defaultRenderFinalCell;

  const totalSp = breakdown
    ? STAT_ORDER.reduce((sum, stat) => sum + breakdown.statPoints[stat], 0)
    : 0;

  let activeOptions: SearchableSelectOption[] = [];
  let activeAriaLabel = "";
  if (activeField?.kind === "species") {
    activeOptions = options.species;
    activeAriaLabel = t.editor.fieldLabel(title, t.editor.pokemon);
  } else if (activeField?.kind === "ability") {
    activeOptions = abilitySelectOptions;
    activeAriaLabel = t.editor.fieldLabel(title, t.editor.ability);
  } else if (activeField?.kind === "item") {
    activeOptions = itemOptions;
    activeAriaLabel = t.editor.fieldLabel(title, t.editor.item);
  } else if (activeField?.kind === "move") {
    const moves = pokemon?.moves ?? [];
    // A Pokémon can't know the same move twice — excluding whatever's
    // already picked in the OTHER slots (not this one, so re-opening a slot
    // still shows its own current move as a valid option).
    const usedElsewhere = moves.filter((_, i) => i !== activeField.slot);
    activeOptions = options.moves.filter(
      (option) => !usedElsewhere.includes(MOVES[option.id]?.name ?? option.id),
    );
    activeAriaLabel = t.editor.moveSlot(title, activeField.slot + 1);
  }
  const filteredOptions = activeField ? filterOptions(activeOptions, query) : [];

  const speciesField = onSpeciesChange && (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>{t.editor.pokemon}</FieldLabel>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={activeField?.kind === "species" ? query : speciesDisplay}
            onFocus={(event) => {
              activateField({ kind: "species" }, speciesDisplay);
              event.target.select();
            }}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.editor.searchPokemon}
            aria-label={t.editor.fieldLabel(title, t.editor.pokemon)}
            className={fieldInputClassName}
          />
        </div>
        {hasMegaForm && onMegaChange && (
          <button
            type="button"
            onClick={() => onMegaChange(!mega)}
            aria-pressed={mega}
            className={cn(
              "shrink-0 rounded-full border px-2 py-2 text-xs font-semibold transition-colors",
              mega
                ? "border-zinc-600 bg-chrome-600 text-white"
                : "border-zinc-300 text-zinc-500 hover:bg-zinc-100",
            )}
          >
            {t.editor.mega}
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

  const simpleItemField = onItemChange ? (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>{t.editor.item}</FieldLabel>
      <SearchableSelect
        options={itemOptions.map((option) => ({
          ...option,
          content: undefined,
        }))}
        value={itemDisplay}
        onSelect={(option) => onItemChange(option.id)}
        onClear={() => onItemChange(undefined)}
        placeholder={t.editor.addItem}
        ariaLabel={t.editor.fieldLabel(title, t.editor.item)}
      />
    </div>
  ) : null;

  // A Mega form has only its own ability; a pasted ability off the list is
  // kept as an option so the select still shows it.
  const simpleAbilityOptions =
    effectiveAbility && !abilitySelectOptions.some((option) => option.id === effectiveAbility)
      ? [{ id: effectiveAbility, label: abilityDisplay }, ...abilitySelectOptions]
      : abilitySelectOptions;
  const simpleAbilityField = onAbilityChange && (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>{t.editor.ability}</FieldLabel>
      <SearchableSelect
        options={simpleAbilityOptions.map((option) => ({
          ...option,
          content: undefined,
        }))}
        value={abilityDisplay}
        onSelect={(option) => onAbilityChange(option.id)}
        placeholder={t.editor.selectAbility}
        ariaLabel={t.editor.fieldLabel(title, t.editor.ability)}
      />
    </div>
  );

  const itemField = simpleFields ? (
    simpleItemField
  ) : onItemChange ? (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>{t.editor.item}</FieldLabel>
      <div className="relative">
        <input
          type="text"
          value={activeField?.kind === "item" ? query : itemDisplay}
          onFocus={(event) => {
            activateField({ kind: "item" }, itemDisplay);
            event.target.select();
          }}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.editor.addItem}
          aria-label={t.editor.fieldLabel(title, t.editor.item)}
          className={fieldInputClassName}
        />
        {pokemon?.item && (
          <button
            type="button"
            onClick={() => {
              onItemChange(undefined);
              setActiveField(null);
            }}
            aria-label={t.editor.clear(t.editor.fieldLabel(title, t.editor.item))}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <Icon name={IconName.Close} size={12} />
          </button>
        )}
      </div>
    </div>
  ) : null;

  const abilityField =
    simpleFields && onAbilityChange ? (
      simpleAbilityField
    ) : onAbilityChange ? (
      <div className="flex flex-col gap-0.5">
        <FieldLabel>{t.editor.ability}</FieldLabel>
        <input
          type="text"
          // Shows the CURRENTLY ACTIVE ability (mega-aware — Mega Blastoise
          // displays "Mega Launcher", not the pasted base form's "Torrent")
          // even though picking a new option still writes to the base
          // pokemon.ability field, same as before — a Mega form only ever
          // has one ability anyway, so this only changes what's shown while
          // mega is toggled on, not what gets saved.
          value={activeField?.kind === "ability" ? query : abilityDisplay}
          onFocus={(event) => {
            activateField({ kind: "ability" }, abilityDisplay);
            event.target.select();
          }}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.editor.selectAbility}
          aria-label={t.editor.fieldLabel(title, t.editor.ability)}
          className={fieldInputClassName}
        />
      </div>
    ) : (
      effectiveAbility && (
        <div className="flex flex-col gap-0.5">
          <FieldLabel>{t.editor.ability}</FieldLabel>
          <span className="truncate text-sm text-zinc-700">{abilityDisplay}</span>
        </div>
      )
    );

  // One line per stat: name, base, SP box, SP slider (takes the spare
  // width), final value, then the caller's extra columns. Phones fold the
  // base under the name, giving that column's width to the slider.
  const statGridStyle = {
    gridTemplateColumns: isPhone
      ? `2.25rem 2.75rem minmax(3rem, 1fr) auto${" auto".repeat(extraStatColumns.length)}`
      : `2.75rem 1.75rem 2.75rem minmax(3rem, 1fr) auto${" auto".repeat(extraStatColumns.length)}`,
  };
  const remainingSp = maxTotalStatPoints !== undefined ? maxTotalStatPoints - totalSp : undefined;
  // The stacked layout (the calc) puts the nature on the stats' footer line;
  // the Team Builder's columns layout keeps it in its own column.
  const natureInFooter = layout === "stacked";
  const natureSelect = (
    <SearchableSelect
      options={options.natures}
      placeholder={t.editor.selectNature}
      ariaLabel={t.editor.fieldLabel(title, t.editor.nature)}
      value={natureLabel(currentNature.toLowerCase(), { text, t })}
      onSelect={(option) => onStatOverridesChange({ ...statOverrides, nature: option.id })}
      compact={!isPhone}
    />
  );
  // Phones: label on top like Item/Ability, sharing the row with besideNature.
  const inlineNatureField = isPhone ? (
    <div className={cn("grid gap-2", besideNature ? "grid-cols-2" : "grid-cols-1")}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <FieldLabel>{t.editor.nature}</FieldLabel>
        {natureSelect}
      </div>
      {besideNature}
    </div>
  ) : (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
      <span className="shrink-0 text-zinc-500">{t.editor.nature}</span>
      <div className="max-w-48 min-w-0 flex-1">{natureSelect}</div>
    </div>
  );
  const statSection = breakdown ? (
    <div className="flex flex-col gap-1">
      <div
        className="grid items-center gap-x-2 gap-y-1 text-xs text-zinc-700"
        style={statGridStyle}
      >
        <span className="text-zinc-500">{t.editor.stat}</span>
        {!isPhone && <span className="text-right text-zinc-500">{t.editor.base}</span>}
        <span className="text-center text-zinc-500">{t.editor.sp}</span>
        <span />
        <span className="text-right text-zinc-500">{t.editor.final}</span>
        {extraStatColumns.map((column) => (
          <span key={column.id} className="text-right text-zinc-500">
            {column.header}
          </span>
        ))}
        {STAT_ORDER.map((stat) => {
          const isIncreased = breakdown.final.increasedStat === stat;
          const isDecreased = breakdown.final.decreasedStat === stat;
          return (
            <Fragment key={stat}>
              {/* Nature-raised stat in red, lowered in blue, like the Pokémon card. */}
              <span
                className={cn(
                  "whitespace-nowrap",
                  natureColor(isIncreased, isDecreased),
                  isPhone && "flex flex-col leading-tight",
                )}
                title={isIncreased ? t.editor.boosted : isDecreased ? t.editor.lowered : undefined}
              >
                {statLabels[stat]}
                {isPhone && (
                  <span
                    className="text-[10px] font-normal text-zinc-400"
                    aria-label={`${t.editor.base} ${breakdown.base[stat]}`}
                  >
                    {breakdown.base[stat]}
                  </span>
                )}
              </span>
              {!isPhone && <span className="text-right">{breakdown.base[stat]}</span>}
              <input
                type="number"
                min={0}
                max={32}
                value={breakdown.statPoints[stat]}
                onChange={(event) => updateSp(stat, Number(event.target.value))}
                {...FLOW_FIELD}
                // Part of the keyboard flow: typing replaces the number, Enter moves on.
                onFocus={(event) => event.target.select()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    focusNextFlowField(event.currentTarget);
                  }
                }}
                aria-label={t.editor.statPointsLabel(title, statLabels[stat])}
                className={cn(
                  "w-full rounded border border-zinc-300 bg-zinc-50 px-1 text-xs text-zinc-900",
                  isPhone ? "py-1 text-center" : "py-0.5 text-right",
                )}
              />
              <Slider
                min={0}
                max={32}
                value={breakdown.statPoints[stat]}
                onChange={(event) => updateSp(stat, Number(event.target.value))}
                aria-label={t.editor.statPointsSlider(title, statLabels[stat])}
                className={cn("min-w-0", isPhone && "h-8")}
              />
              <span className="text-right font-medium tabular-nums">
                {finalCellRenderer(stat, breakdown.final[stat])}
              </span>
              {extraStatColumns.map((column) => (
                <span key={column.id} className="flex justify-end">
                  {column.render(stat)}
                </span>
              ))}
            </Fragment>
          );
        })}
      </div>
      <div
        className={cn(
          "flex gap-3 pt-1 text-xs",
          isPhone ? "flex-col items-stretch" : "items-center",
        )}
      >
        {maxTotalStatPoints !== undefined ? (
          <span
            className="flex shrink-0 items-baseline gap-1.5"
            aria-label={t.editor.remainingLabel(remainingSp ?? 0, maxTotalStatPoints)}
          >
            <span className="text-zinc-500">{t.editor.remaining}</span>
            <span
              className={cn(
                "font-medium tabular-nums",
                (remainingSp ?? 0) < 0
                  ? "text-red-600"
                  : remainingSp === 0
                    ? "text-orange-600"
                    : "text-zinc-900",
              )}
            >
              {remainingSp} / {maxTotalStatPoints}
            </span>
          </span>
        ) : (
          <span className="text-zinc-500">{t.editor.statPointsUsed(totalSp)}</span>
        )}
        {natureInFooter && inlineNatureField}
      </div>
    </div>
  ) : (
    <p className="text-xs text-amber-600">{t.editor.noBaseStats}</p>
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
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors",
        activeField?.kind === "stats"
          ? "border-zinc-600 bg-zinc-100"
          : "border-transparent hover:border-zinc-200 hover:bg-zinc-100",
      )}
    >
      <div className="flex items-center justify-between">
        <FieldLabel>{t.editor.stats}</FieldLabel>
        <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
          <Icon name={IconName.Edit} size={11} />
          {t.editor.edit}
        </span>
      </div>
      {STAT_ORDER.map((stat) => {
        const isIncreased = breakdown.final.increasedStat === stat;
        const isDecreased = breakdown.final.decreasedStat === stat;
        const sp = breakdown.statPoints[stat];
        return (
          <div key={stat} className="flex items-center justify-between text-xs text-zinc-700">
            <span className={natureColor(isIncreased, isDecreased)}>{statLabels[stat]}</span>
            <span className="font-medium">{sp > 0 ? sp : "–"}</span>
          </div>
        );
      })}
    </button>
  );

  const natureField = (
    <div className="max-w-[200px]">
      <FieldLabel>{t.editor.nature}</FieldLabel>
      {natureSelect}
    </div>
  );

  // One full-width row per move — a name-only searchable dropdown — instead
  // of the shared results panel's detailed rows.
  const simpleMoveFields =
    onMovesChange &&
    [0, 1, 2, 3].map((slot) => {
      const moves = pokemon?.moves ?? [];
      const move = moves[slot];
      const usedElsewhere = moves.filter((_, i) => i !== slot);
      return (
        <div key={slot}>
          <SearchableSelect
            options={options.moves
              .filter((option) => !usedElsewhere.includes(MOVES[option.id]?.name ?? option.id))
              .map((option) => ({ ...option, content: undefined }))}
            value={move ? text.move(move) : ""}
            onSelect={(option) => {
              // Saved by its English name — the label may be translated.
              const moveName = MOVES[option.id]?.name ?? option.searchText ?? option.label;
              onMovesChange(setMoveSlot(moves, slot, moveName));
            }}
            // Clearing keeps the other moves in their slots.
            onClear={() => onMovesChange(setMoveSlot(moves, slot, ""))}
            placeholder={t.editor.addMove}
            ariaLabel={t.editor.moveSlot(title, slot + 1)}
            narrow={isPhone}
          />
        </div>
      );
    });

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
            value={isActive ? query : move ? text.move(move) : ""}
            onFocus={(event) => {
              activateField({ kind: "move", slot }, move ? text.move(move) : "");
              event.target.select();
            }}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.editor.addMove}
            aria-label={t.editor.moveSlot(title, slot + 1)}
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
              aria-label={t.editor.clear(t.editor.moveSlot(title, slot + 1))}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
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
        <p className="p-2 text-xs text-zinc-500">{t.editor.noMatches}</p>
      ) : (
        filteredOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => selectOption(option)}
            className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
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
                  <FieldLabel>{t.editor.moves}</FieldLabel>
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

          <div className="border-t border-b border-zinc-200 py-4">
            {statSection}
            {!breakdown && natureField}
          </div>

          {children}

          {onMovesChange && (
            <div className="flex flex-col gap-1.5 border-t border-zinc-200 py-2">
              <FieldLabel>{t.editor.moves}</FieldLabel>
              {simpleFields ? (
                // Phones: a 2×2 grid — picking happens in the full-screen sheet.
                <div className={isPhone ? "grid grid-cols-2 gap-1.5" : "flex flex-col gap-1.5"}>
                  {simpleMoveFields}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">{moveFields}</div>
              )}
            </div>
          )}
        </>
      )}

      {resultsPanel}
    </div>
  );
}
