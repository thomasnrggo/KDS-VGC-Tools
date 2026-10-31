"use client";

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import {
  buildCustomPokemon,
  computePokemonBuild,
  localizedOptions,
  PokemonEditor,
  speciesOptionContent,
  STAT_ORDER,
  type OptionLabels,
} from "../PokemonEditor";
import { PickerSheet, pickerSheetSearchClassName } from "../PickerSheet";
import { PokemonSprite } from "../PokemonSprite";
import type { SearchableSelectOption } from "../SearchableSelect";
import { TypeIcon } from "../TypeIcon";
import { TYPE_COLORS } from "@/constants";
import { TogglePill } from "../Button";
import { IconName } from "@/enums";
import type { Regulation } from "@/data/regulations";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { useIsPhone } from "@/hooks/useIsPhone";
import { FLOW_ROOT } from "@/lib/fieldFlow";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { useLearnableMoves, useLearnsets } from "@/hooks/useLearnableMoves";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { applyStatOverrides, type StatOverrides } from "@/lib/stats/applyStatOverrides";
import { MAX_TOTAL_STAT_POINTS } from "@/lib/stats/calculateFinalStats";
import { cn } from "@/lib/utils";
import { statBarColor, statBarWidth } from "@/lib/stats/statBarColor";
import typeChartData from "@/data/typeChart.json";
import movesData from "@/data/moves.json";
import speciesTypesData from "@/data/speciesTypes.json";
import baseStatsData from "@/data/baseStats.json";
import abilitiesData from "@/data/abilities.json";
import type { BaseStats, MoveData, ParsedPokemon, SpeciesAbility } from "@/types";

/**
 * Edits are saved straight into the Pokémon (unlike the Damage Calculator's
 * overrides, a theorycraft layer kept apart from the team) — so the stat
 * table always gets none, shows the Pokémon's own values, and each change is
 * applied and saved right away.
 */
const NO_STAT_OVERRIDES: StatOverrides = {};

/** Rows listed at once — the move list is long, and typing narrows it. */
const MAX_ROWS = 150;

const TYPES = Object.keys(typeChartData);
const MOVES = movesData as unknown as Record<string, MoveData>;
const SPECIES_TYPES = speciesTypesData as unknown as Record<string, string[]>;
const CATEGORIES = ["Physical", "Special", "Status"] as const;

/**
 * A search filter, like Showdown's: typing a type's name ("electric") offers
 * it as a filter for Pokémon and moves (and a category's for moves, an
 * ability's or a move's for Pokémon — "trick room" keeps those that learn
 * it); picked, it narrows the list until it's removed. Several apply together.
 */
type Filter =
  | { kind: "type"; value: string }
  | { kind: "category"; value: MoveData["category"] }
  | { kind: "ability"; value: string }
  /** A moves.json key. */
  | { kind: "move"; value: string };

/** Any species' learnable moves (see useLearnsets) — null while they load. */
type Learnsets = ((species: string) => Set<string> | null) | null;

/** A filter's row in the list — an option whose id says it's a filter, see pick(). */
const FILTER_PREFIX = "filter:";

function filterId(filter: Filter): string {
  return `${FILTER_PREFIX}${filter.kind}:${filter.value}`;
}

function parseFilterId(id: string): Filter | null {
  if (!id.startsWith(FILTER_PREFIX)) return null;
  const [kind, value] = id.slice(FILTER_PREFIX.length).split(":");
  if (kind === "type" || kind === "ability" || kind === "move") return { kind, value };
  return { kind: "category", value: value as MoveData["category"] };
}

/** Whether an option of the Pokémon or move list passes a filter. */
function passes(
  field: Field,
  option: SearchableSelectOption,
  filter: Filter,
  learnsets: Learnsets,
): boolean {
  if (field.kind === "species") {
    if (filter.kind === "ability") return speciesAbilities(option.id).includes(filter.value);
    // A Mega learns what its base form does. Unknown movepools (or still
    // loading) don't pass: the filter promises the move is learnable.
    if (filter.kind === "move") {
      const key = MEGA_ROWS.get(option.id)?.baseKey ?? option.id;
      return !!learnsets?.(formatSpeciesDisplayName(key))?.has(filter.value);
    }
    return filter.kind === "type" && (SPECIES_TYPES[option.id] ?? []).includes(filter.value);
  }
  const move = MOVES[option.id];
  if (!move) return false;
  return filter.kind === "type" ? move.type === filter.value : move.category === filter.value;
}

const BASE_STATS = baseStatsData as unknown as Record<string, BaseStats>;
const ABILITIES = abilitiesData as unknown as Record<string, SpeciesAbility[]>;

/**
 * A Mega form's row in the Pokémon list (its id is the form's key, e.g.
 * "raichu-mega-y"): picked, it's the base Pokémon holding that Mega Stone,
 * like Showdown's "Raichu-Mega-Y". Filled as the list is built (see megaRows).
 */
interface MegaRow {
  baseKey: string;
  stone: string;
  /** The Mega's own ability — what it has once it Mega Evolves. */
  ability: string | undefined;
}
const MEGA_ROWS = new Map<string, MegaRow>();

/** A move's key in moves.json by its (English) name — what a set stores. */
const MOVE_KEY_BY_NAME = new Map(
  Object.entries(MOVES).map(([key, move]) => [move.name ?? key, key] as const),
);

/** Each of the regulation's Mega forms of a species, as list options. */
function megaRows(
  baseKey: string,
  regulation: Regulation,
  labels: OptionLabels,
): SearchableSelectOption[] {
  const { text } = labels;
  const baseName = formatSpeciesDisplayName(baseKey);
  return regulation.megaStoneItemsForSpecies(baseKey).flatMap((stone) => {
    const megaKey = candidateFormKeys(baseName, stone)[0];
    if (!megaKey || megaKey === baseKey) return [];
    MEGA_ROWS.set(megaKey, {
      baseKey,
      stone,
      ability: resolveEffectiveAbility(baseName, stone, ABILITIES[baseKey]?.[0]?.name),
    });
    const megaName = formatSpeciesDisplayName(megaKey);
    return [
      {
        id: megaKey,
        label: text.species(megaName),
        searchText: megaName,
        sprite: megaName,
        // The phone's stacked row, like the other Pokémon's.
        content: speciesOptionContent(megaKey, megaName, labels),
      },
    ];
  });
}

/** A Pokémon list row's abilities (English) — a Mega's is just its own. */
function speciesAbilities(key: string): string[] {
  const mega = MEGA_ROWS.get(key);
  if (mega) return mega.ability ? [mega.ability] : [];
  return (ABILITIES[key] ?? []).map((ability) => ability.name);
}

/**
 * The Pokémon and move lists' columns from `sm` up — Showdown's: sprite,
 * name, types, abilities, base stats and BST; or name, type, category,
 * power, accuracy, PP and the effect. The sort bar is their header.
 */
const SPECIES_GRID =
  "grid grid-cols-[2rem_minmax(7rem,12rem)_3rem_minmax(0,1fr)_repeat(7,2.25rem)] items-center gap-x-2";
const MOVE_GRID =
  "grid grid-cols-[minmax(8rem,13rem)_2.5rem_4.5rem_2.5rem_3rem_2rem_minmax(0,1fr)] items-center gap-x-2";
/** Each column's header in order — a sort column, a plain heading, or nothing. */
const SPECIES_COLUMNS: (SortKey | "abilities" | null)[] = [
  null,
  "name",
  "type",
  "abilities",
  "hp",
  "atk",
  "def",
  "spa",
  "spd",
  "spe",
  "bst",
];
const MOVE_COLUMNS: (SortKey | null)[] = [
  "name",
  "type",
  "category",
  "power",
  "accuracy",
  "pp",
  null,
];

/** The columns the Pokémon and move lists sort by — see sortValue. */
const MOVE_SORTS = ["name", "type", "category", "power", "accuracy", "pp"] as const;
const SPECIES_SORTS = ["name", "type", "hp", "atk", "def", "spa", "spd", "spe", "bst"] as const;
type SortKey = (typeof MOVE_SORTS)[number] | (typeof SPECIES_SORTS)[number];

/** A list's sort: its column, and whether it's reversed from that column's natural order. */
interface Sort {
  key: SortKey;
  reversed: boolean;
}

/** Names and types read A→Z; numbers (power, base stats…) high to low. */
function isTextSort(key: SortKey): boolean {
  return key === "name" || key === "type" || key === "category";
}

/**
 * An option's value for a sort column — a move's (by its key) or a species'
 * (by its key); null when it has none (a status move's power), which sorts last.
 */
function sortValue(
  field: Field,
  option: SearchableSelectOption,
  key: SortKey,
): string | number | null {
  if (key === "name") return option.label;
  if (field.kind === "move") {
    const move = MOVES[option.id];
    if (key === "type") return move?.type ?? "";
    if (key === "category") return move?.category ?? "";
    if (key === "power") return move?.power ?? null;
    // A move that never misses has no accuracy — it sorts above 100%.
    if (key === "accuracy") return move ? (move.accuracy ?? 101) : null;
    if (key === "pp") return move?.pp ?? null;
    return null;
  }
  if (key === "type") return SPECIES_TYPES[option.id]?.[0] ?? "";
  const stats = BASE_STATS[option.id];
  if (!stats) return null;
  if (key === "bst") return stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe;
  return key in stats ? stats[key as keyof BaseStats] : 0;
}

function sortOptions(
  field: Field,
  options: SearchableSelectOption[],
  sort: Sort,
): SearchableSelectOption[] {
  const direction = (isTextSort(sort.key) ? 1 : -1) * (sort.reversed ? -1 : 1);
  return [...options].sort((a, b) => {
    const left = sortValue(field, a, sort.key);
    const right = sortValue(field, b, sort.key);
    // No value goes last either way round.
    if (left === null || right === null) {
      if (left !== right) return left === null ? 1 : -1;
      return a.label.localeCompare(b.label);
    }
    const order =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
    // Ties (same type, same power…) fall back to the name.
    return order !== 0 ? order * direction : a.label.localeCompare(b.label);
  });
}

type Field =
  | { kind: "species" }
  | { kind: "item" }
  | { kind: "ability" }
  | { kind: "move"; slot: number }
  | { kind: "stats" };

/** The keyboard flow: Enter on a pick moves to the next one. */
const FIELD_ORDER: Field[] = [
  { kind: "species" },
  { kind: "ability" },
  { kind: "item" },
  { kind: "move", slot: 0 },
  { kind: "move", slot: 1 },
  { kind: "move", slot: 2 },
  { kind: "move", slot: 3 },
  { kind: "stats" },
];

function fieldKey(field: Field): string {
  return field.kind === "move" ? `move-${field.slot}` : field.kind;
}

/** Puts a move in a slot (an empty name clears it) without shifting the others. */
function setMoveSlot(moves: string[], slot: number, move: string): string[] {
  const next = [...moves];
  while (next.length < slot) next.push("");
  next[slot] = move;
  while (next.length > 0 && !next[next.length - 1]) next.pop();
  return next;
}

/** An option's saved (English) value — what a Pokémon's field holds. */
function englishValue(option: SearchableSelectOption): string {
  return option.searchText ?? option.label;
}

interface Group {
  title?: string;
  options: SearchableSelectOption[];
}

interface BuilderEditorProps {
  /** The slot's Pokémon, or null for an empty slot (only the Pokémon field works then). */
  pokemon: ParsedPokemon | null;
  /** The slot's name for labels — the Pokémon's, or "Slot 3". */
  title: string;
  regulation: Regulation;
  onChange: (pokemon: ParsedPokemon) => void;
  /** The slot's Copy / Import / Export / Remove, beside the Stats heading. */
  actions?: ReactNode;
}

/**
 * The Team Builder's set editor, laid out like Pokémon Showdown's: a compact
 * form in three sections — the Pokémon (species, item, ability), its moves
 * and its stats — over ONE results area. Whichever field has focus lists its
 * options there (its current pick pinned on top, then headed groups); typing
 * filters, ↑ / ↓ move, and Enter picks and goes on to the next field
 * (Pokémon → ability → item → moves → stats). The stats section opens the
 * Stat Points table (with the nature) in the same area.
 */
export function BuilderEditor({
  pokemon,
  title,
  regulation,
  onChange,
  actions,
}: BuilderEditorProps) {
  const t = useMessages();
  const text = usePokemonText();
  const isPhone = useIsPhone();
  const listId = useId();
  const options = localizedOptions({ text, t }, regulation.id);
  // Whether the sprite, types and stats show the Mega form (a Mega Stone
  // holder only) — a view, not saved: the set itself is the base form.
  const [mega, setMega] = useState(true);
  const labels = { text, hiddenAbility: t.editor.hiddenAbility, megaStone: t.editor.megaStone };
  // The base form is what's built and exported: its abilities are the ones
  // to pick from, even holding a Mega Stone (the Mega's own comes with it).
  const base = computePokemonBuild(pokemon, false, NO_STAT_OVERRIDES, labels, regulation);
  const megaForm = computePokemonBuild(pokemon, true, NO_STAT_OVERRIDES, labels, regulation);
  const { hasMegaForm, abilitySelectOptions, itemOptions, megaStones, hiddenAbility } = base;
  const megaAbility = hasMegaForm ? megaForm.effectiveAbility : undefined;
  const isMegaShown = hasMegaForm && mega;
  const heldMegaKey =
    pokemon && hasMegaForm ? candidateFormKeys(pokemon.species, pokemon.item)[0] : undefined;
  const heldMegaName = heldMegaKey ? formatSpeciesDisplayName(heldMegaKey) : undefined;
  // A saved ability the base form can't have — exported as is, so it's flagged.
  const isAbilityIllegal =
    !!pokemon?.ability &&
    abilitySelectOptions.length > 0 &&
    !abilitySelectOptions.some((option) => option.id === pokemon.ability);
  const { types, breakdown } = isMegaShown ? megaForm : base;
  // The moves this Pokémon learns (keys), the admin's corrections included —
  // null while loading, or for a form nothing covers; then every move is listed.
  const learnable = useLearnableMoves(pokemon?.species);
  // Every species' moves, for the Pokémon list's "learns" filter.
  const learnsets = useLearnsets();
  // The move list shows only those, unless "Show all moves" is on.
  const [learnableOnly, setLearnableOnly] = useState(true);
  /** A saved move this Pokémon can't learn — flagged like an illegal ability. */
  const isMoveIllegal = (move: string | undefined) => {
    const key = move && MOVE_KEY_BY_NAME.get(move);
    return !!learnable && !!key && !learnable.has(key);
  };
  const [active, setActive] = useState<Field>(pokemon ? { kind: "stats" } : { kind: "species" });
  // What's typed in the active field — null until something is (then the list filters).
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Whether ↑ / ↓ were used in the active field — then Enter picks the highlighted row.
  const [arrowed, setArrowed] = useState(false);
  // The Pokémon or move list's filters (see Filter) — cleared on leaving the field.
  const [filters, setFilters] = useState<Filter[]>([]);
  // The Pokémon list's and the move list's sorts — kept while moving between fields.
  const [sorts, setSorts] = useState<{ species?: Sort; move?: Sort }>({});
  // Phones: the active field's options open in a full-screen sheet (like the
  // Damage Calculator's pickers) instead of the area under the form.
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const fieldRefs = useRef(new Map<string, HTMLInputElement | HTMLButtonElement>());
  const areaRef = useRef<HTMLDivElement>(null);
  const sheetSearchRef = useRef<HTMLInputElement>(null);
  const moves = pokemon?.moves ?? [];

  // Phones: the sheet's search gets the keyboard for long lists (Pokémon,
  // items, moves) but not for the few abilities, which are quicker to tap.
  useEffect(() => {
    if (!isSheetOpen) return;
    const search = sheetSearchRef.current;
    if (active.kind === "ability") search?.blur();
    else search?.focus();
  }, [isSheetOpen, active]);

  // Keeps the keyboard-highlighted row in view while arrowing through —
  // scrolling only the area (scrollIntoView would scroll the page too),
  // clear of the sticky group heading.
  useEffect(() => {
    const area = areaRef.current;
    const row = area?.querySelector<HTMLElement>(`[data-row="${activeIndex}"]`);
    if (!area || !row) return;
    // The sticky column header and group heading, when there are any.
    const heading =
      (area.querySelector<HTMLElement>("[data-column-header]")?.offsetHeight ?? 0) +
      (area.querySelector<HTMLElement>("[role=group] > h4")?.offsetHeight ?? 0);
    if (row.offsetTop - heading < area.scrollTop) {
      area.scrollTop = row.offsetTop - heading;
    } else if (row.offsetTop + row.offsetHeight > area.scrollTop + area.clientHeight) {
      area.scrollTop = row.offsetTop + row.offsetHeight - area.clientHeight;
    }
  }, [activeIndex]);

  /** The English value a field holds now. */
  function currentValue(field: Field): string | undefined {
    if (!pokemon) return undefined;
    // Holding its Mega Stone, it's the Mega's row (and name), like Showdown's "Raichu-Mega-Y".
    if (field.kind === "species") return heldMegaName ?? pokemon.species;
    if (field.kind === "item") return pokemon.item;
    if (field.kind === "ability") return pokemon.ability;
    if (field.kind === "move") return moves[field.slot] || undefined;
    return undefined;
  }

  function displayValue(field: Field): string {
    const value = currentValue(field);
    if (!value) return "";
    if (field.kind === "species") return text.species(value);
    if (field.kind === "item") return text.item(value);
    if (field.kind === "ability") return text.ability(value);
    return text.move(value);
  }

  function groupsFor(field: Field): Group[] {
    if (field.kind === "species") {
      // Each Mega right after its base form, to pick on its own.
      return [
        {
          options: options.species.flatMap((option) => [
            option,
            ...megaRows(option.id, regulation, { text, t }),
          ]),
        },
      ];
    }
    if (field.kind === "item") {
      return [
        {
          title: t.teamBuilder.megaStones,
          options: itemOptions.filter((o) => megaStones.includes(o.id)),
        },
        {
          title: t.teamBuilder.items,
          options: itemOptions.filter((o) => !megaStones.includes(o.id)),
        },
      ];
    }
    if (field.kind === "ability") {
      return [
        {
          title: t.teamBuilder.abilities,
          options: abilitySelectOptions.filter((o) => o.id !== hiddenAbility),
        },
        {
          title: t.editor.hiddenAbility,
          options: abilitySelectOptions.filter((o) => o.id === hiddenAbility),
        },
      ];
    }
    if (field.kind === "move") {
      // A Pokémon can't know the same move twice.
      const usedElsewhere = moves.filter((move, slot) => move && slot !== field.slot);
      return [
        {
          title: t.editor.moves,
          options: options.moves.filter(
            (o) =>
              !usedElsewhere.includes(englishValue(o)) &&
              (!learnableOnly || !learnable || learnable.has(o.id)),
          ),
        },
      ];
    }
    return [];
  }

  // The active field's rows: its current pick pinned on top (until you
  // type), then each group, filtered by what's typed.
  const folded = query === null ? "" : foldForSearch(query.trim());
  const current = currentValue(active);
  const canFilter = active.kind === "species" || active.kind === "move";
  // What's typed may name a type (or a move category): offered as a filter, on top.
  const filterSuggestions: SearchableSelectOption[] =
    canFilter && folded
      ? [
          ...TYPES.map((type): Filter => ({ kind: "type", value: type })),
          ...(active.kind === "move"
            ? CATEGORIES.map((category): Filter => ({ kind: "category", value: category }))
            : []),
          ...(active.kind === "species" ? [...abilitySuggestions(), ...moveSuggestions()] : []),
        ]
          .filter((filter) => !filters.some((applied) => filterId(applied) === filterId(filter)))
          .filter((filter) => {
            const name = filterName(filter);
            return (
              foldForSearch(name).startsWith(folded) ||
              foldForSearch(filter.value).startsWith(folded)
            );
          })
          .map((filter) => ({
            id: filterId(filter),
            label: filterName(filter),
            searchText: filter.value,
            content: filterContent(filter),
          }))
      : [];
  const allGroups = [
    ...(filterSuggestions.length > 0
      ? [{ title: t.teamBuilder.filtersGroup, options: filterSuggestions }]
      : []),
    ...groupsFor(active).map((group) => ({
      ...group,
      options: group.options.filter((option) =>
        filters.every((filter) => passes(active, option, filter, learnsets)),
      ),
    })),
  ];
  const listed =
    !folded && filters.length === 0 && current
      ? allGroups.flatMap((group) => group.options).find((o) => englishValue(o) === current)
      : undefined;
  // An ability the form can't have (e.g. a Mega's own, saved before) or a
  // move it can't learn stays pinned, marked Illegal, until another is picked.
  const isPinnedIllegal =
    !folded &&
    filters.length === 0 &&
    !!current &&
    !listed &&
    (active.kind === "ability" || (active.kind === "move" && isMoveIllegal(current)));
  const pinned: SearchableSelectOption | undefined = isPinnedIllegal
    ? active.kind === "move"
      ? (options.moves.find((o) => englishValue(o) === current) ?? {
          id: current,
          label: text.move(current),
          searchText: current,
        })
      : { id: current, label: text.ability(current), searchText: current }
    : listed;
  let budget = MAX_ROWS;
  const sortKind = active.kind === "species" || active.kind === "move" ? active.kind : null;
  const sort = sortKind ? sorts[sortKind] : undefined;
  // Showdown-style columns, with the sort bar as their header — phones keep stacked rows.
  const columns = !!sortKind && !isPhone;
  const groups = allGroups
    .map((group) => {
      const isFilterRows = group.options.some((option) => option.id.startsWith(FILTER_PREFIX));
      const sorted =
        sort && !isFilterRows ? sortOptions(active, group.options, sort) : group.options;
      const matching = folded
        ? sorted.filter(
            (o) =>
              foldForSearch(o.label).includes(folded) ||
              foldForSearch(englishValue(o)).includes(folded) ||
              // A Pokémon is also found by its abilities ("intimid" → Incineroar…).
              (active.kind === "species" &&
                !o.id.startsWith(FILTER_PREFIX) &&
                speciesAbilities(o.id).some(
                  (ability) =>
                    foldForSearch(ability).includes(folded) ||
                    foldForSearch(text.ability(ability)).includes(folded),
                )),
          )
        : sorted;
      const shown = matching.slice(0, Math.max(0, budget));
      budget -= shown.length;
      return { ...group, options: shown, total: matching.length };
    })
    .filter((group) => group.options.length > 0);
  const rows = [...(pinned ? [pinned] : []), ...groups.flatMap((group) => group.options)];
  const isCut = groups.some((group) => group.options.length < group.total);
  const highlighted = Math.min(activeIndex, Math.max(0, rows.length - 1));

  function activate(field: Field) {
    setActive(field);
    setQuery(null);
    setActiveIndex(0);
    setArrowed(false);
    setFilters([]);
  }

  /** Phones: a field's tap opens its options in the sheet. */
  function openSheet(field: Field) {
    activate(field);
    setIsSheetOpen(true);
  }

  function closeSheet() {
    setIsSheetOpen(false);
    activate({ kind: "stats" });
  }

  function filterName(filter: Filter): string {
    if (filter.kind === "type") return text.type(filter.value);
    if (filter.kind === "ability") return text.ability(filter.value);
    if (filter.kind === "move") return text.move(MOVES[filter.value]?.name ?? filter.value);
    return t.editor.categories[filter.value];
  }

  /** Abilities whose name starts with what's typed, offered as filters (a few at most). */
  function abilitySuggestions(): Filter[] {
    const names = new Set(
      options.species.flatMap((option) => [
        ...speciesAbilities(option.id),
        ...megaRows(option.id, regulation, { text, t }).flatMap((mega) =>
          speciesAbilities(mega.id),
        ),
      ]),
    );
    return [...names]
      .filter(
        (name) =>
          foldForSearch(name).startsWith(folded) ||
          foldForSearch(text.ability(name)).startsWith(folded),
      )
      .slice(0, 4)
      .map((name) => ({ kind: "ability", value: name }));
  }

  /** Moves whose name starts with what's typed, offered as "learns" filters (a few at most). */
  function moveSuggestions(): Filter[] {
    // The move field's own list: no Z-Moves or Max Moves.
    return options.moves
      .filter(
        (option) =>
          foldForSearch(option.label).startsWith(folded) ||
          foldForSearch(englishValue(option)).startsWith(folded),
      )
      .slice(0, 4)
      .map((option) => ({ kind: "move", value: option.id }));
  }

  /** The type icon a filter shows: its own type, or a move's. */
  function filterType(filter: Filter): string | undefined {
    if (filter.kind === "type") return filter.value;
    if (filter.kind === "move") return MOVES[filter.value]?.type;
    return undefined;
  }

  function filterContent(filter: Filter) {
    const type = filterType(filter);
    return (
      <span className="flex items-center gap-2">
        {type && <TypeIcon type={type} size={16} />}
        <span className="font-medium">{filterName(filter)}</span>
        <span className="text-xs text-zinc-500">
          {filter.kind === "type"
            ? t.teamBuilder.typeFilter
            : filter.kind === "ability"
              ? t.teamBuilder.abilityFilter
              : filter.kind === "move"
                ? t.teamBuilder.moveFilter
                : t.teamBuilder.categoryFilter}
        </span>
      </span>
    );
  }

  function sortLabel(key: SortKey): string {
    if (key === "name") return t.teamBuilder.sortName;
    if (key === "type") return t.teamBuilder.sortType;
    if (key === "category") return t.teamBuilder.sortCategory;
    if (key === "power") return t.editor.power;
    if (key === "accuracy") return t.editor.accuracy;
    if (key === "pp") return t.editor.pp;
    if (key === "bst") return t.editor.bst;
    return t.stats.short[key];
  }

  /** A column's first click sorts by it; the next reverses it. */
  function toggleSort(key: SortKey) {
    if (!sortKind) return;
    setSorts({
      ...sorts,
      [sortKind]: { key, reversed: sort?.key === key ? !sort.reversed : false },
    });
    setActiveIndex(0);
  }

  /** A sort column's button (see toggleSort) — in the column header, or the phone's sort bar. */
  function sortButton(key: SortKey) {
    const isSorted = sort?.key === key;
    // Which way it reads now: ↑ low to high (A→Z), ↓ high to low.
    const ascending = isSorted && isTextSort(key) !== sort.reversed;
    return (
      <button
        key={key}
        type="button"
        tabIndex={-1}
        // Keeps the focus in the field, so typing carries on.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggleSort(key)}
        aria-pressed={isSorted}
        title={t.teamBuilder.sortHint(sortLabel(key))}
        className={cn(
          "flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-zinc-200 hover:text-zinc-900",
          isSorted && "bg-zinc-200 font-semibold text-zinc-900",
        )}
      >
        {sortLabel(key)}
        {isSorted && (
          <Icon name={ascending ? IconName.ArrowUpward : IconName.ArrowDownward} size={11} />
        )}
      </button>
    );
  }

  function removeFilter(index: number) {
    setFilters(filters.filter((_, i) => i !== index));
    setActiveIndex(0);
  }

  /** Opens the stats area and focuses its first Stat Points box. */
  function enterStats() {
    activate({ kind: "stats" });
    requestAnimationFrame(() => areaRef.current?.querySelector<HTMLInputElement>("input")?.focus());
  }

  function focusField(field: Field | undefined) {
    if (!field) return;
    if (isPhone) {
      // The sheet moves on to the next field; after the last move it closes
      // on the Stat Points, always shown under the form.
      if (field.kind === "stats") {
        activate(field);
        setIsSheetOpen(false);
      } else {
        activate(field);
      }
      return;
    }
    // Moving on from the last move goes straight into the Stat Points.
    if (field.kind === "stats") return enterStats();
    // After the pick re-renders (a new Pokémon enables the fields after it).
    requestAnimationFrame(() => fieldRefs.current.get(fieldKey(field))?.focus());
  }

  function focusNext(field: Field) {
    const index = FIELD_ORDER.findIndex((f) => fieldKey(f) === fieldKey(field));
    focusField(FIELD_ORDER[index + 1]);
  }

  /** Picks an option and moves on to the next field, like Showdown. */
  function pick(option: SearchableSelectOption) {
    // A filter row narrows the list instead, and the field stays for more typing.
    const filter = parseFilterId(option.id);
    if (filter) {
      setFilters([...filters, filter]);
      setQuery("");
      setActiveIndex(0);
      setArrowed(false);
      return;
    }
    const value = englishValue(option);
    // Re-picking what's there keeps it (a new species would start a blank set).
    const isSame =
      value === currentValue(active) ||
      (active.kind === "species" &&
        !!pokemon &&
        normalizeSpeciesKey(pokemon.species) === option.id);
    const megaRow = active.kind === "species" ? MEGA_ROWS.get(option.id) : undefined;
    if (isSame) {
      // Nothing to change.
    } else if (megaRow) {
      // A Mega: the base Pokémon holding its stone — the same Pokémon keeps its set.
      const isSameSpecies = !!pokemon && normalizeSpeciesKey(pokemon.species) === megaRow.baseKey;
      onChange({
        ...(isSameSpecies ? pokemon : buildCustomPokemon(megaRow.baseKey)),
        item: megaRow.stone,
      });
    } else if (active.kind === "species") {
      onChange(buildCustomPokemon(option.id));
    } else if (pokemon && active.kind === "item") {
      onChange({ ...pokemon, item: option.id });
    } else if (pokemon && active.kind === "ability") {
      onChange({ ...pokemon, ability: option.id });
    } else if (pokemon && active.kind === "move") {
      onChange({ ...pokemon, moves: setMoveSlot(moves, active.slot, value) });
    }
    setQuery(null);
    setActiveIndex(0);
    setArrowed(false);
    focusNext(active);
  }

  function clear(field: Field) {
    if (!pokemon) return;
    if (field.kind === "item") onChange({ ...pokemon, item: undefined });
    if (field.kind === "move") onChange({ ...pokemon, moves: setMoveSlot(moves, field.slot, "") });
    if (!isPhone) focusField(field);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, field: Field) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setArrowed(true);
      const last = rows.length - 1;
      setActiveIndex(
        event.key === "ArrowDown" ? Math.min(highlighted + 1, last) : Math.max(highlighted - 1, 0),
      );
    } else if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
      // Tab moves on just like Enter.
      event.preventDefault();
      // Untouched, Enter keeps the field as it is (its pick is the top row) and moves on.
      if (query === null && !arrowed && !currentValue(field)) focusNext(field);
      else if (rows[highlighted]) pick(rows[highlighted]);
    } else if (
      event.key === "Backspace" &&
      filters.length > 0 &&
      (query === "" || (query === null && !displayValue(field)))
    ) {
      // In an empty field, Backspace removes the last filter.
      event.preventDefault();
      removeFilter(filters.length - 1);
    } else if (event.key === "Escape") {
      setQuery(null);
      setActiveIndex(0);
    }
  }

  function fieldPlaceholder(field: Field): string {
    if (field.kind === "species") return t.editor.searchPokemon;
    if (field.kind === "item") return t.editor.addItem;
    if (field.kind === "ability") return t.editor.selectAbility;
    return t.editor.addMove;
  }

  function fieldLabel(field: Field): string {
    if (field.kind === "species") return t.editor.pokemon;
    if (field.kind === "item") return t.editor.item;
    if (field.kind === "ability") return t.editor.ability;
    if (field.kind === "move") return t.editor.moveSlot(title, field.slot + 1);
    return t.editor.stats;
  }

  /** One of the form's fields; `leading` sits inside it on the left (the item's icon). */
  function input(field: Field, placeholder: string, clearable = false, leading?: ReactNode) {
    const key = fieldKey(field);
    const isActive = fieldKey(active) === key;
    const display = displayValue(field);
    // A move shows its type in a colored cap, like the Damage Calculator's move rows
    // (not while typing a new one).
    const moveKey =
      field.kind === "move" && moves[field.slot]
        ? MOVE_KEY_BY_NAME.get(moves[field.slot])
        : undefined;
    const capType = moveKey && !(isActive && query !== null) ? MOVES[moveKey]?.type : undefined;
    const label =
      field.kind === "move" ? fieldLabel(field) : t.editor.fieldLabel(title, fieldLabel(field));
    return (
      <div className="relative min-w-0">
        <input
          ref={(element) => {
            if (element) fieldRefs.current.set(key, element);
            else fieldRefs.current.delete(key);
          }}
          type="text"
          role="combobox"
          aria-expanded={isActive}
          aria-controls={listId}
          aria-activedescendant={
            isActive && rows[highlighted] ? `${listId}-${highlighted}` : undefined
          }
          aria-autocomplete="list"
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          disabled={field.kind !== "species" && !pokemon}
          // Phones: a tap opens the field's options in a full-screen sheet (typing happens there).
          readOnly={isPhone}
          onClick={isPhone ? () => openSheet(field) : undefined}
          value={isActive && query !== null && !isPhone ? query : display}
          placeholder={placeholder}
          onFocus={(event) => {
            if (isPhone) return;
            if (!isActive) activate(field);
            event.target.select();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => handleKeyDown(event, field)}
          className={cn(
            "h-8 w-full rounded-md border bg-field px-2 text-sm text-zinc-900 focus:outline-none disabled:opacity-50",
            isPhone && "h-10 cursor-pointer",
            clearable && display && "pr-7",
            leading && "pl-8",
            capType && "pl-12",
            isActive && !isPhone ? "border-zinc-600 ring-2 ring-zinc-400" : "border-zinc-300",
            ((field.kind === "ability" && isAbilityIllegal) ||
              (field.kind === "move" && isMoveIllegal(moves[field.slot]))) &&
              "border-red-600 text-red-600",
          )}
        />
        {capType && (
          // Type-colored cap with a slanted right edge, inside the field's border.
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-px left-px flex w-10 items-center justify-center rounded-l-[5px] pr-1.5"
            style={{
              backgroundColor: TYPE_COLORS[capType] ?? "var(--color-zinc-300)",
              clipPath: "polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
            }}
          >
            <TypeIcon type={capType} size={20} />
          </span>
        )}
        {leading && (
          <span className="pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2">
            {leading}
          </span>
        )}
        {clearable && display && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => clear(field)}
            aria-label={t.editor.clear(label)}
            title={t.editor.clear(label)}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <Icon name={IconName.Close} size={12} />
          </button>
        )}
      </div>
    );
  }

  /** A Pokémon's columns (see SPECIES_GRID). */
  function speciesCells(option: SearchableSelectOption) {
    const mega = MEGA_ROWS.get(option.id);
    const abilities: SpeciesAbility[] = mega
      ? mega.ability
        ? [{ name: mega.ability, isHidden: false }]
        : []
      : (ABILITIES[option.id] ?? []);
    const regular = abilities.filter((ability) => !ability.isHidden);
    const hidden = abilities.find((ability) => ability.isHidden);
    const stats = BASE_STATS[option.id];
    return (
      <>
        <span className="relative h-8 w-8 overflow-hidden rounded">
          <PokemonSprite species={option.sprite ?? option.label} fill />
        </span>
        <span className="truncate font-medium">{option.label}</span>
        <span className="flex gap-0.5">
          {(SPECIES_TYPES[option.id] ?? []).map((type) => (
            <TypeIcon key={type} type={type} size={14} />
          ))}
        </span>
        <span className="truncate text-sm text-zinc-800">
          {regular.map((ability) => text.ability(ability.name)).join(" / ")}
          {hidden && (
            <span className="text-zinc-500">
              {regular.length > 0 && " · "}
              {text.ability(hidden.name)} ({t.editor.hiddenShort})
            </span>
          )}
        </span>
        {(["hp", "atk", "def", "spa", "spd", "spe", "bst"] as const).map((key) => (
          <span
            key={key}
            className={cn(
              "text-right text-xs text-zinc-600 tabular-nums",
              sort?.key === key && "font-semibold text-zinc-900",
            )}
          >
            {stats ? sortValue(active, option, key) : "—"}
          </span>
        ))}
      </>
    );
  }

  /** A move's columns (see MOVE_GRID). */
  function moveCells(option: SearchableSelectOption, isIllegal: boolean) {
    const move = MOVES[option.id];
    const number = (key: SortKey, value: string | number | null | undefined) => (
      <span
        className={cn(
          "text-right text-xs text-zinc-600 tabular-nums",
          sort?.key === key && "font-semibold text-zinc-900",
        )}
      >
        {value ?? "—"}
      </span>
    );
    return (
      <>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{option.label}</span>
          {isIllegal && illegalTag}
        </span>
        <span>{move && <TypeIcon type={move.type} size={14} />}</span>
        <span className="text-[10px] tracking-wide text-zinc-500 uppercase">
          {move && t.editor.categories[move.category]}
        </span>
        {number("power", move?.power)}
        {number("accuracy", move?.accuracy ? `${move.accuracy}%` : undefined)}
        {number("pp", move?.pp)}
        <span className="truncate text-xs text-zinc-500">{move?.shortDesc}</span>
      </>
    );
  }

  const illegalTag = (
    <span className="shrink-0 rounded border border-red-600 px-1.5 text-xs text-red-600 italic">
      {t.teamBuilder.illegal}
    </span>
  );

  function row(option: SearchableSelectOption, index: number, isCurrent: boolean) {
    const isHighlighted = index === highlighted;
    const isIllegal = isCurrent && isPinnedIllegal;
    // A "Filters" row spans the columns.
    const cells =
      columns && !option.id.startsWith(FILTER_PREFIX)
        ? sortKind === "move"
          ? moveCells(option, isIllegal)
          : speciesCells(option)
        : null;
    return (
      <div
        key={`${isCurrent ? "current" : "option"}-${option.id}`}
        id={`${listId}-${index}`}
        role="option"
        aria-selected={isHighlighted}
        data-row={index}
        // Keeps the focus in the field, so typing and Enter carry on from there.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => pick(option)}
        onMouseEnter={() => setActiveIndex(index)}
        className={cn(
          "cursor-pointer rounded-md px-2 text-sm text-zinc-900",
          cells
            ? cn(sortKind === "move" ? MOVE_GRID : SPECIES_GRID, "py-1")
            : "flex items-center gap-2 py-1.5",
          isHighlighted && "bg-zinc-200",
          isCurrent && "ring-1 ring-zinc-400",
          // Phones have the sheet's full height: descriptions wrap instead of cutting off.
          isPhone && "py-2 [&_.truncate]:whitespace-normal",
        )}
      >
        {cells ?? option.content ?? (
          <>
            {option.sprite && (
              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                <PokemonSprite species={option.sprite} fill />
              </span>
            )}
            <span className="truncate">{option.label}</span>
          </>
        )}
        {isIllegal && !cells && illegalTag}
      </div>
    );
  }

  const sectionTitle = "text-xs font-semibold tracking-wide text-zinc-500 uppercase";
  const fieldTitle = "text-[11px] font-medium text-zinc-500";
  const statsActive = active.kind === "stats";
  const spriteBox = (
    <div className={cn("relative shrink-0", isPhone ? "h-28 w-28" : "h-24 w-24")}>
      <div className="h-full w-full overflow-hidden rounded-xl bg-zinc-500/20">
        {pokemon && (
          <PokemonSprite
            species={pokemon.species}
            // No Mega Stone, no Mega sprite.
            item={hasMegaForm && !mega ? undefined : pokemon.item}
            fill
          />
        )}
      </div>
      {/* Phones: the types sit on the sprite's upper corner, leaving its side to the fields. */}
      {isPhone && (
        <div className="absolute top-1 left-1 flex gap-1">
          {types.map((type) => (
            <TypeIcon key={type} type={type} size={18} />
          ))}
        </div>
      )}
      {/* The Mega toggle sits on the sprite's lower corner — it changes the sprite. */}
      {hasMegaForm && (
        <TogglePill
          active={mega}
          onClick={() => setMega(!mega)}
          title={t.teamBuilder.megaHint}
          className={cn(
            "absolute right-1 bottom-1 px-2 py-0 text-[11px] font-semibold shadow-sm",
            !mega && "bg-raised",
          )}
        >
          {t.editor.mega}
        </TogglePill>
      )}
    </div>
  );
  const pokemonField = (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className={fieldTitle}>{t.editor.pokemon}</span>
      {input({ kind: "species" }, t.editor.searchPokemon)}
    </label>
  );
  const abilityField = (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className={fieldTitle}>{t.editor.ability}</span>
      {input({ kind: "ability" }, t.editor.selectAbility)}
    </label>
  );
  const itemField = (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className={fieldTitle}>{t.editor.item}</span>
      {input(
        { kind: "item" },
        t.editor.addItem,
        true,
        pokemon?.item && <ItemIcon item={pokemon.item} size={20} />,
      )}
    </label>
  );
  // The active field's options — under the form on desktop, in the sheet on phones.
  const results = (
    <>
      {/* Only the moves it learns — or every move, for one the list leaves out. */}
      {active.kind === "move" && learnable && pokemon && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-zinc-200 px-3 py-1.5 text-xs text-zinc-600">
          <span>
            {learnableOnly
              ? t.teamBuilder.learnableMoves(text.species(pokemon.species), learnable.size)
              : t.teamBuilder.allMovesShown}
          </span>
          <button
            type="button"
            tabIndex={-1}
            // Keeps the focus in the field.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setLearnableOnly(!learnableOnly);
              setActiveIndex(0);
            }}
            className="font-medium text-zinc-800 underline hover:text-zinc-950"
          >
            {learnableOnly
              ? t.teamBuilder.showAllMoves
              : t.teamBuilder.showLearnable(text.species(pokemon.species))}
          </button>
        </div>
      )}
      {columns ? (
        <div
          data-column-header
          className={cn(
            sortKind === "move" ? MOVE_GRID : SPECIES_GRID,
            "sticky top-0 z-20 h-7 border-b border-zinc-200 bg-zinc-100 px-3.5 text-xs text-zinc-600",
          )}
        >
          {(sortKind === "move" ? MOVE_COLUMNS : SPECIES_COLUMNS).map((column, index) =>
            column === null ? (
              <span key={index} />
            ) : column === "abilities" ? (
              <span key={column}>{t.teamBuilder.abilities}</span>
            ) : (
              <span key={column} className={cn(!isTextSort(column) && "flex justify-end")}>
                {sortButton(column)}
              </span>
            ),
          )}
        </div>
      ) : (
        sortKind && (
          <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
            <span className="mr-1 font-semibold">{t.teamBuilder.sortBy}</span>
            {(sortKind === "move" ? MOVE_SORTS : SPECIES_SORTS).map(sortButton)}
          </div>
        )
      )}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-raised px-3 py-1.5 text-xs text-zinc-600">
          <span className="font-semibold">{t.teamBuilder.filtersGroup}:</span>
          {filters.map((filter, index) => (
            <span
              key={filterId(filter)}
              className="flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 py-0.5 pr-1 pl-2 font-medium text-zinc-800"
            >
              {filterType(filter) && <TypeIcon type={filterType(filter)!} size={12} />}
              {filterName(filter)}
              <button
                type="button"
                tabIndex={-1}
                // Keeps the focus in the field.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => removeFilter(index)}
                aria-label={t.teamBuilder.removeFilter(filterName(filter))}
                title={t.teamBuilder.removeFilter(filterName(filter))}
                className="rounded-full p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
              >
                <Icon name={IconName.Close} size={11} />
              </button>
            </span>
          ))}
          <span className="text-zinc-500">{t.teamBuilder.filterBackspaceHint}</span>
        </div>
      )}
      <div id={listId} role="listbox" aria-label={t.teamBuilder.resultsLabel(fieldLabel(active))}>
        {/* Like Showdown: the ability to pick is the base form's; the Mega's comes with it. */}
        {active.kind === "ability" && megaAbility && (
          <p className="border-b border-zinc-200 px-3 py-2 text-sm text-zinc-700">
            {t.teamBuilder.afterMega.before}
            <strong className="font-semibold text-zinc-900">{text.ability(megaAbility)}</strong>
            {t.teamBuilder.afterMega.after}
          </p>
        )}
        {rows.length === 0 ? (
          <p className="p-3 text-sm text-zinc-500">{t.editor.noMatches}</p>
        ) : (
          <>
            {pinned && <div className="border-b border-zinc-200 p-1.5">{row(pinned, 0, true)}</div>}
            {groups.map((group, groupIndex) => {
              const offset =
                (pinned ? 1 : 0) +
                groups.slice(0, groupIndex).reduce((sum, g) => sum + g.options.length, 0);
              return (
                <div key={group.title ?? groupIndex} role="group" aria-label={group.title}>
                  {/* A lone group under the column header needs no heading of its own. */}
                  {group.title && !(columns && groups.length === 1) && (
                    <h4
                      className={cn(
                        "sticky z-10 border-b border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",
                        columns ? "top-7" : "top-0",
                      )}
                    >
                      {group.title}
                    </h4>
                  )}
                  <div className="flex flex-col p-1.5">
                    {group.options.map((option, index) => row(option, offset + index, false))}
                  </div>
                </div>
              );
            })}
            {isCut && (
              <p className="px-3 pb-2 text-[11px] text-zinc-500">
                {t.calcPanel.keepTyping(MAX_ROWS)}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* The form: the Pokémon, its moves, its stats. */}
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* No heading: the sprite says which Pokémon it is. Desktop: its types beside it, then
            Pokémon, Ability and Item in one row at the bottom (in line with the last move).
            Phones: Pokémon and Ability stacked beside the sprite (types on it), Item below. */}
        <section
          aria-label={t.editor.pokemon}
          className="flex min-w-0 flex-col gap-2 md:justify-between"
        >
          {isPhone ? (
            <div className="flex items-end gap-3">
              {spriteBox}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {pokemonField}
                {abilityField}
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-3">
              {spriteBox}
              <div className="flex items-center gap-1.5 pb-1">
                {types.map((type) => (
                  <TypeIcon key={type} type={type} size={24} />
                ))}
              </div>
            </div>
          )}
          {isPhone ? (
            itemField
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {pokemonField}
              {abilityField}
              {itemField}
            </div>
          )}
        </section>

        <section aria-label={t.editor.moves} className="flex min-w-0 flex-col gap-1.5">
          <h3 className={sectionTitle}>{t.editor.moves}</h3>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
            {[0, 1, 2, 3].map((slot) => (
              <Fragment key={slot}>
                {input({ kind: "move", slot }, t.editor.addMove, true)}
              </Fragment>
            ))}
          </div>
        </section>

        <section aria-label={t.editor.stats} className="flex min-w-0 flex-col gap-1.5">
          <div className="-my-1 flex items-center justify-between gap-2">
            <h3 className={sectionTitle}>{t.editor.stats}</h3>
            {actions}
          </div>
          {/* Phones show the Stat Points table itself under the form instead. */}
          {!isPhone && (
            <button
              ref={(element) => {
                if (element) fieldRefs.current.set("stats", element);
                else fieldRefs.current.delete("stats");
              }}
              type="button"
              disabled={!breakdown}
              aria-expanded={statsActive}
              aria-controls={listId}
              onFocus={(event) => {
                // Tab from the last move goes straight into the Stat Points too.
                const from = event.relatedTarget;
                if (from instanceof HTMLElement && from === fieldRefs.current.get("move-3")) {
                  enterStats();
                } else if (!statsActive) {
                  activate({ kind: "stats" });
                }
              }}
              onClick={() => activate({ kind: "stats" })}
              onKeyDown={(event) => {
                // Enter (or Tab) goes into the Stat Points table, like a pick moves on.
                if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
                  event.preventDefault();
                  enterStats();
                }
              }}
              title={t.teamBuilder.editStats}
              className={cn(
                // Beside the moves, as tall as them (the bars spread out to fill it).
                "flex flex-col gap-1 rounded-md border bg-field p-2 text-left focus:outline-none disabled:opacity-50 md:flex-1 md:justify-between",
                statsActive
                  ? "border-zinc-600 ring-2 ring-zinc-400"
                  : "border-zinc-300 hover:border-zinc-400",
              )}
            >
              {STAT_ORDER.map((stat) => {
                const isUp = breakdown?.final.increasedStat === stat;
                const isDown = breakdown?.final.decreasedStat === stat;
                const points = breakdown?.statPoints[stat] ?? 0;
                return (
                  <span key={stat} className="flex items-center gap-2 text-[11px] text-zinc-600">
                    <span
                      className={cn(
                        "w-7 shrink-0",
                        isUp && "font-semibold text-red-600",
                        isDown && "font-semibold text-blue-600",
                      )}
                    >
                      {t.stats.short[stat]}
                    </span>
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          // The base stat's quality, like the Stat Points table's bars
                          // (the Stat Points are the number beside it).
                          width: `${breakdown ? statBarWidth(breakdown.base[stat]) : 0}%`,
                          backgroundColor: statBarColor(breakdown?.base[stat] ?? 0),
                        }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right font-medium tabular-nums">
                      {points > 0 ? points : "–"}
                    </span>
                  </span>
                );
              })}
            </button>
          )}
        </section>
      </div>

      {/* The results area: the active field's options, or the Stat Points table. */}
      <div
        ref={areaRef}
        className={cn(
          "relative flex flex-col rounded-lg border border-zinc-200 bg-raised",
          !isPhone && "max-h-[60vh] min-h-48 overflow-y-auto",
        )}
      >
        {statsActive || isPhone
          ? pokemon && (
              // FLOW_ROOT: Enter in a Stat Points box moves to the next, then the nature.
              <div {...FLOW_ROOT} className="p-3">
                <PokemonEditor
                  title={title}
                  pokemon={pokemon}
                  statOverrides={NO_STAT_OVERRIDES}
                  onStatOverridesChange={(overrides) =>
                    onChange(applyStatOverrides(pokemon, overrides))
                  }
                  maxTotalStatPoints={MAX_TOTAL_STAT_POINTS}
                  regulationId={regulation.id}
                  mega={mega}
                  layout="stats"
                />
              </div>
            )
          : results}
      </div>

      {isPhone && isSheetOpen && !statsActive && (
        <PickerSheet
          title={
            // A move's label already names the Pokémon ("Gengar move 2").
            active.kind === "move"
              ? fieldLabel(active)
              : t.teamBuilder.sheetTitle(title, fieldLabel(active))
          }
          onClose={closeSheet}
          search={
            <input
              ref={sheetSearchRef}
              type="search"
              value={query ?? ""}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (rows[highlighted]) pick(rows[highlighted]);
                } else if (event.key === "Backspace" && !query && filters.length > 0) {
                  event.preventDefault();
                  removeFilter(filters.length - 1);
                }
              }}
              placeholder={fieldPlaceholder(active)}
              aria-label={t.editor.fieldLabel(title, fieldLabel(active))}
              enterKeyHint="next"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className={pickerSheetSearchClassName}
            />
          }
        >
          {results}
        </PickerSheet>
      )}
    </div>
  );
}
