"use client";

import { useState } from "react";
import type { DamageCalcOptions, ParsedPokemon, Team, TeamCalcSide } from "@/types";
import { useCalcSets, type SavedSetRef } from "@/hooks/useCalcSets";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { calculateDamage } from "@/lib/damage/calculateDamage";
import { generateId } from "@/lib/id";
import { hasSavedCalc } from "@/lib/teamCalcs";
import { speciesIdentity } from "@/lib/teamIdentity";
import type { StatOverrides } from "@/lib/stats/applyStatOverrides";
import { IconName } from "@/enums";
import { TogglePill } from "../Button";
import { Icon } from "../Icon";
import { toast } from "../Toast";
import { DEFAULT_SPECIES_KEY, buildCustomPokemon } from "../PokemonEditor";
import {
  DEFAULT_BATTLE_STATE,
  RosterPokemonPicker,
  type PokemonBattleState,
  type SidebarEntry,
} from "../DamageCalculator/RosterPokemonPicker";
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
} from "../DamageCalculator/calcShared";

const NO_OVERRIDES: StatOverrides = {};

type Selection = { side: "attacker" | "defender"; move: string };

interface BuilderCalculatorProps {
  team: Team;
  /** The Pokémon open in the builder — your side, live: edits in the builder show here at once. */
  pokemon: ParsedPokemon | null;
  /** Its slot, so its boosts and crits reset when another Pokémon is opened. */
  slot: number;
  onChange: (updater: (team: Team) => Team) => void;
}

/**
 * The Team Builder's calculator panel: the Damage Calculator with your side
 * being the Pokémon open in the builder — edited there, not here — and one
 * opponent set up here (the calculator's own editor, its field and side
 * conditions). Both sides' moves are calced as on the calculator page (see
 * calcShared), and a calc saves onto this team's Calcs, filed under your
 * Pokémon (offensive when it's your move, defensive when it's theirs).
 */
export function BuilderCalculator({ team, pokemon, slot, onChange }: BuilderCalculatorProps) {
  const t = useMessages();
  const text = usePokemonText();
  const calcSets = useCalcSets();

  const [opponent, setOpponent] = useState<SidebarEntry>(() => ({
    pokemon: buildCustomPokemon(DEFAULT_SPECIES_KEY),
    isCustom: true,
  }));
  const [opponentMega, setOpponentMega] = useState(true);
  const [opponentState, setOpponentState] = useState<PokemonBattleState>(DEFAULT_BATTLE_STATE);
  const [opponentOverrides, setOpponentOverrides] = useState<StatOverrides>(NO_OVERRIDES);
  const [selectedMove, setSelectedMove] = useState<Selection | null>(null);

  // Your side's crits and hit counts (set on its move rows) belong to the
  // Pokémon: opening another one starts it fresh.
  const [yourState, setYourState] = useState({ slot, state: DEFAULT_BATTLE_STATE });
  if (yourState.slot !== slot) {
    setYourState({ slot, state: DEFAULT_BATTLE_STATE });
    setSelectedMove(null);
  }

  const [doubles, setDoubles] = useState(true);
  const [weather, setWeather] = useState<DamageCalcOptions["weather"]>(() =>
    resolveAutoWeather(pokemon, true),
  );
  const [terrain, setTerrain] = useState<DamageCalcOptions["terrain"]>(undefined);
  const [fairyAura, setFairyAura] = useState(false);
  const [gravity, setGravity] = useState(false);
  const [yourSide, setYourSide] = useState<SideConditions>(DEFAULT_SIDE_CONDITIONS);
  const [theirSide, setTheirSide] = useState<SideConditions>(DEFAULT_SIDE_CONDITIONS);

  // What a Pokémon's ability sets as it comes in — the weather (Drizzle, Mega
  // Charizard Y's Drought…) and Fairy Aura — as on the calculator page: only
  // ever turned on, and off by hand.
  function applyEntryAbility(mon: ParsedPokemon | null | undefined, mega: boolean) {
    const autoWeather = resolveAutoWeather(mon, mega);
    if (autoWeather) setWeather(autoWeather);
    if (resolveFieldAbility(mon, mega) === "Fairy Aura") setFairyAura(true);
  }
  const [appliedFor, setAppliedFor] = useState(slot);
  if (appliedFor !== slot) {
    setAppliedFor(slot);
    applyEntryAbility(pokemon, true);
  }

  function setOpponentPokemon(next: ParsedPokemon, fromSet?: SavedSetRef) {
    setOpponent({ pokemon: next, isCustom: true, fromSet });
    setSelectedMove(null);
    setOpponentState(DEFAULT_BATTLE_STATE);
    setOpponentOverrides(NO_OVERRIDES);
    applyEntryAbility(next, opponentMega);
  }

  function updateOpponent(patch: Partial<ParsedPokemon>) {
    setOpponent((entry) => ({ ...entry, pokemon: { ...entry.pokemon, ...patch } }));
  }

  // Your Pokémon as the builder has it, in its Mega form when it holds its stone.
  const yours = toEffectivePokemon(pokemon, true, NO_OVERRIDES);
  const theirs = toEffectivePokemon(opponent.pokemon, opponentMega, opponentOverrides);
  const field = { weather, terrain, fairyAura, gravity, doubles };
  const yourOptions = calcOptions(field, yourSide, theirSide, yourState.state, opponentState);
  const theirOptions = calcOptions(field, theirSide, yourSide, opponentState, yourState.state);

  function results(
    attacker: ParsedPokemon | undefined,
    defender: ParsedPokemon | undefined,
    options: DamageCalcOptions,
    state: PokemonBattleState,
  ) {
    if (!attacker || !defender) return [];
    // Empty slots stay in the set so moves keep their place; they aren't calced.
    return (attacker.moves ?? [])
      .filter((move) => move)
      .map((move) => ({
        move,
        result: calculateDamage(attacker, defender, move, forMove(options, state, move)),
      }));
  }
  const yourResults = results(yours, theirs, yourOptions, yourState.state);
  const theirResults = results(theirs, yours, theirOptions, opponentState);

  const isYourMove = selectedMove?.side === "attacker";
  const selectedResult = selectedMove
    ? (isYourMove ? yourResults : theirResults).find((entry) => entry.move === selectedMove.move)
        ?.result
    : null;

  if (!pokemon) {
    return <p className="text-sm text-zinc-500">{t.teamBuilder.calcPickPokemon}</p>;
  }

  // Filed under your Pokémon: offensive when it's your move, defensive when it's theirs.
  const species = speciesIdentity(pokemon.species);
  const saveCalc: SaveCalcTarget = {
    isSaved: (calcText) => hasSavedCalc(team.calcs ?? [], species, calcText),
    onSave: (calcText) => {
      if (hasSavedCalc(team.calcs ?? [], species, calcText)) return;
      const side: TeamCalcSide = isYourMove ? "offensive" : "defensive";
      onChange((current) => ({
        ...current,
        calcs: [...(current.calcs ?? []), { id: generateId(), text: calcText, species, side }],
      }));
      toast.success(
        t.calc.calcSaved(
          side === "offensive" ? t.calc.offensive : t.calc.defensive,
          text.species(pokemon.species),
          team.name,
        ),
      );
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <ResultPanel
        selectedMove={selectedMove}
        attacker={isYourMove ? yours : theirs}
        defender={isYourMove ? theirs : yours}
        leftPokemon={yours}
        rightPokemon={theirs}
        attackerBattleState={isYourMove ? yourState.state : opponentState}
        defenderBattleState={isYourMove ? opponentState : yourState.state}
        options={
          selectedMove
            ? forMove(
                isYourMove ? yourOptions : theirOptions,
                isYourMove ? yourState.state : opponentState,
                selectedMove.move,
              )
            : undefined
        }
        result={selectedResult}
        saveCalc={saveCalc}
      />

      <div className="grid gap-3 @xl:grid-cols-2">
        <MoveList
          title={t.teamBuilder.calcYourMoves(text.species(pokemon.species))}
          pokemon={yours}
          results={yourResults}
          side="attacker"
          selectedMove={selectedMove}
          onSelect={setSelectedMove}
          battleState={yourState.state}
          onBattleStateChange={(state) => setYourState({ slot, state })}
          ability={resolveFieldAbility(pokemon, true)}
        />
        <MoveList
          title={t.teamBuilder.calcTheirMoves(text.species(opponent.pokemon.species))}
          pokemon={theirs}
          results={theirResults}
          side="defender"
          selectedMove={selectedMove}
          onSelect={setSelectedMove}
          battleState={opponentState}
          onBattleStateChange={setOpponentState}
          ability={resolveFieldAbility(opponent.pokemon, opponentMega)}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          {t.teamBuilder.calcOpponent}
        </h3>
        <RosterPokemonPicker
          single
          title={t.teamBuilder.calcOpponent}
          sidebar={[opponent]}
          selectedIndex={0}
          onSelectIndex={() => {}}
          onAddPokemon={setOpponentPokemon}
          onReplacePokemon={setOpponentPokemon}
          onLinkSet={(fromSet) => setOpponent((entry) => ({ ...entry, fromSet }))}
          onSaveToSidebar={() => {}}
          onImportTeam={([first]) => first && setOpponentPokemon(first)}
          onRemovePokemon={() => {}}
          mega={opponentMega}
          onMegaChange={(mega) => {
            setOpponentMega(mega);
            if (mega) applyEntryAbility(opponent.pokemon, mega);
          }}
          weather={weather}
          terrain={terrain}
          tailwind={theirSide.tailwind}
          battleState={opponentState}
          onBattleStateChange={setOpponentState}
          statOverrides={opponentOverrides}
          onStatOverridesChange={setOpponentOverrides}
          onAbilityChange={(ability) => updateOpponent({ ability })}
          onItemChange={(item) => {
            updateOpponent({ item });
            applyEntryAbility({ ...opponent.pokemon, item }, opponentMega);
          }}
          onMovesChange={(moves) => updateOpponent({ moves })}
          calcSets={calcSets}
        />
      </section>

      {/* The field: closed by default — the opponent and the numbers come first. */}
      <details className="group flex flex-col gap-3 rounded-lg border border-zinc-200 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-zinc-700 hover:text-zinc-900">
          <Icon
            name={IconName.ExpandMore}
            size={18}
            className="-rotate-90 transition-transform group-open:rotate-0"
          />
          {t.calc.field}
          <span className="truncate text-xs font-normal text-zinc-500">
            {[
              doubles ? t.calc.doubles : t.calc.singles,
              weather && t.calc.weathers[weather],
              terrain && text.move(`${terrain} Terrain`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            <TogglePill active={doubles} onClick={() => setDoubles(true)}>
              {t.calc.doubles}
            </TogglePill>
            <TogglePill active={!doubles} onClick={() => setDoubles(false)}>
              {t.calc.singles}
            </TogglePill>
          </div>
          <div role="group" aria-label={t.calc.weather} className="flex flex-wrap gap-1.5">
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
          <div role="group" aria-label={t.calc.terrain} className="flex flex-wrap gap-1.5">
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
          <div className="flex flex-wrap gap-1.5">
            <TogglePill active={fairyAura} onClick={() => setFairyAura(!fairyAura)}>
              {text.ability("Fairy Aura")}
            </TogglePill>
            <TogglePill active={gravity} onClick={() => setGravity(!gravity)}>
              {text.move("Gravity")}
            </TogglePill>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 pt-3">
            <SideConditionsPanel
              title={t.calc.sideOf(text.species(pokemon.species))}
              conditions={yourSide}
              onToggle={(key) => setYourSide({ ...yourSide, [key]: !yourSide[key] })}
            />
            <SideConditionsPanel
              title={t.calc.sideOf(text.species(opponent.pokemon.species))}
              conditions={theirSide}
              onToggle={(key) => setTheirSide({ ...theirSide, [key]: !theirSide[key] })}
              align="right"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
