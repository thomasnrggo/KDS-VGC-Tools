"use client";

/**
 * The Damage Calculator's parts that other screens reuse — the move lists,
 * the result readout (with its Showdown-format line, copy and save), the
 * side conditions, and the options and effective Pokémon behind every calc —
 * so the Team Builder's calculator panel computes and saves exactly what the
 * calculator page does.
 */

import { Select } from "@/components/Select";
import type { ReactNode } from "react";
import { calculateDamage, moveHitRange } from "@/lib/damage/calculateDamage";
import { applyStatOverrides, type StatOverrides } from "@/lib/stats/applyStatOverrides";
import { calculateStatBreakdown } from "@/lib/stats/calculateFinalStats";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { megaDisplayName } from "@/lib/species/megaForm";
import { TYPE_COLORS, WEATHER_SETTING_ABILITIES } from "@/constants";
import movesData from "@/data/moves.json";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { EFFECT_MOVES, type PokemonBattleState } from "./RosterPokemonPicker";
import { STAT_LABELS } from "../PokemonEditor";
import { Icon } from "../Icon";
import { IconButton, TogglePill } from "../Button";
import { toast } from "../Toast";
import { PokemonSprite } from "../PokemonSprite";
import { TypeIcon } from "../TypeIcon";
import { IconName } from "@/enums";
import type { DamageCalcOptions, DamageResult, MoveData, ParsedPokemon } from "@/types";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

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
export function formatCalculationLabel(
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
  const spreadLabel =
    result.isSpreadMove && options?.attackerHitsMultipleTargets ? " (spread)" : "";

  const attackerStage = attackerBattleState[STAGE_FIELD_BY_ATTACK_STAT[result.attackStatKey]];
  const defenderStage = defenderBattleState[STAGE_FIELD_BY_DEFENSE_STAT[result.defenseStatKey]];
  const attackToken = formatStatToken(attackerSp, attackerStage, STAT_LABELS[result.attackStatKey]);
  const defenseToken = formatStatToken(
    defenderDefSp,
    defenderStage,
    STAT_LABELS[result.defenseStatKey],
  );

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
    const ability = abilityApplied
      ? resolveEffectiveAbility(mon.species, mon.item, mon.ability)
      : undefined;
    return [
      mega ? undefined : mon.item,
      ability,
      burned ? "burned" : undefined,
      mega ?? mon.species,
    ]
      .filter(Boolean)
      .join(" ");
  };
  const fairyAuraLabel = result.fairyAuraApplied ? "Fairy Aura boosted " : "";

  return `${attackToken} ${describe(attacker, result.attackerAbilityApplied, !!result.burnApplied)} ${helpingHandLabel}${fairyAuraLabel}${moveName}${hitsLabel}${spreadLabel} vs. ${defenderHpSp} HP / ${defenseToken} ${describe(defender, result.defenderAbilityApplied, false)}${fieldLabel}${throughLabel}`;
}

// No "None" option: clicking the active weather/terrain again clears it.
export const WEATHER_OPTIONS: Array<NonNullable<DamageCalcOptions["weather"]>> = [
  "Sun",
  "Rain",
  "Sand",
  "Snow",
];
export const TERRAIN_OPTIONS: Array<NonNullable<DamageCalcOptions["terrain"]>> = [
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
export interface SideConditions {
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
  helpingHand: boolean;
  friendGuard: boolean;
  protect: boolean;
  tailwind: boolean;
}

export const DEFAULT_SIDE_CONDITIONS: SideConditions = {
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
  helpingHand: false,
  friendGuard: false,
  protect: false,
  tailwind: false,
};

export function toEffectivePokemon(
  pokemon: ParsedPokemon | null | undefined,
  mega: boolean,
  statOverrides: StatOverrides,
): ParsedPokemon | undefined {
  if (!pokemon) return undefined;
  const megaApplied = mega ? pokemon : { ...pokemon, item: undefined };
  return applyStatOverrides(megaApplied, statOverrides);
}

/** A Pokémon with a weather-setting ability (Drought, Drizzle, Sand Stream, Snow Warning) auto-sets the Field's weather when selected — doesn't clear it when switching to a Pokémon without one, only sets it forward. */
/** The ability a Pokémon has on the field: its Mega form's when the Mega toggle is on. */
export function resolveFieldAbility(
  pokemon: ParsedPokemon | null | undefined,
  mega: boolean,
): string | undefined {
  if (!pokemon) return undefined;
  return resolveEffectiveAbility(pokemon.species, mega ? pokemon.item : undefined, pokemon.ability);
}

export function resolveAutoWeather(
  pokemon: ParsedPokemon | null | undefined,
  mega: boolean,
): DamageCalcOptions["weather"] | undefined {
  const ability = resolveFieldAbility(pokemon, mega);
  return ability ? WEATHER_SETTING_ABILITIES[ability] : undefined;
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

export type SaveCalcTarget =
  | { onSave: (text: string) => void; isSaved: (text: string) => boolean }
  | { disabledReason: string };

/** The compact middle column between the two move lists — mirrors the reference calculator's layout of putting the result readout between both Pokémon's move lists instead of below them. */
export function ResultPanel({
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
    <div className={cn("flex flex-col gap-1.5 self-start", className)}>
      {/* Invisible spacer matching MoveList's heading block exactly, so the visible card below starts level with the top move row instead of the "MOVES" heading above it — only needed when they sit side by side. */}
      <div className="invisible hidden xl:block" aria-hidden="true">
        <h3 className="text-xs font-semibold tracking-wide uppercase">{t.calc.result}</h3>
        <p className="text-[11px]">{t.calc.clickMove}</p>
      </div>
      {/* Highlighted once there's a result: the calc line is the page's answer, so it gets the same
          soft amber as the app's other callouts (Speed Tiers' highlighted rows, the regulation badge). */}
      <div
        className={cn(
          "flex flex-col justify-center gap-2 rounded-lg border p-3 sm:p-4",
          result
            ? "border-amber-300 bg-amber-50 dark:border-amber-800/70 dark:bg-amber-950/40"
            : "border-zinc-200 bg-zinc-50",
        )}
      >
        {/* Desktop only — on phones the side tabs above already show both Pokémon. */}
        {leftPokemon && rightPokemon && (
          <div className="hidden items-center justify-center gap-3 lg:flex">
            <PokemonSprite species={leftPokemon.species} item={leftPokemon.item} size={48} />
            <span className="text-xs font-semibold text-zinc-400 uppercase">vs</span>
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
                  <p className="text-xs text-zinc-600" title={t.calc.recoilHint}>
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
                    <IconButton
                      onClick={copyResultLine}
                      aria-label={t.calc.copyCalc}
                      title={t.calc.copyCalc}
                    >
                      <Icon name={IconName.ContentCopy} size={16} />
                    </IconButton>
                    <IconButton
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
                    >
                      <Icon name={alreadySaved ? IconName.Check : IconName.BookmarkAdd} size={16} />
                    </IconButton>
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
  /** Which edge the title sits on — the right side's panel mirrors the left. */
  align?: "left" | "right";
}

export function SideConditionsPanel({
  title,
  conditions,
  onToggle,
  align = "left",
}: SideConditionsPanelProps) {
  const text = usePokemonText();
  return (
    <div className="flex flex-col gap-1.5">
      {/* Each side's label sits on its own edge, matching where that Pokémon is on the page. */}
      <span className={cn("text-xs font-medium text-zinc-600", align === "right" && "text-right")}>
        {title}
      </span>
      <div className="flex flex-col gap-1.5">
        <TogglePill
          active={conditions.protect}
          onClick={() => onToggle("protect")}
          className="w-full"
        >
          {text.move("Protect")}
        </TogglePill>
        <TogglePill
          active={conditions.helpingHand}
          onClick={() => onToggle("helpingHand")}
          className="w-full"
        >
          {text.move("Helping Hand")}
        </TogglePill>
        <TogglePill
          active={conditions.auroraVeil}
          onClick={() => onToggle("auroraVeil")}
          className="w-full"
        >
          {text.move("Aurora Veil")}
        </TogglePill>
        {/* Side by side when they fit, otherwise one per line — never squeezed onto two lines of text. */}
        <div className="flex flex-wrap gap-1.5">
          <TogglePill
            active={conditions.reflect}
            onClick={() => onToggle("reflect")}
            className="flex-1 whitespace-nowrap"
          >
            {text.move("Reflect")}
          </TogglePill>
          <TogglePill
            active={conditions.lightScreen}
            onClick={() => onToggle("lightScreen")}
            className="flex-1 whitespace-nowrap"
          >
            {text.move("Light Screen")}
          </TogglePill>
        </div>
        <TogglePill
          active={conditions.tailwind}
          onClick={() => onToggle("tailwind")}
          className="w-full"
        >
          {text.move("Tailwind")}
        </TogglePill>
        <TogglePill
          active={conditions.friendGuard}
          onClick={() => onToggle("friendGuard")}
          className="w-full"
        >
          {text.ability("Friend Guard")}
        </TogglePill>
      </div>
    </div>
  );
}

/** e.g. "(15.8 - 18.6% recoil)" for a real recoil move (min/max vary with the roll, same "N - M" spacing as the reference calculator), or "(9.6% recoil)" for Life Orb alone (a flat cost — min and max come out equal, so just the one number). Empty string when the move has neither. */
export function formatRecoilNote(result: ReturnType<typeof calculateDamage>, t: Messages): string {
  if (!result || result.recoilMinPercent === undefined) return "";
  return ` ${t.calc.recoil(
    result.recoilMinPercent === result.recoilMaxPercent
      ? `${result.recoilMinPercent}`
      : `${result.recoilMinPercent} - ${result.recoilMaxPercent}`,
  )}`;
}

export function formatMoveResultLabel(
  result: ReturnType<typeof calculateDamage>,
  t: Messages,
): string {
  if (!result) return "—";
  if (result.koChanceText === "immune") return t.calc.immune;
  if (result.koChanceText === "blocked by Protect") return t.calc.protected;
  return `${result.minPercent}-${result.maxPercent}%${formatRecoilNote(result, t)}`;
}

export const MOVES = movesData as unknown as Record<string, MoveData>;

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

export function countRange(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

export function MoveList({
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
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-semibold tracking-wide text-zinc-500 uppercase">
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
                className={cn(
                  "relative flex h-10 items-center overflow-hidden rounded-full border text-sm shadow-sm transition-colors",
                  isSelected
                    ? "border-chrome-600 bg-chrome-600 font-semibold text-white"
                    : "border-zinc-300 bg-raised text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-200",
                )}
              >
                {/* The whole row selects the move: this button sits behind the content
                    (which ignores clicks), and only the Crit/Effect controls sit above it. */}
                <button
                  type="button"
                  onClick={() => onSelect({ side, move })}
                  aria-pressed={isSelected}
                  aria-label={`${text.move(move)}: ${formatMoveResultLabel(result, t)}`}
                  className="absolute inset-0 rounded-full focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none focus-visible:ring-inset"
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
                <span
                  aria-hidden="true"
                  className="pointer-events-none relative ml-3 min-w-0 truncate"
                >
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
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                          isCrit
                            ? isSelected
                              ? "border-white bg-white text-zinc-900"
                              : "border-zinc-600 bg-chrome-600 text-white"
                            : controlClassName,
                        )}
                      >
                        {t.calcPanel.crit}
                      </button>
                    )}
                    {effect && (
                      <Select
                        variant="compact"
                        value={String(battleState.moveCounts[move] ?? 0)}
                        onChange={(value) => setCount(Number(value))}
                        ariaLabel={t.calcPanel.effectLabel(text.move(move))}
                        title={t.calcPanel.effectHints[effect.option](text.move(move))}
                        options={countRange(0, effect.max).map((count) => ({
                          value: String(count),
                          label: t.calcPanel.effectCount(count),
                        }))}
                        className={controlClassName}
                      />
                    )}
                    {hitRange && (
                      <Select
                        variant="compact"
                        value={String(battleState.moveCounts[move] ?? hitRange.default)}
                        onChange={(value) => setCount(Number(value))}
                        ariaLabel={t.calcPanel.hitsLabel(text.move(move))}
                        options={countRange(hitRange.min, hitRange.max).map((count) => ({
                          value: String(count),
                          label: t.calcPanel.hitsCount(count),
                        }))}
                        className={controlClassName}
                      />
                    )}
                  </div>
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none relative ml-auto shrink-0 pr-4 pl-3 tabular-nums",
                    isSelected ? "text-chrome-200" : "font-medium text-zinc-600",
                  )}
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

/** The field-wide settings every calc shares (the calculator's Field). */
export interface CalcField {
  weather?: DamageCalcOptions["weather"];
  terrain?: DamageCalcOptions["terrain"];
  fairyAura: boolean;
  gravity: boolean;
  doubles: boolean;
}

/**
 * The options for whichever side is attacking in one direction —
 * burn/status/stat stages/Helping Hand belong to the attacking side,
 * screens/Friend Guard/Protect/current HP belong to the defending side, so
 * which SideConditions/PokemonBattleState plays which role flips between the
 * two directions.
 */
export function calcOptions(
  { weather, terrain, fairyAura, gravity, doubles }: CalcField,
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
    attackerHitsMultipleTargets: doubles,
    isDoublesFormat: doubles,
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
export function forMove(
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
