"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { useMyTeams } from "@/hooks/useMyTeams";
import { useOpponents } from "@/hooks/useOpponents";
import { useGroups } from "@/hooks/useGroups";
import { useGroupOpponents } from "@/hooks/useGroupOpponents";
import { useCalcSets, type SavedSetRef } from "@/hooks/useCalcSets";
import { readDefenderDraft, writeDefenderDraft } from "./defenderDraftStore";
import { MobileRosterBar } from "./MobileRosterBar";
import { speciesIdentity } from "@/lib/teamIdentity";
import { hasSavedCalc } from "@/lib/teamCalcs";
import { generateId } from "@/lib/id";
import { ensureSidebarSelection, removeSidebarEntry } from "@/lib/calcSidebar";
import { calculateDamage, moveHitRange } from "@/lib/damage/calculateDamage";
import { applyStatOverrides, type StatOverrides } from "@/lib/stats/applyStatOverrides";
import { calculateStatBreakdown } from "@/lib/stats/calculateFinalStats";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { megaDisplayName } from "@/lib/species/megaForm";
import { TYPE_COLORS, WEATHER_SETTING_ABILITIES } from "@/constants";
import movesData from "@/data/moves.json";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import {
  DEFAULT_BATTLE_STATE,
  EFFECT_MOVES,
  MAX_SIDEBAR_POKEMON,
  RosterPokemonPicker,
  type PokemonBattleState,
  type SidebarEntry,
} from "./RosterPokemonPicker";
import { DEFAULT_SPECIES_KEY, STAT_LABELS, buildCustomPokemon } from "../PokemonEditor";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Icon } from "../Icon";
import { toast } from "../Toast";
import { PokemonSprite } from "../PokemonSprite";
import { TypeIcon } from "../TypeIcon";
import { IconName } from "@/enums";
import type { DamageCalcOptions, DamageResult, MoveData, ParsedPokemon, TeamCalcSide } from "@/types";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import type { Messages } from "@/lib/i18n/messages";

type StageField = "atkStage" | "defStage" | "spaStage" | "spdStage";
const STAGE_FIELD_BY_ATTACK_STAT: Record<DamageResult["attackStatKey"], StageField> = {
  atk: "atkStage",
  spa: "spaStage",
  // Body Press attacks with Defense.
  def: "defStage",
};
const STAGE_FIELD_BY_DEFENSE_STAT: Record<DamageResult["defenseStatKey"], StageField> = {
  def: "defStage",
  spd: "spdStage",
};

/** e.g. "19 Atk" at stage 0, "+6 19 Atk" at +6 — mirrors the reference calculator's convention of prefixing a boosted/lowered stat with its stage. */
function formatStatToken(sp: number, stage: number, label: string): string {
  const stagePrefix = stage !== 0 ? `${stage > 0 ? "+" : ""}${stage} ` : "";
  return `${stagePrefix}${sp} ${label}`;
}

/**
 * Damage-reducing conditions on the defender's side that actually apply to
 * THIS move — Reflect/Light Screen only match their own category (mirrors
 * screenMultiplier's own category check in calculateDamage.ts), Aurora Veil
 * and Friend Guard apply regardless of category. Order matches the engine's
 * own precedence (Aurora Veil supersedes the other two screens).
 */
function activeDamageReducers(
  options: DamageCalcOptions | undefined,
  category: "Physical" | "Special",
): string[] {
  const reducers: string[] = [];
  if (options?.defenderScreens?.auroraVeil) {
    reducers.push("Aurora Veil");
  } else if (options?.defenderScreens?.reflect && category === "Physical") {
    reducers.push("Reflect");
  } else if (options?.defenderScreens?.lightScreen && category === "Special") {
    reducers.push("Light Screen");
  }
  if (options?.defenderFriendGuard) reducers.push("Friend Guard");
  return reducers;
}

/**
 * Mirrors the reference calculator's result-line convention: prefix the
 * attacker with the Stat Points behind whichever stat this move actually
 * used (Atk/SpA), and the defender with its HP and defensive-stat Stat
 * Points — e.g. "32 Atk Mega Staraptor Dual Wingbeat (2 hits) vs. 2 HP / 0
 * Def Whimsicott". Reads result.attackStatKey/defenseStatKey rather than
 * re-deriving the move's category, so this always matches what the engine
 * actually computed with. Also folds in each side's stat stage (e.g. "+6")
 * when non-zero, plus any damage-modifying conditions that were actually in
 * effect for this calculation — "Helping Hand" ahead of the move name when
 * the attacker had it, and " through Reflect"/"Light Screen"/"Aurora
 * Veil"/"Friend Guard" (joined with "and" when more than one applies) after
 * the defender's species when a damage reducer was active, preceded by "in
 * Sun"/"in Electric Terrain" when the Field's weather/terrain changed the result — so the text
 * always reflects everything that went into the number, not just the SP and
 * stage figures. Each side's held item (when present) is prefixed directly
 * onto its species name — e.g. "Choice Specs Charizard" / "Occa Berry
 * Sinistcha" — the standard Showdown-calc convention, and the only way a
 * damage-affecting item (a resist Berry, Choice item, etc.) is visible in
 * the result text itself rather than only in the picker above it. An ability
 * that changed the result goes between the item and the species, "burned"
 * right before the attacker when its burn halved the hit, and "Fairy Aura
 * boosted" before the move when the aura applied — Showdown's wording. " (spread)"
 * appears after the hits label when the move is a spread move AND the
 * attacker's side actually has Spread Target toggled on — the ×0.75
 * reduction only applies in that combination, so the label only claims it
 * when it's true.
 */
function formatCalculationLabel(
  attacker: ParsedPokemon,
  defender: ParsedPokemon,
  moveName: string,
  result: DamageResult,
  attackerBattleState: PokemonBattleState,
  defenderBattleState: PokemonBattleState,
  options: DamageCalcOptions | undefined,
): string {
  const attackerSp = calculateStatBreakdown(attacker)?.statPoints[result.attackStatKey] ?? 0;
  const defenderBreakdown = calculateStatBreakdown(defender);
  const defenderHpSp = defenderBreakdown?.statPoints.hp ?? 0;
  const defenderDefSp = defenderBreakdown?.statPoints[result.defenseStatKey] ?? 0;
  const hitsLabel = result.hitCount > 1 ? ` (${result.hitCount} hits)` : "";
  const spreadLabel = result.isSpreadMove && options?.attackerHitsMultipleTargets ? " (spread)" : "";

  const attackerStage = attackerBattleState[STAGE_FIELD_BY_ATTACK_STAT[result.attackStatKey]];
  const defenderStage = defenderBattleState[STAGE_FIELD_BY_DEFENSE_STAT[result.defenseStatKey]];
  const attackToken = formatStatToken(attackerSp, attackerStage, STAT_LABELS[result.attackStatKey]);
  const defenseToken = formatStatToken(defenderDefSp, defenderStage, STAT_LABELS[result.defenseStatKey]);

  const helpingHandLabel = options?.attackerHelpingHand ? "Helping Hand " : "";
  const category = result.attackStatKey === "spa" ? "Special" : "Physical";
  const reducers = activeDamageReducers(options, category);
  // A result under Protect that wasn't blocked went through it (Unseen Fist / Piercing Drill).
  if (options?.defenderProtected && result.koChanceText !== "blocked by Protect") {
    reducers.push("Protect");
  }
  const throughLabel = reducers.length > 0 ? ` through ${reducers.join(" and ")}` : "";
  // Showdown's wording: "in Sun", "in Electric Terrain", "in Sun and Electric Terrain".
  const fieldParts = [
    result.weatherApplied && options?.weather,
    result.terrainApplied && options?.terrain && `${options.terrain} Terrain`,
  ].filter(Boolean);
  const fieldLabel = fieldParts.length > 0 ? ` in ${fieldParts.join(" and ")}` : "";
  // Showdown's order: item, ability (when it changed the result), "burned",
  // then the name. A Mega Stone shows as the form ("Mega Staraptor"), not as an item.
  const describe = (mon: ParsedPokemon, abilityApplied: boolean | undefined, burned: boolean) => {
    const mega = megaDisplayName(mon.species, mon.item);
    const ability = abilityApplied ? resolveEffectiveAbility(mon.species, mon.item, mon.ability) : undefined;
    return [mega ? undefined : mon.item, ability, burned ? "burned" : undefined, mega ?? mon.species]
      .filter(Boolean)
      .join(" ");
  };
  const fairyAuraLabel = result.fairyAuraApplied ? "Fairy Aura boosted " : "";

  return `${attackToken} ${describe(attacker, result.attackerAbilityApplied, !!result.burnApplied)} ${helpingHandLabel}${fairyAuraLabel}${moveName}${hitsLabel}${spreadLabel} vs. ${defenderHpSp} HP / ${defenseToken} ${describe(defender, result.defenderAbilityApplied, false)}${fieldLabel}${throughLabel}`;
}

const DEFAULT_STAT_OVERRIDES: StatOverrides = {};

const subscribeNever = () => () => {};

/** What a side falls back to so it's never empty: the regulation's first species, as a blank set. */
function defaultSidebarEntry(): SidebarEntry {
  return { pokemon: buildCustomPokemon(DEFAULT_SPECIES_KEY), isCustom: true };
}

interface ToggleButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}

/** Shared pill-toggle style for every Field control (Weather/Terrain options, Critical Hit/Fairy Aura/Gravity, and each side's conditions) — one visual language for "this is currently on/selected" across the whole panel. */
function ToggleButton({ label, active, onClick, className = "" }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-zinc-600 bg-zinc-600 dark:bg-zinc-400 text-white"
          : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
      } ${className}`}
    >
      {label}
    </button>
  );
}

interface SegmentedToggleProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

/** A single connected pill split into mutually-exclusive segments (only one can be active) — visually distinct from ToggleButton's separate-pill rows, matching the reference calculator's "Singles / Doubles" control. Used for the battle format toggle; a generic 2+ option component rather than hardcoding two buttons since the shared border between segments needs each button to know its position in the row. */
function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  labelFor = (option) => option,
}: SegmentedToggleProps<T> & { labelFor?: (option: T) => string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-zinc-300">
      {options.map((option, index) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`px-4 py-1 text-xs font-medium transition-colors ${
            value === option
              ? "bg-zinc-600 dark:bg-zinc-400 text-white"
              : "text-zinc-700 hover:bg-zinc-100"
          } ${index > 0 ? "border-l border-zinc-300" : ""}`}
        >
          {labelFor(option)}
        </button>
      ))}
    </div>
  );
}

// No "None" option: clicking the active weather/terrain again clears it.
const WEATHER_OPTIONS: Array<NonNullable<DamageCalcOptions["weather"]>> = ["Sun", "Rain", "Sand", "Snow"];
const TERRAIN_OPTIONS: Array<NonNullable<DamageCalcOptions["terrain"]>> = [
  "Electric",
  "Grassy",
  "Psychic",
  "Misty",
];

/**
 * Conditions that belong to one Pokémon's side rather than the field as a
 * whole — mirrors the reference calculator's two-column "Pokémon 1 side /
 * Pokémon 2 side" Field layout. Kept per-side (not a single flat toggle set)
 * because each one only matters for whichever direction that Pokémon is
 * actually attacking or defending in — see optionsFor below.
 */
interface SideConditions {
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
  helpingHand: boolean;
  friendGuard: boolean;
  protect: boolean;
  tailwind: boolean;
}

const DEFAULT_SIDE_CONDITIONS: SideConditions = {
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
  helpingHand: false,
  friendGuard: false,
  protect: false,
  tailwind: false,
};

function toEffectivePokemon(
  pokemon: ParsedPokemon | null | undefined,
  mega: boolean,
  statOverrides: StatOverrides,
): ParsedPokemon | undefined {
  if (!pokemon) return undefined;
  const megaApplied = mega ? pokemon : { ...pokemon, item: undefined };
  return applyStatOverrides(megaApplied, statOverrides);
}

/** A Pokémon with a weather-setting ability (Drought, Drizzle, Sand Stream, Snow Warning) auto-sets the Field's weather when selected — doesn't clear it when switching to a Pokémon without one, only sets it forward. */
function resolveAutoWeather(
  pokemon: ParsedPokemon | null | undefined,
  mega: boolean,
): DamageCalcOptions["weather"] | undefined {
  if (!pokemon) return undefined;
  const item = mega ? pokemon.item : undefined;
  const ability = resolveEffectiveAbility(pokemon.species, item, pokemon.ability);
  return ability ? WEATHER_SETTING_ABILITIES[ability] : undefined;
}

/**
 * The two Pokémon are the focus: the middle column (result, field) is
 * narrower than the sides. Shared by both rows so their columns line up.
 * Below `xl` the field moves into a drawer: the two Pokémon sit side by side
 * on `lg` (the result spanning the row above them), stacked below that.
 */
const THREE_COLUMNS = "lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)]";

interface DamageCalculatorProps {
  /** The page's useMyTeams() — shared with its header (see the page). */
  myTeams: ReturnType<typeof useMyTeams>;
}

export function DamageCalculator({ myTeams }: DamageCalculatorProps) {
  const t = useMessages();
  const text = usePokemonText();
  const { teams, activeTeamId, isLoading, updateTeam } = myTeams;
  // Team/opponent selection from a saved roster is otherwise omitted (see
  // PLANNING.md) — the header's active team seeds the Attacker's sidebar on
  // first load, and a specific opponent seeds the Defender's when opened via
  // an OpponentCard's "Open in Damage Calculator" link (?opponentId=...,
  // below) — both are one-time seeds, not an ongoing team-selection UI.
  const activeTeam = activeTeamId ? teams.find((t) => t.id === activeTeamId) : undefined;
  const { opponents } = useOpponents();
  const calcSets = useCalcSets();
  const searchParams = useSearchParams();
  const opponentId = searchParams.get("opponentId");
  // ?groupId= points at a prep group's shared list instead of your own.
  const groupId = searchParams.get("groupId");
  const { groups } = useGroups();
  const urlGroup = groupId ? (groups.find((g) => g.id === groupId) ?? null) : null;
  const { opponents: groupOpponents } = useGroupOpponents(urlGroup);
  const opponentFromUrl = opponentId
    ? (groupId ? groupOpponents : opponents).find((o) => o.id === opponentId)
    : undefined;

  // Each side's working roster (sidebar) — up to MAX_SIDEBAR_POKEMON,
  // editable via the species search (adds a custom entry) or the sidebar's
  // own remove button. The Attacker seeds from the header's active team (see
  // the render-time default below); the Defender starts with a single
  // default species so there's always something to calculate with.
  // Neither side is ever empty: both start on the default species. The
  // Attacker's starting array is kept so the team seed below can tell it
  // hasn't been touched yet (same array reference).
  const [initialAttackerSidebar] = useState<SidebarEntry[]>(() => [defaultSidebarEntry()]);
  const [attackerSidebar, setAttackerSidebar] = useState<SidebarEntry[]>(initialAttackerSidebar);
  const [attackerSelectedIndex, setAttackerSelectedIndex] = useState<number | null>(0);
  const [attackerMega, setAttackerMega] = useState(true);

  const [defenderSidebar, setDefenderSidebar] = useState<SidebarEntry[]>(() => [
    defaultSidebarEntry(),
  ]);
  const [defenderSelectedIndex, setDefenderSelectedIndex] = useState<number | null>(0);
  const [defenderMega, setDefenderMega] = useState(true);

  const attackerPokemon =
    attackerSelectedIndex !== null ? (attackerSidebar[attackerSelectedIndex]?.pokemon ?? null) : null;
  const defenderPokemon =
    defenderSelectedIndex !== null ? (defenderSidebar[defenderSelectedIndex]?.pokemon ?? null) : null;

  const [selectedMove, setSelectedMove] = useState<{
    side: "attacker" | "defender";
    move: string;
  } | null>(null);

  // Global, not per-side — replaces the old per-side "Spread Target" toggles
  // per explicit request ("a single double buttom if one is enable the other
  // can't"). Defaults to Doubles (this app's whole context is VGC), so a
  // spread move's ×0.75 reduction applies out of the box rather than needing
  // to be turned on for every calc.
  const [battleFormat, setBattleFormat] = useState<"Singles" | "Doubles">("Doubles");
  const [weather, setWeather] = useState<DamageCalcOptions["weather"]>(undefined);
  const [terrain, setTerrain] = useState<DamageCalcOptions["terrain"]>(undefined);
  const [fairyAura, setFairyAura] = useState(false);
  const [gravity, setGravity] = useState(false);
  const [isFieldOpen, setIsFieldOpen] = useState(false);
  // Below lg the two sides are tabs: only the open side's moves and panel show.
  const [openSide, setOpenSide] = useState<"attacker" | "defender">("attacker");
  // Below lg, whose moves are listed — follows the side tabs, but the move
  // list's own switch changes it alone, so you can check the other side's
  // moves without leaving the Pokémon you're editing.
  const [movesSide, setMovesSide] = useState<"attacker" | "defender">("attacker");

  // Seeds the Attacker's sidebar with the header's active team, the first
  // time activeTeamId becomes available (it loads asynchronously from
  // IndexedDB) — adjusted directly during render, React's own recommended
  // pattern for "sync state once when a value changes" (see "Adjusting some
  // state when a prop changes" in the React docs), rather than an effect.
  // Guarded by attackerDefaultedFor so this never fires again once it has,
  // meaning a later explicit change is never overridden by it — it only
  // replaces the untouched starting default. With no active team, the
  // Attacker keeps that default species, like the Defender.
  const [attackerDefaultedFor, setAttackerDefaultedFor] = useState<string | null>(null);
  if (activeTeamId !== attackerDefaultedFor) {
    setAttackerDefaultedFor(activeTeamId);
    const isUntouched = attackerSidebar === initialAttackerSidebar;
    if (isUntouched && activeTeam && activeTeam.pokemon.length > 0) {
      const seeded = activeTeam.pokemon.map((pokemon) => ({ pokemon, isCustom: false }));
      setAttackerSidebar(seeded);
      setAttackerSelectedIndex(0);
      const autoWeather = resolveAutoWeather(seeded[0]?.pokemon, attackerMega);
      if (autoWeather) setWeather(autoWeather);
    }
  }

  // Same render-time-adjust pattern as the Attacker's seed above, but keyed
  // on the ?opponentId= URL param instead of the header's active team, and
  // gated on the opponent actually being found rather than the sidebar
  // being empty — opponents load asynchronously from IndexedDB, so
  // `opponentFromUrl` may still be undefined for the first few renders even
  // though `opponentId` is already present; only firing once it resolves
  // means this doesn't race the load and doesn't need its own loading state.
  // Once applied for a given opponentId, later manual edits to the
  // Defender's sidebar are never overridden.
  const [defenderDefaultedForOpponentId, setDefenderDefaultedForOpponentId] = useState<
    string | null
  >(null);
  if (opponentId && opponentId !== defenderDefaultedForOpponentId && opponentFromUrl) {
    setDefenderDefaultedForOpponentId(opponentId);
    const seeded = ensureSidebarSelection(
      opponentFromUrl.team.pokemon.map((pokemon): SidebarEntry => ({ pokemon, isCustom: false })),
      0,
      defaultSidebarEntry,
    );
    setDefenderSidebar(seeded.sidebar);
    setDefenderSelectedIndex(seeded.selectedIndex);
  }

  const [attackerSide, setAttackerSide] = useState<SideConditions>(DEFAULT_SIDE_CONDITIONS);
  const [defenderSide, setDefenderSide] = useState<SideConditions>(DEFAULT_SIDE_CONDITIONS);
  const toggleAttackerSide = (key: keyof SideConditions) =>
    setAttackerSide((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleDefenderSide = (key: keyof SideConditions) =>
    setDefenderSide((prev) => ({ ...prev, [key]: !prev[key] }));

  // Status, stat stages, and current HP belong to the individual Pokémon
  // (not the side) — reset whenever the selected Pokémon changes, same as
  // switching to a different mon clears any Swords Dance boosts it had.
  const [attackerBattleState, setAttackerBattleState] =
    useState<PokemonBattleState>(DEFAULT_BATTLE_STATE);
  const [defenderBattleState, setDefenderBattleState] =
    useState<PokemonBattleState>(DEFAULT_BATTLE_STATE);

  // Edited Stat Points/nature — theorycrafting overrides on top of the
  // pasted build, never written back to the saved team. Reset alongside
  // battle state whenever the selected Pokémon changes, but NOT on a Mega
  // toggle (still the same build, just a different form).
  const [attackerStatOverrides, setAttackerStatOverrides] =
    useState<StatOverrides>(DEFAULT_STAT_OVERRIDES);
  const [defenderStatOverrides, setDefenderStatOverrides] =
    useState<StatOverrides>(DEFAULT_STAT_OVERRIDES);

  // Restores the Defender's saved work in progress (see defenderDraftStore)
  // once, on the first client render — localStorage isn't readable on the
  // server, so the server snapshot is `undefined` ("not known yet") and the
  // restore waits for the client one. Skipped when ?opponentId= is set,
  // since that link asks for a specific opponent instead.
  const savedDefenderDraft = useSyncExternalStore(subscribeNever, readDefenderDraft, () => undefined);
  const [isDefenderDraftChecked, setIsDefenderDraftChecked] = useState(false);
  if (!isDefenderDraftChecked && savedDefenderDraft !== undefined) {
    setIsDefenderDraftChecked(true);
    if (savedDefenderDraft && !opponentId) {
      const restored = ensureSidebarSelection(
        savedDefenderDraft.sidebar,
        savedDefenderDraft.selectedIndex,
        defaultSidebarEntry,
      );
      setDefenderSidebar(restored.sidebar);
      setDefenderSelectedIndex(restored.selectedIndex);
      setDefenderMega(savedDefenderDraft.mega);
      setDefenderStatOverrides(savedDefenderDraft.statOverrides);
    }
  }

  // …and saves it on every change once that check has run (writing before it
  // would overwrite the saved draft with the default one).
  useEffect(() => {
    if (!isDefenderDraftChecked) return;
    writeDefenderDraft({
      sidebar: defenderSidebar,
      selectedIndex: defenderSelectedIndex,
      mega: defenderMega,
      statOverrides: defenderStatOverrides,
    });
  }, [isDefenderDraftChecked, defenderSidebar, defenderSelectedIndex, defenderMega, defenderStatOverrides]);

  const effectiveAttacker = toEffectivePokemon(attackerPokemon, attackerMega, attackerStatOverrides);
  const effectiveDefender = toEffectivePokemon(defenderPokemon, defenderMega, defenderStatOverrides);

  // Builds the options for whichever side is attacking in this direction —
  // burn/status/stat stages/Helping Hand belong to the attacking side,
  // screens/Friend Guard/Protect/current HP belong to the defending side, so
  // which SideConditions/PokemonBattleState object plays which role flips
  // between the two directions below.
  function optionsFor(
    attackingSide: SideConditions,
    defendingSide: SideConditions,
    attackingBattleState: PokemonBattleState,
    defendingBattleState: PokemonBattleState,
  ): DamageCalcOptions {
    return {
      weather,
      terrain,
      fairyAura,
      gravity,
      attackerBurned: attackingBattleState.status === "Burned",
      attackerStatused: attackingBattleState.status !== "Healthy",
      defenderStatused: defendingBattleState.status !== "Healthy",
      attackerHelpingHand: attackingSide.helpingHand,
      attackerHitsMultipleTargets: battleFormat === "Doubles",
      isDoublesFormat: battleFormat === "Doubles",
      defenderFriendGuard: defendingSide.friendGuard,
      defenderProtected: defendingSide.protect,
      defenderScreens: {
        reflect: defendingSide.reflect,
        lightScreen: defendingSide.lightScreen,
        auroraVeil: defendingSide.auroraVeil,
      },
      attackerStages: {
        atk: attackingBattleState.atkStage,
        def: attackingBattleState.defStage,
        spa: attackingBattleState.spaStage,
        spd: attackingBattleState.spdStage,
        spe: attackingBattleState.speStage,
      },
      defenderStages: {
        atk: defendingBattleState.atkStage,
        def: defendingBattleState.defStage,
        spa: defendingBattleState.spaStage,
        spd: defendingBattleState.spdStage,
        spe: defendingBattleState.speStage,
      },
      defenderCurrentHpPercent: defendingBattleState.currentHpPercent,
      attackerCurrentHpPercent: attackingBattleState.currentHpPercent,
    };
  }

  // What's set on the move's own row: Crit, its Effect count (Last Respects,
  // Rage Fist) or how many hits land.
  function forMove(
    options: DamageCalcOptions,
    battleState: PokemonBattleState,
    move: string,
  ): DamageCalcOptions {
    const count = battleState.moveCounts[move];
    const effect = EFFECT_MOVES[move];
    return {
      ...options,
      ...(battleState.critMoves.includes(move) && { isCritical: true }),
      ...(count !== undefined && (effect ? { [effect.option]: count } : { hits: count })),
    };
  }

  // Both sides' movesets are computed simultaneously (attacker's moves vs.
  // defender, and defender's moves vs. attacker) so each row can show its own
  // damage range up front, rather than requiring a move to be selected first.
  const attackerMoveOptions = optionsFor(
    attackerSide,
    defenderSide,
    attackerBattleState,
    defenderBattleState,
  );
  const defenderMoveOptions = optionsFor(
    defenderSide,
    attackerSide,
    defenderBattleState,
    attackerBattleState,
  );

  const attackerMoveResults =
    effectiveAttacker && effectiveDefender
      ? (attackerPokemon?.moves ?? [])
          // Empty slots stay so moves keep their place (PokemonEditor's setMoveSlot).
          .filter((move) => move)
          .map((move) => ({
          move,
          result: calculateDamage(
            effectiveAttacker,
            effectiveDefender,
            move,
            forMove(attackerMoveOptions, attackerBattleState, move),
          ),
        }))
      : [];
  const defenderMoveResults =
    effectiveAttacker && effectiveDefender
      ? (defenderPokemon?.moves ?? [])
          // Empty slots stay so moves keep their place (PokemonEditor's setMoveSlot).
          .filter((move) => move)
          .map((move) => ({
          move,
          result: calculateDamage(
            effectiveDefender,
            effectiveAttacker,
            move,
            forMove(defenderMoveOptions, defenderBattleState, move),
          ),
        }))
      : [];

  const selectedResult =
    selectedMove && effectiveAttacker && effectiveDefender
      ? selectedMove.side === "attacker"
        ? attackerMoveResults.find((m) => m.move === selectedMove.move)?.result
        : defenderMoveResults.find((m) => m.move === selectedMove.move)?.result
      : null;
  const selectedAttackerMon = selectedMove?.side === "attacker" ? effectiveAttacker : effectiveDefender;
  const selectedDefenderMon = selectedMove?.side === "attacker" ? effectiveDefender : effectiveAttacker;
  const selectedAttackingBattleState =
    selectedMove?.side === "attacker" ? attackerBattleState : defenderBattleState;
  const selectedDefendingBattleState =
    selectedMove?.side === "attacker" ? defenderBattleState : attackerBattleState;
  const selectedOptions = selectedMove
    ? forMove(
        selectedMove.side === "attacker" ? attackerMoveOptions : defenderMoveOptions,
        selectedAttackingBattleState,
        selectedMove.move,
      )
    : undefined;

  // Selecting an existing sidebar tile just switches which entry is shown —
  // battle state/stat overrides reset the same way switching Pokémon always
  // has (clears any stage boosts the previous one had).
  function attackerSelectIndex(index: number) {
    setAttackerSelectedIndex(index);
    setSelectedMove(null);
    setAttackerBattleState(DEFAULT_BATTLE_STATE);
    setAttackerStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(attackerSidebar[index]?.pokemon, attackerMega);
    if (autoWeather) setWeather(autoWeather);
  }

  // Adds a species from the sidebar's own "+" tile — appends a new custom
  // entry while under MAX_SIDEBAR_POKEMON, otherwise replaces whichever
  // entry is currently selected (or the first one, if none is) so the cap
  // is never exceeded.
  function attackerAddPokemon(newPokemon: ParsedPokemon, fromSet?: SavedSetRef) {
    const newEntry: SidebarEntry = { pokemon: newPokemon, isCustom: true, fromSet };
    const newIndex =
      attackerSidebar.length < MAX_SIDEBAR_POKEMON
        ? attackerSidebar.length
        : (attackerSelectedIndex ?? 0);
    setAttackerSidebar(
      attackerSidebar.length < MAX_SIDEBAR_POKEMON
        ? [...attackerSidebar, newEntry]
        : attackerSidebar.map((entry, i) => (i === newIndex ? newEntry : entry)),
    );
    setAttackerSelectedIndex(newIndex);
    setSelectedMove(null);
    setAttackerBattleState(DEFAULT_BATTLE_STATE);
    setAttackerStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(newPokemon, attackerMega);
    if (autoWeather) setWeather(autoWeather);
  }

  // The main species search's onSelect target once a Pokémon is already
  // selected — the search input now shows that Pokémon's own species as its
  // value, so picking a new one there reads as "change this Pokémon," not
  // "add another": swaps the species in place at the same sidebar index
  // rather than appending or touching any other slot.
  function attackerReplacePokemon(newPokemon: ParsedPokemon, fromSet?: SavedSetRef) {
    if (attackerSelectedIndex === null) {
      attackerAddPokemon(newPokemon, fromSet);
      return;
    }
    const newEntry: SidebarEntry = { pokemon: newPokemon, isCustom: true, fromSet };
    setAttackerSidebar(
      attackerSidebar.map((entry, i) => (i === attackerSelectedIndex ? newEntry : entry)),
    );
    setSelectedMove(null);
    setAttackerBattleState(DEFAULT_BATTLE_STATE);
    setAttackerStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(newPokemon, attackerMega);
    if (autoWeather) setWeather(autoWeather);
  }

  // The "Save" icon's action — appends a copy of whatever's currently shown
  // (species, ability, item, nature, Stat Points, moves) as a new sidebar
  // entry and selects it. Since the old "+" tile is gone, this (plus
  // Import/Load Team) is now the only way to grow the roster: pick/tweak a
  // Pokémon via the search + ability/item/moves fields, Save to lock it in,
  // then keep editing the freshly-selected copy into the next one.
  function attackerSaveCurrentToSidebar() {
    if (!attackerPokemon || attackerSidebar.length >= MAX_SIDEBAR_POKEMON) return;
    const newEntry: SidebarEntry = { pokemon: { ...attackerPokemon }, isCustom: true };
    const newIndex = attackerSidebar.length;
    setAttackerSidebar([...attackerSidebar, newEntry]);
    setAttackerSelectedIndex(newIndex);
    setSelectedMove(null);
    setAttackerBattleState(DEFAULT_BATTLE_STATE);
    setAttackerStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(attackerPokemon, attackerMega);
    if (autoWeather) setWeather(autoWeather);
  }

  // Importing a full team paste (more than one Pokémon) replaces this side's
  // whole sidebar rather than appending, since a multi-mon paste means "this
  // is my team," not "add one more" — see RosterPokemonPicker's onImportTeam
  // doc comment.
  function attackerImportTeam(pokemonList: ParsedPokemon[]) {
    const { sidebar: newSidebar, selectedIndex } = ensureSidebarSelection(
      pokemonList.map((pokemon): SidebarEntry => ({ pokemon, isCustom: true })),
      0,
      defaultSidebarEntry,
    );
    setAttackerSidebar(newSidebar);
    setAttackerSelectedIndex(selectedIndex);
    setSelectedMove(null);
    setAttackerBattleState(DEFAULT_BATTLE_STATE);
    setAttackerStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(newSidebar[0]?.pokemon, attackerMega);
    if (autoWeather) setWeather(autoWeather);
  }

  function attackerRemovePokemon(index: number) {
    const next = removeSidebarEntry(attackerSidebar, attackerSelectedIndex, index, defaultSidebarEntry);
    setAttackerSidebar(next.sidebar);
    setAttackerSelectedIndex(next.selectedIndex);
    if (next.selectionChanged) {
      setSelectedMove(null);
      setAttackerBattleState(DEFAULT_BATTLE_STATE);
      setAttackerStatOverrides(DEFAULT_STAT_OVERRIDES);
      const autoWeather = resolveAutoWeather(next.sidebar[next.selectedIndex]?.pokemon, attackerMega);
      if (autoWeather) setWeather(autoWeather);
    }
  }

  function attackerAbilityChange(ability: string) {
    if (attackerSelectedIndex === null) return;
    setAttackerSidebar(
      attackerSidebar.map((entry, i) =>
        i === attackerSelectedIndex ? { ...entry, pokemon: { ...entry.pokemon, ability } } : entry,
      ),
    );
  }

  function attackerItemChange(item: string | undefined) {
    if (attackerSelectedIndex === null) return;
    setAttackerSidebar(
      attackerSidebar.map((entry, i) =>
        i === attackerSelectedIndex ? { ...entry, pokemon: { ...entry.pokemon, item } } : entry,
      ),
    );
    const autoWeather = resolveAutoWeather(
      attackerPokemon ? { ...attackerPokemon, item } : undefined,
      attackerMega,
    );
    if (autoWeather) setWeather(autoWeather);
  }

  function attackerMovesChange(moves: string[]) {
    if (attackerSelectedIndex === null) return;
    setAttackerSidebar(
      attackerSidebar.map((entry, i) =>
        i === attackerSelectedIndex ? { ...entry, pokemon: { ...entry.pokemon, moves } } : entry,
      ),
    );
  }

  function defenderSelectIndex(index: number) {
    setDefenderSelectedIndex(index);
    setSelectedMove(null);
    setDefenderBattleState(DEFAULT_BATTLE_STATE);
    setDefenderStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(defenderSidebar[index]?.pokemon, defenderMega);
    if (autoWeather) setWeather(autoWeather);
  }

  function defenderAddPokemon(newPokemon: ParsedPokemon, fromSet?: SavedSetRef) {
    const newEntry: SidebarEntry = { pokemon: newPokemon, isCustom: true, fromSet };
    const newIndex =
      defenderSidebar.length < MAX_SIDEBAR_POKEMON
        ? defenderSidebar.length
        : (defenderSelectedIndex ?? 0);
    setDefenderSidebar(
      defenderSidebar.length < MAX_SIDEBAR_POKEMON
        ? [...defenderSidebar, newEntry]
        : defenderSidebar.map((entry, i) => (i === newIndex ? newEntry : entry)),
    );
    setDefenderSelectedIndex(newIndex);
    setSelectedMove(null);
    setDefenderBattleState(DEFAULT_BATTLE_STATE);
    setDefenderStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(newPokemon, defenderMega);
    if (autoWeather) setWeather(autoWeather);
  }

  function defenderReplacePokemon(newPokemon: ParsedPokemon, fromSet?: SavedSetRef) {
    if (defenderSelectedIndex === null) {
      defenderAddPokemon(newPokemon, fromSet);
      return;
    }
    const newEntry: SidebarEntry = { pokemon: newPokemon, isCustom: true, fromSet };
    setDefenderSidebar(
      defenderSidebar.map((entry, i) => (i === defenderSelectedIndex ? newEntry : entry)),
    );
    setSelectedMove(null);
    setDefenderBattleState(DEFAULT_BATTLE_STATE);
    setDefenderStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(newPokemon, defenderMega);
    if (autoWeather) setWeather(autoWeather);
  }

  function linkSelectedEntry(
    setSidebar: (update: (sidebar: SidebarEntry[]) => SidebarEntry[]) => void,
    selectedIndex: number | null,
    fromSet: SavedSetRef,
  ) {
    if (selectedIndex === null) return;
    setSidebar((sidebar) =>
      sidebar.map((entry, i) => (i === selectedIndex ? { ...entry, fromSet } : entry)),
    );
  }

  function defenderSaveCurrentToSidebar() {
    if (!defenderPokemon || defenderSidebar.length >= MAX_SIDEBAR_POKEMON) return;
    const newEntry: SidebarEntry = { pokemon: { ...defenderPokemon }, isCustom: true };
    const newIndex = defenderSidebar.length;
    setDefenderSidebar([...defenderSidebar, newEntry]);
    setDefenderSelectedIndex(newIndex);
    setSelectedMove(null);
    setDefenderBattleState(DEFAULT_BATTLE_STATE);
    setDefenderStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(defenderPokemon, defenderMega);
    if (autoWeather) setWeather(autoWeather);
  }

  function defenderImportTeam(pokemonList: ParsedPokemon[]) {
    const { sidebar: newSidebar, selectedIndex } = ensureSidebarSelection(
      pokemonList.map((pokemon): SidebarEntry => ({ pokemon, isCustom: true })),
      0,
      defaultSidebarEntry,
    );
    setDefenderSidebar(newSidebar);
    setDefenderSelectedIndex(selectedIndex);
    setSelectedMove(null);
    setDefenderBattleState(DEFAULT_BATTLE_STATE);
    setDefenderStatOverrides(DEFAULT_STAT_OVERRIDES);
    const autoWeather = resolveAutoWeather(newSidebar[0]?.pokemon, defenderMega);
    if (autoWeather) setWeather(autoWeather);
  }

  function defenderRemovePokemon(index: number) {
    const next = removeSidebarEntry(defenderSidebar, defenderSelectedIndex, index, defaultSidebarEntry);
    setDefenderSidebar(next.sidebar);
    setDefenderSelectedIndex(next.selectedIndex);
    if (next.selectionChanged) {
      setSelectedMove(null);
      setDefenderBattleState(DEFAULT_BATTLE_STATE);
      setDefenderStatOverrides(DEFAULT_STAT_OVERRIDES);
      const autoWeather = resolveAutoWeather(next.sidebar[next.selectedIndex]?.pokemon, defenderMega);
      if (autoWeather) setWeather(autoWeather);
    }
  }

  function defenderAbilityChange(ability: string) {
    if (defenderSelectedIndex === null) return;
    setDefenderSidebar(
      defenderSidebar.map((entry, i) =>
        i === defenderSelectedIndex ? { ...entry, pokemon: { ...entry.pokemon, ability } } : entry,
      ),
    );
  }

  function defenderItemChange(item: string | undefined) {
    if (defenderSelectedIndex === null) return;
    setDefenderSidebar(
      defenderSidebar.map((entry, i) =>
        i === defenderSelectedIndex ? { ...entry, pokemon: { ...entry.pokemon, item } } : entry,
      ),
    );
    const autoWeather = resolveAutoWeather(
      defenderPokemon ? { ...defenderPokemon, item } : undefined,
      defenderMega,
    );
    if (autoWeather) setWeather(autoWeather);
  }

  function defenderMovesChange(moves: string[]) {
    if (defenderSelectedIndex === null) return;
    setDefenderSidebar(
      defenderSidebar.map((entry, i) =>
        i === defenderSelectedIndex ? { ...entry, pokemon: { ...entry.pokemon, moves } } : entry,
      ),
    );
  }

  if (isLoading) {
    return <p className="text-sm text-zinc-500">{t.common.loading}</p>;
  }

  const fieldControls = (
    <>
      <div className="flex justify-center">
        <SegmentedToggle
          options={["Singles", "Doubles"] as const}
          value={battleFormat}
          onChange={setBattleFormat}
          labelFor={(option) => (option === "Singles" ? t.calc.singles : t.calc.doubles)}
        />
      </div>

      <div role="group" aria-label={t.calc.weather} className="flex flex-wrap justify-center gap-2">
        {WEATHER_OPTIONS.map((option) => (
          <ToggleButton
            key={option}
            label={t.calc.weathers[option]}
            active={weather === option}
            onClick={() => setWeather(weather === option ? undefined : option)}
          />
        ))}
      </div>

      <div role="group" aria-label={t.calc.terrain} className="flex flex-wrap justify-center gap-2">
        {TERRAIN_OPTIONS.map((option) => (
          <ToggleButton
            key={option}
            label={t.calc.terrains[option]}
            active={terrain === option}
            onClick={() => setTerrain(terrain === option ? undefined : option)}
          />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <ToggleButton
          label={text.ability("Fairy Aura")}
          active={fairyAura}
          onClick={() => setFairyAura((v) => !v)}
        />
        <ToggleButton label={text.move("Gravity")} active={gravity} onClick={() => setGravity((v) => !v)} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-3">
        <SideConditionsPanel
          title={t.calc.sideOf(attackerPokemon ? text.species(attackerPokemon.species) : t.calc.attacker)}
          conditions={attackerSide}
          onToggle={toggleAttackerSide}
        />
        <SideConditionsPanel
          title={t.calc.sideOf(defenderPokemon ? text.species(defenderPokemon.species) : t.calc.defender)}
          conditions={defenderSide}
          onToggle={toggleDefenderSide}
        />
      </div>
    </>
  );

  // What's set, for the narrow-screen Field setup button: each side's own
  // conditions on its side (attacker left, defender right), what applies to
  // both — weather, terrain, Gravity, Fairy Aura — in the middle.
  function sideChips(side: SideConditions): string[] {
    const labels: Array<[keyof SideConditions, string]> = [
      ["protect", text.move("Protect")],
      ["helpingHand", text.move("Helping Hand")],
      ["auroraVeil", text.move("Aurora Veil")],
      ["reflect", text.move("Reflect")],
      ["lightScreen", text.move("Light Screen")],
      ["tailwind", text.move("Tailwind")],
      ["friendGuard", text.ability("Friend Guard")],
    ];
    return labels.filter(([key]) => side[key]).map(([, label]) => label);
  }
  const fieldColumns = [
    { key: "attacker", align: "justify-start", chips: sideChips(attackerSide) },
    {
      key: "both",
      align: "justify-center",
      chips: [
        weather && t.calc.weathers[weather],
        // "Psychic Terrain" rather than "Psychic", which could read as the type.
        terrain && text.move(`${terrain} Terrain`),
        gravity && text.move("Gravity"),
        fairyAura && text.ability("Fairy Aura"),
      ].filter((chip): chip is string => !!chip),
    },
    { key: "defender", align: "justify-end", chips: sideChips(defenderSide) },
  ];
  const hasFieldChips = fieldColumns.some((column) => column.chips.length > 0);

  // Saving a calc files it on the active team — the left side is your team.
  // Your Pokémon is the left one (found on that team by species); clicking
  // its move makes the calc offensive, clicking the right one's (hitting
  // yours) makes it defensive. Nothing to guess from the line's text, which
  // can't tell a mirror match (Garchomp vs. Garchomp) apart.
  const ourIndex =
    activeTeam && attackerPokemon
      ? activeTeam.pokemon.findIndex(
          (mon) => speciesIdentity(mon.species) === speciesIdentity(attackerPokemon.species),
        )
      : -1;
  const saveCalcTarget: SaveCalcTarget =
    !activeTeam
      ? { disabledReason: t.calc.saveCalcNoTeam }
      : ourIndex === -1 || !attackerPokemon
        ? { disabledReason: t.calc.saveCalcNotOnTeam(activeTeam.name) }
        : {
            isSaved: (calcText: string) =>
              hasSavedCalc(
                activeTeam.calcs ?? [],
                speciesIdentity(activeTeam.pokemon[ourIndex].species),
                calcText,
              ),
            onSave: (calcText: string) => {
              const side: TeamCalcSide = selectedMove?.side === "defender" ? "defensive" : "offensive";
              const species = speciesIdentity(activeTeam.pokemon[ourIndex].species);
              // Saving the same calc again would only duplicate it.
              if (hasSavedCalc(activeTeam.calcs ?? [], species, calcText)) return;
              updateTeam(activeTeam.id, (team) => ({
                ...team,
                calcs: [...(team.calcs ?? []), { id: generateId(), text: calcText, species, side }],
              }));
              toast.success(
                t.calc.calcSaved(
                  side === "offensive" ? t.calc.offensive : t.calc.defensive,
                  text.species(attackerPokemon.species),
                  activeTeam.name,
                ),
              );
            },
          };

  function sideClass(side: "attacker" | "defender"): string {
    return side === openSide ? "" : "hidden lg:flex";
  }

  function moveListClass(side: "attacker" | "defender"): string {
    return side === movesSide ? "" : "hidden lg:flex";
  }

  const sideTabs: Array<{
    side: "attacker" | "defender";
    label: string;
    pokemon: ParsedPokemon | null;
    mega: boolean;
  }> = [
    { side: "attacker", label: t.calc.attacker, pokemon: attackerPokemon, mega: attackerMega },
    { side: "defender", label: t.calc.defender, pokemon: defenderPokemon, mega: defenderMega },
  ];

  // Below lg, switches whose moves are listed without switching the panel being edited.
  const movesSwitcher = attackerPokemon && defenderPokemon && (
    <div role="group" aria-label={t.calc.showMovesOf} className="flex shrink-0 gap-1 rounded-full bg-zinc-200/70 p-0.5 lg:hidden">
      {sideTabs.map(({ side, label, pokemon, mega }) => {
        const isShown = side === movesSide;
        return (
          <button
            key={side}
            type="button"
            onClick={() => setMovesSide(side)}
            aria-pressed={isShown}
            aria-label={`${label}: ${pokemon ? text.species(pokemon.species) : "—"}`}
            title={pokemon ? text.species(pokemon.species) : label}
            className={`flex h-9 w-11 items-center justify-center rounded-full transition-colors ${
              isShown ? "bg-white shadow-sm dark:bg-zinc-100" : "opacity-50 hover:opacity-100"
            }`}
          >
            {pokemon && (
              <span className="relative h-8 w-8">
                <PokemonSprite species={pokemon.species} item={mega ? pokemon.item : undefined} fill />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Below xl the field lives in a drawer, opened from a bar that sticks to
          the top of the screen — styled like the Matchup Planner's team bar.
          Below lg the bar also holds the Attacker/Defender tabs, above the
          Field setup button, and the page title. Spans the page's full width
          (the negative margins undo its padding: 12px on phones, 24px above). */}
      <nav
        aria-label={t.calc.field}
        className="sticky top-[var(--site-header-height,0px)] z-30 -mx-3 -mt-4 border-b sm:-mx-6 sm:-mt-6 border-zinc-700 bg-zinc-800 dark:border-zinc-300 dark:bg-zinc-200 xl:hidden"
      >
        {/* The page title, which the page itself hides below xl. The negative top margin joins the bar to the site header;
            it pins just below that sticky header (--site-header-height, set by MyTeamHeader). */}
        {/* Below lg it's for screen readers only — the bar stays pinned, so every line costs screen. */}
        <h2 className="sr-only px-4 pt-2.5 text-center text-sm font-semibold text-zinc-100 lg:not-sr-only dark:text-zinc-900">
          {t.calc.title}
        </h2>
        {/* Phones and tablets: one row — each side's tab (a square-ish sprite button; one side edited at
            a time) with the wider Field button between them — and under it one line of what's set:
            each side's modifiers from its own edge, the field-wide ones in the middle, the first
            one and a "+N" for the rest, so the bar never grows. */}
        <div className="flex flex-col gap-1.5 px-3 py-2 lg:hidden">
          <div className="grid grid-cols-[auto_1fr_auto] items-stretch gap-1.5">
            {[sideTabs[0], null, sideTabs[1]].map((tab) => {
              if (!tab) {
                return (
                  <button
                    key="field"
                    type="button"
                    onClick={() => setIsFieldOpen(true)}
                    aria-haspopup="dialog"
                    className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-zinc-500 bg-zinc-700 px-3 transition-colors hover:bg-zinc-600 dark:border-zinc-400 dark:bg-zinc-300 dark:hover:bg-zinc-400"
                  >
                    <span className="flex items-center gap-0.5 text-sm font-semibold text-zinc-100 dark:text-zinc-900">
                      {t.calc.field}
                      <Icon name={IconName.ExpandLess} size={16} className="text-zinc-200 dark:text-zinc-800" />
                    </span>
                    <span className="text-[10px] leading-tight text-zinc-300 dark:text-zinc-700">
                      {battleFormat === "Singles" ? t.calc.singles : t.calc.doubles}
                    </span>
                  </button>
                );
              }
              const { side, label, pokemon, mega } = tab;
              const isOpen = side === openSide;
              return (
                <button
                  key={side}
                  type="button"
                  aria-pressed={isOpen}
                  onClick={() => {
                    setOpenSide(side);
                    setMovesSide(side);
                  }}
                  className={`flex w-16 items-center justify-center rounded-lg border py-0.5 transition-colors ${
                    isOpen
                      ? "border-zinc-400 bg-zinc-100/15 dark:border-zinc-600 dark:bg-zinc-900/15"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  {/* Sprite only — the name is for screen readers; the move list's title names it. */}
                  {pokemon ? (
                    <span className="relative -my-1.5 h-14 w-14 shrink-0">
                      {/* The item is what resolves the Mega sprite — dropped when that side's Mega toggle is off. */}
                      <PokemonSprite species={pokemon.species} item={mega ? pokemon.item : undefined} fill />
                    </span>
                  ) : (
                    <span className="-my-1.5 h-14 w-14" />
                  )}
                  <span className="sr-only">{label}: </span>
                  <span className="sr-only">
                    {pokemon ? text.species(pokemon.species) : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          {hasFieldChips && (
            <button
              type="button"
              onClick={() => setIsFieldOpen(true)}
              aria-label={`${t.calc.fieldSetup}: ${fieldColumns.flatMap((column) => column.chips).join(", ")}`}
              className="grid grid-cols-3 gap-1.5"
            >
              {fieldColumns.map((column) => (
                <span key={column.key} className={`flex min-w-0 items-center gap-1 ${column.align}`}>
                  {column.chips.length > 0 && (
                    <>
                      <span className="min-w-0 truncate rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                        {column.chips[0]}
                      </span>
                      {column.chips.length > 1 && (
                        <span
                          title={column.chips.slice(1).join(", ")}
                          className="shrink-0 rounded-full border border-zinc-400 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-100 dark:border-zinc-600 dark:text-zinc-900"
                        >
                          +{column.chips.length - 1}
                        </span>
                      )}
                    </>
                  )}
                </span>
              ))}
            </button>
          )}
        </div>

        <Drawer open={isFieldOpen} onOpenChange={setIsFieldOpen} showSwipeHandle>
          <DrawerTrigger
            render={
              <button
                type="button"
                className="mx-3 my-2 hidden w-[calc(100%-1.5rem)] flex-col lg:flex gap-1.5 rounded-lg border border-zinc-500 bg-zinc-700 px-3 py-2 transition-colors hover:bg-zinc-600 dark:border-zinc-400 dark:bg-zinc-300 dark:hover:bg-zinc-400"
              />
            }
          >
            <span className="flex items-center justify-center gap-1.5 text-sm font-semibold text-zinc-100 dark:text-zinc-900">
              {t.calc.fieldSetup}
              <span className="text-xs font-normal text-zinc-300 dark:text-zinc-700">
                · {battleFormat === "Singles" ? t.calc.singles : t.calc.doubles}
              </span>
              <Icon name={IconName.ExpandLess} size={18} className="text-zinc-200 dark:text-zinc-800" />
            </span>
            {hasFieldChips ? (
              <span className="grid w-full grid-cols-3 gap-2">
                {fieldColumns.map((column) => (
                  <span key={column.key} className={`flex min-w-0 flex-wrap content-start gap-1 ${column.align}`}>
                    {column.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        {chip}
                      </span>
                    ))}
                  </span>
                ))}
              </span>
            ) : (
              <span className="hidden text-center text-xs text-zinc-400 sm:block dark:text-zinc-600">
                {t.calc.nothingSet}
              </span>
            )}
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t.calc.field}</DrawerTitle>
            </DrawerHeader>
            <div className="mx-auto flex w-full max-w-xl flex-col gap-3 overflow-y-auto p-4 pt-2">
              {fieldControls}
            </div>
          </DrawerContent>
        </Drawer>
      </nav>

      {(attackerPokemon || defenderPokemon) && (
        <div className={`grid grid-cols-1 gap-4 ${THREE_COLUMNS}`}>
          <MoveList
            className={moveListClass("attacker")}
            switcher={movesSwitcher}
            title={t.calc.movesOf(attackerPokemon ? text.species(attackerPokemon.species) : t.calc.attacker)}
            pokemon={attackerPokemon}
            results={attackerMoveResults}
            side="attacker"
            selectedMove={selectedMove}
            onSelect={setSelectedMove}
            battleState={attackerBattleState}
            onBattleStateChange={setAttackerBattleState}
            ability={
              effectiveAttacker
                ? resolveEffectiveAbility(effectiveAttacker.species, effectiveAttacker.item, effectiveAttacker.ability)
                : undefined
            }
          />
          <ResultPanel
            className="order-first lg:col-span-2 xl:order-none xl:col-span-1"
            selectedMove={selectedMove}
            attacker={selectedAttackerMon}
            defender={selectedDefenderMon}
            leftPokemon={effectiveAttacker}
            rightPokemon={effectiveDefender}
            attackerBattleState={selectedAttackingBattleState}
            defenderBattleState={selectedDefendingBattleState}
            options={selectedOptions}
            result={selectedResult}
            saveCalc={saveCalcTarget}
          />
          <MoveList
            className={moveListClass("defender")}
            switcher={movesSwitcher}
            title={t.calc.movesOf(defenderPokemon ? text.species(defenderPokemon.species) : t.calc.defender)}
            pokemon={defenderPokemon}
            results={defenderMoveResults}
            side="defender"
            selectedMove={selectedMove}
            onSelect={setSelectedMove}
            battleState={defenderBattleState}
            onBattleStateChange={setDefenderBattleState}
            ability={
              effectiveDefender
                ? resolveEffectiveAbility(effectiveDefender.species, effectiveDefender.item, effectiveDefender.ability)
                : undefined
            }
          />
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${THREE_COLUMNS}`}>
        <RosterPokemonPicker
          className={sideClass("attacker")}
          title={t.calc.attacker}
          sidebar={attackerSidebar}
          calcSets={calcSets}
          selectedIndex={attackerSelectedIndex}
          onSelectIndex={attackerSelectIndex}
          onAddPokemon={attackerAddPokemon}
          onReplacePokemon={attackerReplacePokemon}
          onLinkSet={(fromSet) => linkSelectedEntry(setAttackerSidebar, attackerSelectedIndex, fromSet)}
          onSaveToSidebar={attackerSaveCurrentToSidebar}
          onImportTeam={attackerImportTeam}
          onRemovePokemon={attackerRemovePokemon}
          mega={attackerMega}
          onMegaChange={(mega) => {
            setAttackerMega(mega);
            const autoWeather = resolveAutoWeather(attackerPokemon, mega);
            if (autoWeather) setWeather(autoWeather);
          }}
          weather={weather}
          terrain={terrain}
          tailwind={attackerSide.tailwind}
          battleState={attackerBattleState}
          onBattleStateChange={setAttackerBattleState}
          statOverrides={attackerStatOverrides}
          onStatOverridesChange={setAttackerStatOverrides}
          onAbilityChange={attackerAbilityChange}
          onItemChange={attackerItemChange}
          onMovesChange={attackerMovesChange}
        />

        {/* Wide screens show the field between the two Pokémon; narrower
            ones open it in a drawer (the Field button below). */}
        <div className="hidden flex-col gap-3 rounded-lg border border-zinc-200 p-4 xl:flex">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t.calc.field}
          </h3>
          {fieldControls}
        </div>

        <RosterPokemonPicker
          className={sideClass("defender")}
          title={t.calc.defender}
          sidebar={defenderSidebar}
          calcSets={calcSets}
          selectedIndex={defenderSelectedIndex}
          onSelectIndex={defenderSelectIndex}
          onAddPokemon={defenderAddPokemon}
          onReplacePokemon={defenderReplacePokemon}
          onLinkSet={(fromSet) => linkSelectedEntry(setDefenderSidebar, defenderSelectedIndex, fromSet)}
          onSaveToSidebar={defenderSaveCurrentToSidebar}
          onImportTeam={defenderImportTeam}
          loadableOpponents={opponents}
          onRemovePokemon={defenderRemovePokemon}
          mega={defenderMega}
          onMegaChange={(mega) => {
            setDefenderMega(mega);
            const autoWeather = resolveAutoWeather(defenderPokemon, mega);
            if (autoWeather) setWeather(autoWeather);
          }}
          weather={weather}
          terrain={terrain}
          tailwind={defenderSide.tailwind}
          battleState={defenderBattleState}
          onBattleStateChange={setDefenderBattleState}
          statOverrides={defenderStatOverrides}
          onStatOverridesChange={setDefenderStatOverrides}
          onAbilityChange={defenderAbilityChange}
          onItemChange={defenderItemChange}
          onMovesChange={defenderMovesChange}
        />
      </div>

      {/* One instance for both sides (not remounted on a tab switch, so its spacer keeps its height). */}
      <MobileRosterBar
        title={openSide === "attacker" ? t.calc.attacker : t.calc.defender}
        sidebar={openSide === "attacker" ? attackerSidebar : defenderSidebar}
        selectedIndex={openSide === "attacker" ? attackerSelectedIndex : defenderSelectedIndex}
        mega={openSide === "attacker" ? attackerMega : defenderMega}
        onSelectIndex={openSide === "attacker" ? attackerSelectIndex : defenderSelectIndex}
        onRemovePokemon={openSide === "attacker" ? attackerRemovePokemon : defenderRemovePokemon}
        onAddBlank={() =>
          (openSide === "attacker" ? attackerAddPokemon : defenderAddPokemon)(
            buildCustomPokemon(DEFAULT_SPECIES_KEY),
          )
        }
      />
    </div>
  );
}

interface ResultPanelProps {
  className?: string;
  selectedMove: { side: "attacker" | "defender"; move: string } | null;
  attacker: ParsedPokemon | undefined;
  defender: ParsedPokemon | undefined;
  /** The left/right sides' Pokémon for the sprite header — fixed by side, unlike attacker/defender, which swap with whichever side's move is selected. */
  leftPokemon: ParsedPokemon | undefined;
  rightPokemon: ParsedPokemon | undefined;
  attackerBattleState: PokemonBattleState;
  defenderBattleState: PokemonBattleState;
  options: DamageCalcOptions | undefined;
  result: DamageResult | null | undefined;
  /** Saving the calc onto the active team, or why it can't be. */
  saveCalc: SaveCalcTarget;
}

type SaveCalcTarget =
  | { onSave: (text: string) => void; isSaved: (text: string) => boolean }
  | { disabledReason: string };

/** The compact middle column between the two move lists — mirrors the reference calculator's layout of putting the result readout between both Pokémon's move lists instead of below them. */
function ResultPanel({
  className = "",
  selectedMove,
  attacker,
  defender,
  leftPokemon,
  rightPokemon,
  attackerBattleState,
  defenderBattleState,
  options,
  result,
  saveCalc,
}: ResultPanelProps) {
  const t = useMessages();
  const text = usePokemonText();
  const calcLabel =
    selectedMove && attacker && defender && result
      ? formatCalculationLabel(
          attacker,
          defender,
          selectedMove.move,
          result,
          attackerBattleState,
          defenderBattleState,
          options,
        )
      : null;
  /** The whole Showdown-format line, exactly as shown — what the copy button puts on the clipboard. */
  const resultLine =
    calcLabel && result
      ? `${calcLabel}: ${result.rolls[0]}-${result.rolls[result.rolls.length - 1]} (${result.minPercent} - ${result.maxPercent}%) -- ${result.koChanceText}`
      : null;

  // This exact calc is already on the team: the button shows a check instead of saving it twice.
  const alreadySaved = "onSave" in saveCalc && !!resultLine && saveCalc.isSaved(resultLine);

  async function copyResultLine() {
    if (!resultLine) return;
    try {
      await navigator.clipboard.writeText(resultLine);
      toast.success(t.calc.calcCopied);
    } catch {
      toast.error(t.calcPanel.copyFailed);
    }
  }

  return (
    <div className={`flex flex-col gap-1.5 self-start ${className}`}>
      {/* Invisible spacer matching MoveList's heading block exactly, so the visible card below starts level with the top move row instead of the "MOVES" heading above it — only needed when they sit side by side. */}
      <div className="invisible hidden xl:block" aria-hidden="true">
        <h3 className="text-xs font-semibold uppercase tracking-wide">{t.calc.result}</h3>
        <p className="text-[11px]">{t.calc.clickMove}</p>
      </div>
      {/* Highlighted once there's a result: the calc line is the page's answer, so it gets the same
          soft amber as the app's other callouts (Speed Tiers' highlighted rows, the regulation badge). */}
      <div
        className={`flex flex-col justify-center gap-2 rounded-lg border p-3 sm:p-4 ${
          result
            ? "border-amber-300 bg-amber-50 dark:border-amber-800/70 dark:bg-amber-950/40"
            : "border-zinc-200 bg-zinc-50"
        }`}
      >
        {/* Desktop only — on phones the side tabs above already show both Pokémon. */}
        {leftPokemon && rightPokemon && (
          <div className="hidden items-center justify-center gap-3 lg:flex">
            <PokemonSprite species={leftPokemon.species} item={leftPokemon.item} size={48} />
            <span className="text-xs font-semibold uppercase text-zinc-400">vs</span>
            <PokemonSprite species={rightPokemon.species} item={rightPokemon.item} size={48} />
          </div>
        )}
        {!selectedMove || !attacker || !defender ? (
          <p className="text-sm text-zinc-500">{t.calc.pickMove}</p>
        ) : (
          <>
            {result ? (
              <>
                <p className="text-sm text-zinc-900" title={t.calc.resultLineHint}>
                  {/* Bold where the decision is — the percentage and the KO chance; the raw
                      HP range stays plain. The words match the copied line exactly. */}
                  {calcLabel}: {result.rolls[0]}-{result.rolls[result.rolls.length - 1]}{" "}
                  <span className="font-semibold whitespace-nowrap">
                    ({result.minPercent} - {result.maxPercent}%)
                  </span>{" "}
                  -- <span className="font-semibold">{result.koChanceText}</span>
                </p>
                {result.recoilMinPercent !== undefined && (
                  <p
                    className="text-xs text-zinc-600"
                    title={t.calc.recoilHint}
                  >
                    {t.calc.recoilTo(text.species(attacker.species))}{" "}
                    {result.recoilMinPercent === result.recoilMaxPercent
                      ? `${result.recoilMinPercent}%`
                      : `${result.recoilMinPercent}% - ${result.recoilMaxPercent}%`}
                  </p>
                )}
                {/* The rolls (secondary) share a row with the copy/save buttons, so the calc line above
                    gets the card's full width. */}
                <div className="flex items-end gap-2">
                  <p className="min-w-0 flex-1 text-xs text-zinc-600" title={t.calc.rollsHint}>
                    {/* Just the rolls in parentheses, the way Showdown's calc shows them; the label stays for screen readers. */}
                    <span className="sr-only">{t.calc.rolls} </span>({result.rolls.join(", ")})
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={copyResultLine}
                      aria-label={t.calc.copyCalc}
                      title={t.calc.copyCalc}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:bg-zinc-100 dark:hover:bg-zinc-200"
                    >
                      <Icon name={IconName.ContentCopy} size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if ("onSave" in saveCalc && resultLine) saveCalc.onSave(resultLine);
                      }}
                      disabled={!("onSave" in saveCalc) || alreadySaved}
                      aria-label={alreadySaved ? t.calc.calcAlreadySaved : t.calc.saveCalc}
                      title={
                        !("onSave" in saveCalc)
                          ? saveCalc.disabledReason
                          : alreadySaved
                            ? t.calc.calcAlreadySaved
                            : t.calc.saveCalc
                      }
                      className="flex h-8 w-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-40 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:bg-zinc-100 dark:hover:bg-zinc-200"
                    >
                      <Icon name={alreadySaved ? IconName.Check : IconName.BookmarkAdd} size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-amber-600">
                {t.calc.cantCalculate(text.move(selectedMove.move))}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface SideConditionsPanelProps {
  title: string;
  conditions: SideConditions;
  onToggle: (key: keyof SideConditions) => void;
}

function SideConditionsPanel({ title, conditions, onToggle }: SideConditionsPanelProps) {
  const text = usePokemonText();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-600">{title}</span>
      <div className="flex flex-col gap-1.5">
        <ToggleButton
          label={text.move("Protect")}
          active={conditions.protect}
          onClick={() => onToggle("protect")}
          className="w-full"
        />
        <ToggleButton
          label={text.move("Helping Hand")}
          active={conditions.helpingHand}
          onClick={() => onToggle("helpingHand")}
          className="w-full"
        />
        <ToggleButton
          label={text.move("Aurora Veil")}
          active={conditions.auroraVeil}
          onClick={() => onToggle("auroraVeil")}
          className="w-full"
        />
        {/* Side by side when they fit, otherwise one per line — never squeezed onto two lines of text. */}
        <div className="flex flex-wrap gap-1.5">
          <ToggleButton
            label={text.move("Reflect")}
            active={conditions.reflect}
            onClick={() => onToggle("reflect")}
            className="flex-1 whitespace-nowrap"
          />
          <ToggleButton
            label={text.move("Light Screen")}
            active={conditions.lightScreen}
            onClick={() => onToggle("lightScreen")}
            className="flex-1 whitespace-nowrap"
          />
        </div>
        <ToggleButton
          label={text.move("Tailwind")}
          active={conditions.tailwind}
          onClick={() => onToggle("tailwind")}
          className="w-full"
        />
        <ToggleButton
          label={text.ability("Friend Guard")}
          active={conditions.friendGuard}
          onClick={() => onToggle("friendGuard")}
          className="w-full"
        />
      </div>
    </div>
  );
}

/** e.g. "(15.8 - 18.6% recoil)" for a real recoil move (min/max vary with the roll, same "N - M" spacing as the reference calculator), or "(9.6% recoil)" for Life Orb alone (a flat cost — min and max come out equal, so just the one number). Empty string when the move has neither. */
function formatRecoilNote(result: ReturnType<typeof calculateDamage>, t: Messages): string {
  if (!result || result.recoilMinPercent === undefined) return "";
  return ` ${t.calc.recoil(
    result.recoilMinPercent === result.recoilMaxPercent
      ? `${result.recoilMinPercent}`
      : `${result.recoilMinPercent} - ${result.recoilMaxPercent}`,
  )}`;
}

function formatMoveResultLabel(result: ReturnType<typeof calculateDamage>, t: Messages): string {
  if (!result) return "—";
  if (result.koChanceText === "immune") return t.calc.immune;
  if (result.koChanceText === "blocked by Protect") return t.calc.protected;
  return `${result.minPercent}-${result.maxPercent}%${formatRecoilNote(result, t)}`;
}

const MOVES = movesData as unknown as Record<string, MoveData>;

interface MoveListProps {
  title: string;
  pokemon: ParsedPokemon | null | undefined;
  results: Array<{ move: string; result: ReturnType<typeof calculateDamage> }>;
  side: "attacker" | "defender";
  selectedMove: { side: "attacker" | "defender"; move: string } | null;
  onSelect: (selection: { side: "attacker" | "defender"; move: string }) => void;
  /** This side's battle state — each row's Crit toggle and Effect/hits count live in it. */
  battleState: PokemonBattleState;
  onBattleStateChange: (state: PokemonBattleState) => void;
  /** The effective (Mega-aware) ability — Skill Link changes a multi-hit move's hit range. */
  ability: string | undefined;
  /** Rendered at the right of the header — the phone/tablet switch between both sides' moves. */
  switcher?: ReactNode;
  className?: string;
}

function countRange(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

function MoveList({
  title,
  pokemon,
  results,
  side,
  selectedMove,
  onSelect,
  battleState,
  onBattleStateChange,
  ability,
  switcher,
  className = "",
}: MoveListProps) {
  const t = useMessages();
  const text = usePokemonText();
  if (!pokemon) return null;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {title}
          </h3>
          <p className="text-[11px] text-zinc-400">{t.calc.clickMove}</p>
        </div>
        {switcher}
      </div>
      {results.length === 0 ? (
        <p className="text-sm text-zinc-500">{t.calc.noMoves}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {results.map(({ move, result }, index) => {
            const isSelected = selectedMove?.side === side && selectedMove.move === move;
            const type = MOVES[normalizeSpeciesKey(move)]?.type;
            const typeColor = type ? TYPE_COLORS[type] : undefined;
            const isStatusMove = MOVES[normalizeSpeciesKey(move)]?.category === "Status";
            const isCrit = battleState.critMoves.includes(move);
            const effect = EFFECT_MOVES[move];
            const hitRange = moveHitRange(move, ability);
            const setCount = (count: number) =>
              onBattleStateChange({
                ...battleState,
                moveCounts: { ...battleState.moveCounts, [move]: count },
              });
            // Controls sit on the row's own colors, so they flip with the selected (dark) row.
            const controlClassName = isSelected
              ? "border-white/40 text-white hover:bg-white/15"
              : "border-zinc-300 text-zinc-600 hover:bg-zinc-100";
            return (
              <div
                key={index}
                className={`relative flex h-10 items-center overflow-hidden rounded-full border text-sm shadow-sm transition-colors ${
                  isSelected
                    ? "border-zinc-600 bg-zinc-600 font-semibold text-white dark:border-zinc-400 dark:bg-zinc-400"
                    : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200"
                }`}
              >
                {/* The whole row selects the move: this button sits behind the content
                    (which ignores clicks), and only the Crit/Effect controls sit above it. */}
                <button
                  type="button"
                  onClick={() => onSelect({ side, move })}
                  aria-pressed={isSelected}
                  aria-label={`${text.move(move)}: ${formatMoveResultLabel(result, t)}`}
                  className="absolute inset-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400"
                />
                {/* Type-colored cap with a slanted right edge, the icon's own background blending into it. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none relative flex h-full w-12 shrink-0 items-center justify-center pr-2"
                  style={{
                    backgroundColor: typeColor ?? "var(--color-zinc-300)",
                    clipPath: "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
                  }}
                >
                  {type && <TypeIcon type={type} size={26} />}
                </span>
                <span aria-hidden="true" className="pointer-events-none relative ml-3 min-w-0 truncate">
                  {text.move(move)}
                </span>
                {(!isStatusMove || effect || hitRange) && (
                  <div className="relative ml-2 flex shrink-0 items-center gap-1 font-normal">
                    {!isStatusMove && (
                      <button
                        type="button"
                        onClick={() =>
                          onBattleStateChange({
                            ...battleState,
                            critMoves: isCrit
                              ? battleState.critMoves.filter((m) => m !== move)
                              : [...battleState.critMoves, move],
                          })
                        }
                        aria-pressed={isCrit}
                        aria-label={t.calcPanel.critLabel(text.move(move))}
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                          isCrit
                            ? isSelected
                              ? "border-white bg-white text-zinc-900"
                              : "border-zinc-600 bg-zinc-600 text-white dark:bg-zinc-400"
                            : controlClassName
                        }`}
                      >
                        {t.calcPanel.crit}
                      </button>
                    )}
                    {effect && (
                      <select
                        value={battleState.moveCounts[move] ?? 0}
                        onChange={(event) => setCount(Number(event.target.value))}
                        aria-label={t.calcPanel.effectLabel(text.move(move))}
                        title={t.calcPanel.effectHints[effect.option](text.move(move))}
                        className={`rounded-full border bg-transparent px-1.5 py-0.5 text-xs ${controlClassName}`}
                      >
                        {countRange(0, effect.max).map((count) => (
                          <option key={count} value={count}>
                            {t.calcPanel.effectCount(count)}
                          </option>
                        ))}
                      </select>
                    )}
                    {hitRange && (
                      <select
                        value={battleState.moveCounts[move] ?? hitRange.default}
                        onChange={(event) => setCount(Number(event.target.value))}
                        aria-label={t.calcPanel.hitsLabel(text.move(move))}
                        className={`rounded-full border bg-transparent px-1.5 py-0.5 text-xs ${controlClassName}`}
                      >
                        {countRange(hitRange.min, hitRange.max).map((count) => (
                          <option key={count} value={count}>
                            {t.calcPanel.hitsCount(count)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none relative ml-auto shrink-0 pl-3 pr-4 tabular-nums ${isSelected ? "text-zinc-200 dark:text-zinc-800" : "font-medium text-zinc-600"}`}
                >
                  {formatMoveResultLabel(result, t)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
