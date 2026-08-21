"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useOpponents } from "@/hooks/useOpponents";
import { calculateDamage } from "@/lib/damage/calculateDamage";
import { applyStatOverrides, type StatOverrides } from "@/lib/stats/applyStatOverrides";
import { calculateStatBreakdown } from "@/lib/stats/calculateFinalStats";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { WEATHER_SETTING_ABILITIES } from "@/constants";
import {
  DEFAULT_BATTLE_STATE,
  DEFAULT_SPECIES_KEY,
  MAX_SIDEBAR_POKEMON,
  RosterPokemonPicker,
  STAT_LABELS,
  buildCustomPokemon,
  type PokemonBattleState,
  type SidebarEntry,
} from "./RosterPokemonPicker";
import type { DamageCalcOptions, DamageResult, ParsedPokemon } from "@/types";

type StageField = "atkStage" | "defStage" | "spaStage" | "spdStage";
const STAGE_FIELD_BY_ATTACK_STAT: Record<DamageResult["attackStatKey"], StageField> = {
  atk: "atkStage",
  spa: "spaStage",
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
 * the defender's species when a damage reducer was active — so the text
 * always reflects everything that went into the number, not just the SP and
 * stage figures. Each side's held item (when present) is prefixed directly
 * onto its species name — e.g. "Choice Specs Charizard" / "Occa Berry
 * Sinistcha" — the standard Showdown-calc convention, and the only way a
 * damage-affecting item (a resist Berry, Choice item, etc.) is visible in
 * the result text itself rather than only in the picker above it. " (spread)"
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
  const category = result.attackStatKey === "atk" ? "Physical" : "Special";
  const reducers = activeDamageReducers(options, category);
  const throughLabel = reducers.length > 0 ? ` through ${reducers.join(" and ")}` : "";
  const attackerItemLabel = attacker.item ? `${attacker.item} ` : "";
  const defenderItemLabel = defender.item ? `${defender.item} ` : "";

  return `${attackToken} ${attackerItemLabel}${attacker.species} ${helpingHandLabel}${moveName}${hitsLabel}${spreadLabel} vs. ${defenderHpSp} HP / ${defenseToken} ${defenderItemLabel}${defender.species}${throughLabel}`;
}

const DEFAULT_STAT_OVERRIDES: StatOverrides = {};

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
          ? "border-mauve-600 bg-mauve-600 text-white"
          : "border-mauve-300 text-mauve-700 hover:bg-mauve-100"
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
function SegmentedToggle<T extends string>({ options, value, onChange }: SegmentedToggleProps<T>) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-mauve-300">
      {options.map((option, index) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`px-4 py-1 text-xs font-medium transition-colors ${
            value === option
              ? "bg-mauve-600 text-white"
              : "text-mauve-700 hover:bg-mauve-100"
          } ${index > 0 ? "border-l border-mauve-300" : ""}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const WEATHER_OPTIONS: Array<{ label: string; value: DamageCalcOptions["weather"] }> = [
  { label: "None", value: undefined },
  { label: "Sun", value: "Sun" },
  { label: "Rain", value: "Rain" },
  { label: "Sand", value: "Sand" },
  { label: "Snow", value: "Snow" },
];

const TERRAIN_OPTIONS: Array<{ label: string; value: DamageCalcOptions["terrain"] }> = [
  { label: "None", value: undefined },
  { label: "Electric", value: "Electric" },
  { label: "Grassy", value: "Grassy" },
  { label: "Psychic", value: "Psychic" },
  { label: "Misty", value: "Misty" },
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

export function DamageCalculator() {
  const { teams, activeTeamId, isLoading } = useMyTeams();
  // Team/opponent selection from a saved roster is otherwise omitted (see
  // PLANNING.md) — the header's active team seeds the Attacker's sidebar on
  // first load, and a specific opponent seeds the Defender's when opened via
  // an OpponentCard's "Open in Damage Calculator" link (?opponentId=...,
  // below) — both are one-time seeds, not an ongoing team-selection UI.
  const activeTeam = activeTeamId ? teams.find((t) => t.id === activeTeamId) : undefined;
  const { opponents } = useOpponents();
  const searchParams = useSearchParams();
  const opponentId = searchParams.get("opponentId");
  const opponentFromUrl = opponentId ? opponents.find((o) => o.id === opponentId) : undefined;

  // Each side's working roster (sidebar) — up to MAX_SIDEBAR_POKEMON,
  // editable via the species search (adds a custom entry) or the sidebar's
  // own remove button. The Attacker seeds from the header's active team (see
  // the render-time default below); the Defender starts with a single
  // default species so there's always something to calculate with.
  const [attackerSidebar, setAttackerSidebar] = useState<SidebarEntry[]>([]);
  const [attackerSelectedIndex, setAttackerSelectedIndex] = useState<number | null>(null);
  const [attackerMega, setAttackerMega] = useState(true);

  const [defenderSidebar, setDefenderSidebar] = useState<SidebarEntry[]>(() => [
    { pokemon: buildCustomPokemon(DEFAULT_SPECIES_KEY), isCustom: true },
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
  const [isCritical, setIsCritical] = useState(false);
  const [fairyAura, setFairyAura] = useState(false);
  const [gravity, setGravity] = useState(false);

  // Seeds the Attacker's sidebar with the header's active team, the first
  // time activeTeamId becomes available (it loads asynchronously from
  // IndexedDB) — adjusted directly during render, React's own recommended
  // pattern for "sync state once when a value changes" (see "Adjusting some
  // state when a prop changes" in the React docs), rather than an effect.
  // Guarded by attackerDefaultedFor so this never fires again once it has,
  // meaning a later explicit change (or a manually-emptied sidebar) is never
  // overridden by it. If there's no active team, the Attacker's sidebar just
  // stays empty — unlike the Defender, it doesn't fall back to a default
  // species (per explicit request: "keep empty" when there's no team to load).
  const [attackerDefaultedFor, setAttackerDefaultedFor] = useState<string | null>(null);
  if (activeTeamId !== attackerDefaultedFor) {
    setAttackerDefaultedFor(activeTeamId);
    if (attackerSidebar.length === 0 && activeTeam) {
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
    const seeded = opponentFromUrl.team.pokemon.map((pokemon) => ({ pokemon, isCustom: false }));
    setDefenderSidebar(seeded);
    setDefenderSelectedIndex(0);
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
      isCritical,
      weather,
      terrain,
      fairyAura,
      gravity,
      attackerBurned: attackingBattleState.status === "Burned",
      attackerStatused: attackingBattleState.status !== "Healthy",
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
      ? (attackerPokemon?.moves ?? []).map((move) => ({
          move,
          result: calculateDamage(effectiveAttacker, effectiveDefender, move, attackerMoveOptions),
        }))
      : [];
  const defenderMoveResults =
    effectiveAttacker && effectiveDefender
      ? (defenderPokemon?.moves ?? []).map((move) => ({
          move,
          result: calculateDamage(effectiveDefender, effectiveAttacker, move, defenderMoveOptions),
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
  const selectedOptions = selectedMove?.side === "attacker" ? attackerMoveOptions : defenderMoveOptions;

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

  // Adds a species (from the main search or the sidebar's own "+" tile) —
  // appends a new custom entry while under MAX_SIDEBAR_POKEMON, otherwise
  // replaces whichever entry is currently selected (or the first one, if
  // none is) so the cap is never exceeded.
  function attackerAddPokemon(newPokemon: ParsedPokemon) {
    const newEntry: SidebarEntry = { pokemon: newPokemon, isCustom: true };
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

  function attackerRemovePokemon(index: number) {
    setAttackerSidebar(attackerSidebar.filter((_, i) => i !== index));
    if (attackerSelectedIndex === index) {
      setAttackerSelectedIndex(null);
      setSelectedMove(null);
    } else if (attackerSelectedIndex !== null && attackerSelectedIndex > index) {
      setAttackerSelectedIndex(attackerSelectedIndex - 1);
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

  function defenderAddPokemon(newPokemon: ParsedPokemon) {
    const newEntry: SidebarEntry = { pokemon: newPokemon, isCustom: true };
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

  function defenderRemovePokemon(index: number) {
    setDefenderSidebar(defenderSidebar.filter((_, i) => i !== index));
    if (defenderSelectedIndex === index) {
      setDefenderSelectedIndex(null);
      setSelectedMove(null);
    } else if (defenderSelectedIndex !== null && defenderSelectedIndex > index) {
      setDefenderSelectedIndex(defenderSelectedIndex - 1);
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
    return <p className="text-sm text-mauve-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {(attackerPokemon || defenderPokemon) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MoveList
            title={`${attackerPokemon?.species ?? "Attacker"}'s moves`}
            pokemon={attackerPokemon}
            results={attackerMoveResults}
            side="attacker"
            selectedMove={selectedMove}
            onSelect={setSelectedMove}
          />
          <ResultPanel
            selectedMove={selectedMove}
            attacker={selectedAttackerMon}
            defender={selectedDefenderMon}
            attackerBattleState={selectedAttackingBattleState}
            defenderBattleState={selectedDefendingBattleState}
            options={selectedOptions}
            result={selectedResult}
          />
          <MoveList
            title={`${defenderPokemon?.species ?? "Defender"}'s moves`}
            pokemon={defenderPokemon}
            results={defenderMoveResults}
            side="defender"
            selectedMove={selectedMove}
            onSelect={setSelectedMove}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RosterPokemonPicker
          title="Attacker"
          sidebar={attackerSidebar}
          selectedIndex={attackerSelectedIndex}
          onSelectIndex={attackerSelectIndex}
          onAddPokemon={attackerAddPokemon}
          onRemovePokemon={attackerRemovePokemon}
          mega={attackerMega}
          onMegaChange={(mega) => {
            setAttackerMega(mega);
            const autoWeather = resolveAutoWeather(attackerPokemon, mega);
            if (autoWeather) setWeather(autoWeather);
          }}
          weather={weather}
          tailwind={attackerSide.tailwind}
          battleState={attackerBattleState}
          onBattleStateChange={setAttackerBattleState}
          statOverrides={attackerStatOverrides}
          onStatOverridesChange={setAttackerStatOverrides}
          onAbilityChange={attackerAbilityChange}
          onItemChange={attackerItemChange}
          onMovesChange={attackerMovesChange}
        />

        <div className="flex flex-col gap-3 rounded-lg border border-mauve-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
            Field
          </h3>

          <div className="flex justify-center">
            <SegmentedToggle
              options={["Singles", "Doubles"] as const}
              value={battleFormat}
              onChange={setBattleFormat}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-mauve-600">Weather</span>
            <div className="flex flex-wrap justify-center gap-2">
              {WEATHER_OPTIONS.map((option) => (
                <ToggleButton
                  key={option.label}
                  label={option.label}
                  active={weather === option.value}
                  onClick={() => setWeather(option.value)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-mauve-600">Terrain</span>
            <div className="flex flex-wrap justify-center gap-2">
              {TERRAIN_OPTIONS.map((option) => (
                <ToggleButton
                  key={option.label}
                  label={option.label}
                  active={terrain === option.value}
                  onClick={() => setTerrain(option.value)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <ToggleButton label="Critical Hit" active={isCritical} onClick={() => setIsCritical((v) => !v)} />
            <ToggleButton label="Fairy Aura" active={fairyAura} onClick={() => setFairyAura((v) => !v)} />
            <ToggleButton label="Gravity" active={gravity} onClick={() => setGravity((v) => !v)} />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-3 border-t border-mauve-200 pt-3">
            <SideConditionsPanel
              title={`${attackerPokemon?.species ?? "Attacker"} side`}
              conditions={attackerSide}
              onToggle={toggleAttackerSide}
            />
            <SideConditionsPanel
              title={`${defenderPokemon?.species ?? "Defender"} side`}
              conditions={defenderSide}
              onToggle={toggleDefenderSide}
            />
          </div>
        </div>

        <RosterPokemonPicker
          title="Defender"
          sidebar={defenderSidebar}
          selectedIndex={defenderSelectedIndex}
          onSelectIndex={defenderSelectIndex}
          onAddPokemon={defenderAddPokemon}
          onRemovePokemon={defenderRemovePokemon}
          mega={defenderMega}
          onMegaChange={(mega) => {
            setDefenderMega(mega);
            const autoWeather = resolveAutoWeather(defenderPokemon, mega);
            if (autoWeather) setWeather(autoWeather);
          }}
          weather={weather}
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
    </div>
  );
}

interface ResultPanelProps {
  selectedMove: { side: "attacker" | "defender"; move: string } | null;
  attacker: ParsedPokemon | undefined;
  defender: ParsedPokemon | undefined;
  attackerBattleState: PokemonBattleState;
  defenderBattleState: PokemonBattleState;
  options: DamageCalcOptions | undefined;
  result: DamageResult | null | undefined;
}

/** The compact middle column between the two move lists — mirrors the reference calculator's layout of putting the result readout between both Pokémon's move lists instead of below them. */
function ResultPanel({
  selectedMove,
  attacker,
  defender,
  attackerBattleState,
  defenderBattleState,
  options,
  result,
}: ResultPanelProps) {
  return (
    <div className="flex flex-col gap-1.5 self-start">
      {/* Invisible spacer matching MoveList's heading block exactly, so the visible card below starts level with the top move row instead of the "MOVES" heading above it. */}
      <div className="invisible" aria-hidden="true">
        <h3 className="text-xs font-semibold uppercase tracking-wide">Result</h3>
        <p className="text-[11px]">click a move to see details</p>
      </div>
      <div className="flex flex-col justify-center gap-2 rounded-lg border border-mauve-200 bg-mauve-50 p-4">
        {!selectedMove || !attacker || !defender ? (
          <p className="text-sm text-mauve-500">
            Click a move on either side to see the calculation.
          </p>
        ) : result ? (
          <>
            <p className="text-sm text-mauve-900">
              {formatCalculationLabel(
                attacker,
                defender,
                selectedMove.move,
                result,
                attackerBattleState,
                defenderBattleState,
                options,
              )}
              :{" "}
              <span className="font-semibold">
                {result.rolls[0]}-{result.rolls[result.rolls.length - 1]}
              </span>{" "}
              ({result.minPercent}% - {result.maxPercent}%) -- {result.koChanceText}
            </p>
            {result.recoilMinPercent !== undefined && (
              <p
                className="text-xs text-mauve-500"
                title="Self-damage the attacker takes from this move's own recoil and/or Life Orb, as a percent of the ATTACKER's own max HP — not the defender's."
              >
                Recoil to {attacker?.species}:{" "}
                {result.recoilMinPercent === result.recoilMaxPercent
                  ? `${result.recoilMinPercent}%`
                  : `${result.recoilMinPercent}% - ${result.recoilMaxPercent}%`}
              </p>
            )}
            <p
              className="text-xs text-mauve-500"
              title="Every hit's damage varies by a random 85%-100% factor — these are the 16 possible exact damage values for this move right now, lowest to highest."
            >
              Possible damage rolls: {result.rolls.join(", ")}
            </p>
          </>
        ) : (
          <p className="text-sm text-amber-600">
            Can&apos;t calculate {selectedMove.move} yet — it&apos;s either a
            Status move or one whose damage isn&apos;t based on the standard
            power formula (e.g. Seismic Toss, Counter).
          </p>
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
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-mauve-600">{title}</span>
      <div className="flex flex-col gap-1.5">
        <ToggleButton
          label="Protect"
          active={conditions.protect}
          onClick={() => onToggle("protect")}
          className="w-full"
        />
        <ToggleButton
          label="Helping Hand"
          active={conditions.helpingHand}
          onClick={() => onToggle("helpingHand")}
          className="w-full"
        />
        <ToggleButton
          label="Aurora Veil"
          active={conditions.auroraVeil}
          onClick={() => onToggle("auroraVeil")}
          className="w-full"
        />
        <div className="flex gap-1.5">
          <ToggleButton
            label="Reflect"
            active={conditions.reflect}
            onClick={() => onToggle("reflect")}
            className="flex-1"
          />
          <ToggleButton
            label="Light Screen"
            active={conditions.lightScreen}
            onClick={() => onToggle("lightScreen")}
            className="flex-1"
          />
        </div>
        <ToggleButton
          label="Tailwind"
          active={conditions.tailwind}
          onClick={() => onToggle("tailwind")}
          className="w-full"
        />
        <ToggleButton
          label="Friend Guard"
          active={conditions.friendGuard}
          onClick={() => onToggle("friendGuard")}
          className="w-full"
        />
      </div>
    </div>
  );
}

/** e.g. "(15.8 - 18.6% recoil)" for a real recoil move (min/max vary with the roll, same "N - M" spacing as the reference calculator), or "(9.6% recoil)" for Life Orb alone (a flat cost — min and max come out equal, so just the one number). Empty string when the move has neither. */
function formatRecoilNote(result: ReturnType<typeof calculateDamage>): string {
  if (!result || result.recoilMinPercent === undefined) return "";
  return result.recoilMinPercent === result.recoilMaxPercent
    ? ` (${result.recoilMinPercent}% recoil)`
    : ` (${result.recoilMinPercent} - ${result.recoilMaxPercent}% recoil)`;
}

function formatMoveResultLabel(result: ReturnType<typeof calculateDamage>): string {
  if (!result) return "—";
  if (result.koChanceText === "immune") return "immune";
  if (result.koChanceText === "blocked by Protect") return "protected";
  return `${result.minPercent}-${result.maxPercent}%${formatRecoilNote(result)}`;
}

interface MoveListProps {
  title: string;
  pokemon: ParsedPokemon | null | undefined;
  results: Array<{ move: string; result: ReturnType<typeof calculateDamage> }>;
  side: "attacker" | "defender";
  selectedMove: { side: "attacker" | "defender"; move: string } | null;
  onSelect: (selection: { side: "attacker" | "defender"; move: string }) => void;
}

function MoveList({ title, pokemon, results, side, selectedMove, onSelect }: MoveListProps) {
  if (!pokemon) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
          {title}
        </h3>
        <p className="text-[11px] text-mauve-400">click a move to see details</p>
      </div>
      {results.length === 0 ? (
        <p className="text-sm text-mauve-500">
          No moves were parsed for this Pokémon — the pasted export may not
          have listed any.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-mauve-100 overflow-hidden rounded-lg border border-mauve-200">
          {results.map(({ move, result }, index) => {
            const isSelected = selectedMove?.side === side && selectedMove.move === move;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onSelect({ side, move })}
                aria-pressed={isSelected}
                className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? "bg-mauve-100 font-semibold text-mauve-900"
                    : "text-mauve-700 hover:bg-mauve-50"
                }`}
              >
                <span>{move}</span>
                <span className="text-mauve-500">{formatMoveResultLabel(result)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
