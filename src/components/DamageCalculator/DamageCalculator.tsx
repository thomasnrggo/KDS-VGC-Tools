"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
import { calculateDamage } from "@/lib/damage/calculateDamage";
import type { StatOverrides } from "@/lib/stats/applyStatOverrides";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import {
  DEFAULT_BATTLE_STATE,
  MAX_SIDEBAR_POKEMON,
  RosterPokemonPicker,
  type PokemonBattleState,
  type SidebarEntry,
} from "./RosterPokemonPicker";
import { DEFAULT_SPECIES_KEY, buildCustomPokemon } from "../PokemonEditor";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Icon } from "../Icon";
import { TogglePill } from "../Button";
import { toast } from "../Toast";
import { PokemonSprite } from "../PokemonSprite";
import { IconName } from "@/enums";
import type { DamageCalcOptions, ParsedPokemon, TeamCalcSide } from "@/types";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/LoadingState";
import {
  DEFAULT_SIDE_CONDITIONS,
  MoveList,
  ResultPanel,
  SideConditionsPanel,
  TERRAIN_OPTIONS,
  WEATHER_OPTIONS,
  calcOptions,
  forMove,
  resolveAutoWeather,
  resolveFieldAbility,
  toEffectivePokemon,
  type SaveCalcTarget,
  type SideConditions,
} from "./calcShared";

const DEFAULT_STAT_OVERRIDES: StatOverrides = {};

const subscribeNever = () => () => {};

/** What a side falls back to so it's never empty: the regulation's first species, as a blank set. */
function defaultSidebarEntry(): SidebarEntry {
  return { pokemon: buildCustomPokemon(DEFAULT_SPECIES_KEY), isCustom: true };
}

interface SegmentedToggleProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

/** A single connected pill split into mutually-exclusive segments (only one can be active) — visually distinct from TogglePill's separate-pill rows, matching the reference calculator's "Singles / Doubles" control. Used for the battle format toggle; a generic 2+ option component rather than hardcoding two buttons since the shared border between segments needs each button to know its position in the row. */
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
          className={cn(
            "px-4 py-1 text-xs font-medium transition-colors",
            value === option ? "bg-chrome-600 text-white" : "text-zinc-700 hover:bg-zinc-100",
            index > 0 && "border-l border-zinc-300",
          )}
        >
          {labelFor(option)}
        </button>
      ))}
    </div>
  );
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
    attackerSelectedIndex !== null
      ? (attackerSidebar[attackerSelectedIndex]?.pokemon ?? null)
      : null;
  const defenderPokemon =
    defenderSelectedIndex !== null
      ? (defenderSidebar[defenderSelectedIndex]?.pokemon ?? null)
      : null;

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

  // What a Pokémon's ability sets as it comes in (picked, switched to, loaded,
  // given its Mega Stone or Mega Evolved): the weather (Drizzle, Mega
  // Charizard Y's Drought…) and Fairy Aura (Mega Floette). Only ever turns
  // them on — they can still be turned off by hand.
  function applyEntryAbility(pokemon: ParsedPokemon | null | undefined, mega: boolean) {
    const autoWeather = resolveAutoWeather(pokemon, mega);
    if (autoWeather) setWeather(autoWeather);
    if (resolveFieldAbility(pokemon, mega) === "Fairy Aura") setFairyAura(true);
  }

  // Turning Mega off takes Fairy Aura with it when the Mega form was its only
  // source — unless the other side's Pokémon has it too.
  function clearMegaFairyAura(
    pokemon: ParsedPokemon | null | undefined,
    otherSideHasAura: boolean,
  ) {
    const auraFromMega =
      resolveFieldAbility(pokemon, true) === "Fairy Aura" &&
      resolveFieldAbility(pokemon, false) !== "Fairy Aura";
    if (auraFromMega && !otherSideHasAura) setFairyAura(false);
  }
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
      applyEntryAbility(seeded[0]?.pokemon, attackerMega);
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
  const savedDefenderDraft = useSyncExternalStore(
    subscribeNever,
    readDefenderDraft,
    () => undefined,
  );
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
  }, [
    isDefenderDraftChecked,
    defenderSidebar,
    defenderSelectedIndex,
    defenderMega,
    defenderStatOverrides,
  ]);

  const effectiveAttacker = toEffectivePokemon(
    attackerPokemon,
    attackerMega,
    attackerStatOverrides,
  );
  const effectiveDefender = toEffectivePokemon(
    defenderPokemon,
    defenderMega,
    defenderStatOverrides,
  );

  // The options for whichever side is attacking in this direction (see calcOptions).
  function optionsFor(
    attackingSide: SideConditions,
    defendingSide: SideConditions,
    attackingBattleState: PokemonBattleState,
    defendingBattleState: PokemonBattleState,
  ): DamageCalcOptions {
    return calcOptions(
      { weather, terrain, fairyAura, gravity, doubles: battleFormat === "Doubles" },
      attackingSide,
      defendingSide,
      attackingBattleState,
      defendingBattleState,
    );
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
  const selectedAttackerMon =
    selectedMove?.side === "attacker" ? effectiveAttacker : effectiveDefender;
  const selectedDefenderMon =
    selectedMove?.side === "attacker" ? effectiveDefender : effectiveAttacker;
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
    applyEntryAbility(attackerSidebar[index]?.pokemon, attackerMega);
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
    applyEntryAbility(newPokemon, attackerMega);
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
    applyEntryAbility(newPokemon, attackerMega);
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
    applyEntryAbility(attackerPokemon, attackerMega);
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
    applyEntryAbility(newSidebar[0]?.pokemon, attackerMega);
  }

  function attackerRemovePokemon(index: number) {
    const next = removeSidebarEntry(
      attackerSidebar,
      attackerSelectedIndex,
      index,
      defaultSidebarEntry,
    );
    setAttackerSidebar(next.sidebar);
    setAttackerSelectedIndex(next.selectedIndex);
    if (next.selectionChanged) {
      setSelectedMove(null);
      setAttackerBattleState(DEFAULT_BATTLE_STATE);
      setAttackerStatOverrides(DEFAULT_STAT_OVERRIDES);
      applyEntryAbility(next.sidebar[next.selectedIndex]?.pokemon, attackerMega);
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
    applyEntryAbility(attackerPokemon ? { ...attackerPokemon, item } : undefined, attackerMega);
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
    applyEntryAbility(defenderSidebar[index]?.pokemon, defenderMega);
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
    applyEntryAbility(newPokemon, defenderMega);
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
    applyEntryAbility(newPokemon, defenderMega);
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
    applyEntryAbility(defenderPokemon, defenderMega);
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
    applyEntryAbility(newSidebar[0]?.pokemon, defenderMega);
  }

  function defenderRemovePokemon(index: number) {
    const next = removeSidebarEntry(
      defenderSidebar,
      defenderSelectedIndex,
      index,
      defaultSidebarEntry,
    );
    setDefenderSidebar(next.sidebar);
    setDefenderSelectedIndex(next.selectedIndex);
    if (next.selectionChanged) {
      setSelectedMove(null);
      setDefenderBattleState(DEFAULT_BATTLE_STATE);
      setDefenderStatOverrides(DEFAULT_STAT_OVERRIDES);
      applyEntryAbility(next.sidebar[next.selectedIndex]?.pokemon, defenderMega);
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
    applyEntryAbility(defenderPokemon ? { ...defenderPokemon, item } : undefined, defenderMega);
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
    return <LoadingState />;
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
          <TogglePill
            key={option}
            active={weather === option}
            onClick={() => setWeather(weather === option ? undefined : option)}
          >
            {t.calc.weathers[option]}
          </TogglePill>
        ))}
      </div>

      <div role="group" aria-label={t.calc.terrain} className="flex flex-wrap justify-center gap-2">
        {TERRAIN_OPTIONS.map((option) => (
          <TogglePill
            key={option}
            active={terrain === option}
            onClick={() => setTerrain(terrain === option ? undefined : option)}
          >
            {t.calc.terrains[option]}
          </TogglePill>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <TogglePill active={fairyAura} onClick={() => setFairyAura((v) => !v)}>
          {text.ability("Fairy Aura")}
        </TogglePill>
        <TogglePill active={gravity} onClick={() => setGravity((v) => !v)}>
          {text.move("Gravity")}
        </TogglePill>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-3">
        <SideConditionsPanel
          title={t.calc.sideOf(
            attackerPokemon ? text.species(attackerPokemon.species) : t.calc.attacker,
          )}
          conditions={attackerSide}
          onToggle={toggleAttackerSide}
        />
        <SideConditionsPanel
          title={t.calc.sideOf(
            defenderPokemon ? text.species(defenderPokemon.species) : t.calc.defender,
          )}
          conditions={defenderSide}
          onToggle={toggleDefenderSide}
          align="right"
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
  const saveCalcTarget: SaveCalcTarget = !activeTeam
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
            const side: TeamCalcSide =
              selectedMove?.side === "defender" ? "defensive" : "offensive";
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
    <div
      role="group"
      aria-label={t.calc.showMovesOf}
      className="flex shrink-0 gap-1 rounded-full bg-zinc-200/70 p-0.5 lg:hidden"
    >
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
            className={cn(
              "flex h-9 w-11 items-center justify-center rounded-full transition-colors",
              isShown ? "bg-raised shadow-sm" : "opacity-50 hover:opacity-100",
            )}
          >
            {pokemon && (
              <span className="relative h-8 w-8">
                <PokemonSprite
                  species={pokemon.species}
                  item={mega ? pokemon.item : undefined}
                  fill
                />
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
        className="sticky top-[var(--site-header-height,0px)] z-30 -mx-3 -mt-4 border-b border-chrome-700 bg-chrome-800 sm:-mx-6 sm:-mt-6 xl:hidden"
      >
        {/* The page title, which the page itself hides below xl. The negative top margin joins the bar to the site header;
            it pins just below that sticky header (--site-header-height, set by MyTeamHeader). */}
        {/* Below lg it's for screen readers only — the bar stays pinned, so every line costs screen. */}
        <h2 className="sr-only px-4 pt-2.5 text-center text-sm font-semibold text-chrome-100 lg:not-sr-only">
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
                    className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-chrome-500 bg-chrome-700 px-3 transition-colors hover:bg-chrome-600 dark:border-chrome-600"
                  >
                    <span className="flex items-center gap-0.5 text-sm font-semibold text-chrome-100">
                      {t.calc.field}
                      <Icon name={IconName.ExpandLess} size={16} className="text-chrome-200" />
                    </span>
                    <span className="text-[10px] leading-tight text-chrome-300">
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
                  className={cn(
                    "flex w-16 items-center justify-center rounded-lg border py-0.5 transition-colors",
                    isOpen
                      ? "border-chrome-400 bg-chrome-100/15"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  {/* Sprite only — the name is for screen readers; the move list's title names it. */}
                  {pokemon ? (
                    <span className="relative -my-1.5 h-14 w-14 shrink-0">
                      {/* The item is what resolves the Mega sprite — dropped when that side's Mega toggle is off. */}
                      <PokemonSprite
                        species={pokemon.species}
                        item={mega ? pokemon.item : undefined}
                        fill
                      />
                    </span>
                  ) : (
                    <span className="-my-1.5 h-14 w-14" />
                  )}
                  <span className="sr-only">{label}: </span>
                  <span className="sr-only">{pokemon ? text.species(pokemon.species) : "—"}</span>
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
                <span
                  key={column.key}
                  className={cn("flex min-w-0 items-center gap-1", column.align)}
                >
                  {column.chips.length > 0 && (
                    <>
                      <span className="min-w-0 truncate rounded-full bg-chrome-100 px-2 py-0.5 text-[11px] font-semibold text-chrome-900">
                        {column.chips[0]}
                      </span>
                      {column.chips.length > 1 && (
                        <span
                          title={column.chips.slice(1).join(", ")}
                          className="shrink-0 rounded-full border border-chrome-400 px-1.5 py-0.5 text-[11px] font-semibold text-chrome-100"
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
                className="mx-3 my-2 hidden w-[calc(100%-1.5rem)] flex-col gap-1.5 rounded-lg border border-chrome-500 bg-chrome-700 px-3 py-2 transition-colors hover:bg-chrome-600 lg:flex dark:border-chrome-600"
              />
            }
          >
            <span className="flex items-center justify-center gap-1.5 text-sm font-semibold text-chrome-100">
              {t.calc.fieldSetup}
              <span className="text-xs font-normal text-chrome-300">
                · {battleFormat === "Singles" ? t.calc.singles : t.calc.doubles}
              </span>
              <Icon name={IconName.ExpandLess} size={18} className="text-chrome-200" />
            </span>
            {hasFieldChips ? (
              <span className="grid w-full grid-cols-3 gap-2">
                {fieldColumns.map((column) => (
                  <span
                    key={column.key}
                    className={cn("flex min-w-0 flex-wrap content-start gap-1", column.align)}
                  >
                    {column.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-chrome-100 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-chrome-900"
                      >
                        {chip}
                      </span>
                    ))}
                  </span>
                ))}
              </span>
            ) : (
              <span className="hidden text-center text-xs text-chrome-400 sm:block">
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
        <div className={cn("grid grid-cols-1 gap-4", THREE_COLUMNS)}>
          <MoveList
            className={moveListClass("attacker")}
            switcher={movesSwitcher}
            title={t.calc.movesOf(
              attackerPokemon ? text.species(attackerPokemon.species) : t.calc.attacker,
            )}
            pokemon={attackerPokemon}
            results={attackerMoveResults}
            side="attacker"
            selectedMove={selectedMove}
            onSelect={setSelectedMove}
            battleState={attackerBattleState}
            onBattleStateChange={setAttackerBattleState}
            ability={
              effectiveAttacker
                ? resolveEffectiveAbility(
                    effectiveAttacker.species,
                    effectiveAttacker.item,
                    effectiveAttacker.ability,
                  )
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
            title={t.calc.movesOf(
              defenderPokemon ? text.species(defenderPokemon.species) : t.calc.defender,
            )}
            pokemon={defenderPokemon}
            results={defenderMoveResults}
            side="defender"
            selectedMove={selectedMove}
            onSelect={setSelectedMove}
            battleState={defenderBattleState}
            onBattleStateChange={setDefenderBattleState}
            ability={
              effectiveDefender
                ? resolveEffectiveAbility(
                    effectiveDefender.species,
                    effectiveDefender.item,
                    effectiveDefender.ability,
                  )
                : undefined
            }
          />
        </div>
      )}

      <div className={cn("grid grid-cols-1 gap-4", THREE_COLUMNS)}>
        <RosterPokemonPicker
          className={sideClass("attacker")}
          title={t.calc.attacker}
          sidebar={attackerSidebar}
          calcSets={calcSets}
          selectedIndex={attackerSelectedIndex}
          onSelectIndex={attackerSelectIndex}
          onAddPokemon={attackerAddPokemon}
          onReplacePokemon={attackerReplacePokemon}
          onLinkSet={(fromSet) =>
            linkSelectedEntry(setAttackerSidebar, attackerSelectedIndex, fromSet)
          }
          onSaveToSidebar={attackerSaveCurrentToSidebar}
          onImportTeam={attackerImportTeam}
          onRemovePokemon={attackerRemovePokemon}
          mega={attackerMega}
          onMegaChange={(mega) => {
            setAttackerMega(mega);
            if (mega) applyEntryAbility(attackerPokemon, mega);
            else
              clearMegaFairyAura(
                attackerPokemon,
                resolveFieldAbility(defenderPokemon, defenderMega) === "Fairy Aura",
              );
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
            ones open it in a drawer (the Field button below). A step darker
            than the two Pokémon panels, so the shared battlefield stands apart
            from them; its unpressed pills stay white on it. */}
        <div className="hidden flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-100 p-4 xl:flex [&_button[aria-pressed=false]]:bg-raised">
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
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
          onLinkSet={(fromSet) =>
            linkSelectedEntry(setDefenderSidebar, defenderSelectedIndex, fromSet)
          }
          onSaveToSidebar={defenderSaveCurrentToSidebar}
          onImportTeam={defenderImportTeam}
          loadableOpponents={opponents}
          onRemovePokemon={defenderRemovePokemon}
          mega={defenderMega}
          onMegaChange={(mega) => {
            setDefenderMega(mega);
            if (mega) applyEntryAbility(defenderPokemon, mega);
            else
              clearMegaFairyAura(
                defenderPokemon,
                resolveFieldAbility(attackerPokemon, attackerMega) === "Fairy Aura",
              );
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
