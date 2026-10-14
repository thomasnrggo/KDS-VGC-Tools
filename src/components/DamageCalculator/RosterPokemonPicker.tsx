"use client";

import { useState } from "react";
import type { StatOverrides } from "@/lib/stats/applyStatOverrides";
import { parseTeam } from "@/lib/parseTeam";
import { formatPokemonPaste, formatTeamPaste } from "@/lib/formatPokemonPaste";
import movesData from "@/data/moves.json";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { moveHitRange } from "@/lib/damage/calculateDamage";
import { MAX_TOTAL_STAT_POINTS } from "@/lib/stats/calculateFinalStats";
import {
  computeBattleStat,
  type BattleStatContext,
  type BattleStatSource,
} from "@/lib/stats/battleStats";
import { REGULATIONS } from "@/data/regulations";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { toast } from "../Toast";
import { IconName } from "@/enums";
import { PokemonEditor, computePokemonBuild } from "../PokemonEditor";
import { PokemonSetPicker } from "./PokemonSetPicker";
import type { DamageCalcOptions, MoveData, Opponent, ParsedPokemon, StatKey } from "@/types";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";

const MOVES = movesData as unknown as Record<string, MoveData>;

/** One entry in a side's sidebar — the working roster for that side, up to MAX_SIDEBAR_POKEMON. `isCustom` tracks whether this entry came from the species search (freely editable ability/item/moves) or was loaded from a real pasted team (read-only identity). */
export interface SidebarEntry {
  pokemon: ParsedPokemon;
  isCustom: boolean;
}

export const MAX_SIDEBAR_POKEMON = 6;

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
  /** Moves toggled to land as critical hits (each move's Crit button). */
  critMoves: string[];
  /** Per move: its Effect count (EFFECT_MOVES) or, for a multi-hit move, how many hits land. */
  moveCounts: Record<string, number>;
}

export const DEFAULT_BATTLE_STATE: PokemonBattleState = {
  status: "Healthy",
  currentHpPercent: 100,
  atkStage: 0,
  defStage: 0,
  spaStage: 0,
  spdStage: 0,
  speStage: 0,
  critMoves: [],
  moveCounts: {},
};

/**
 * Moves whose power depends on something the calc can't see — set per move
 * with an "Effect" count: the option it feeds and its highest value.
 */
export const EFFECT_MOVES: Record<
  string,
  { option: "attackerFaintedAllies" | "attackerTimesHit"; max: number }
> = {
  "Last Respects": { option: "attackerFaintedAllies", max: 5 },
  "Rage Fist": { option: "attackerTimesHit", max: 6 },
};

const moveCountSelectClassName =
  "min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

function countRange(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

const STAGE_OPTIONS = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6];

const STAGE_KEY_BY_STAT: Partial<
  Record<StatKey, "atkStage" | "defStage" | "spaStage" | "spdStage" | "speStage">
> = {
  atk: "atkStage",
  def: "defStage",
  spa: "spaStage",
  spd: "spdStage",
  spe: "speStage",
};

interface RosterPokemonPickerProps {
  title: string;
  /** This side's working roster (up to MAX_SIDEBAR_POKEMON) — the sidebar strip's content, and the source of the currently displayed Pokémon (`sidebar[selectedIndex]`). Seeded differently per side by DamageCalculator.tsx (Attacker from the header's active team if any, Defender starts with a single default species) but edited identically here. */
  sidebar: SidebarEntry[];
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  /** The main species search's fallback when nothing is selected yet (an empty sidebar) — appends a fresh custom Pokémon, since there's no existing entry for `onReplacePokemon` to swap in place. */
  onAddPokemon: (pokemon: ParsedPokemon) => void;
  /** The main species search's onSelect target when a Pokémon is already selected — swaps that entry's species in place (the search input shows the current species as its value, so picking a new one reads as "change this Pokémon," not "add another"). */
  onReplacePokemon: (pokemon: ParsedPokemon) => void;
  /** Appends a copy of the currently displayed Pokémon (species, ability, item, nature, Stat Points, moves — everything as currently configured) as a new sidebar entry and selects it, ready for further editing — the "Save" icon's action, and now the only way (besides Import/Load Team) to grow the roster past one entry, since the old "+" tile is gone. Only called while sidebar.length < MAX_SIDEBAR_POKEMON (the button itself is hidden past the cap). */
  onSaveToSidebar: () => void;
  /** Importing more than one Pokémon at once (a full team paste) replaces this side's whole sidebar rather than appending, since a multi-mon paste represents "this is my team," not "add one more." */
  onImportTeam: (pokemon: ParsedPokemon[]) => void;
  onRemovePokemon: (index: number) => void;
  mega: boolean;
  onMegaChange: (mega: boolean) => void;
  weather?: DamageCalcOptions["weather"];
  terrain?: DamageCalcOptions["terrain"];
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
  onReplacePokemon,
  onSaveToSidebar,
  onImportTeam,
  onRemovePokemon,
  mega,
  onMegaChange,
  weather,
  terrain,
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
  const t = useMessages();
  const text = usePokemonText();
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
      setImportError(t.calcPanel.importEmpty);
      return;
    }
    try {
      const parsed = parseTeam(trimmed);
      if (parsed.length === 0) {
        setImportError(t.calcPanel.importInvalid);
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
      setImportError(t.calcPanel.importInvalid);
    }
  }

  function closeImport() {
    setIsImportOpen(false);
    setImportText("");
    setImportError(null);
  }

  // `title` is translated, so ids come from a stable slug of it.
  const idBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const importModalTitleId = `${idBase}-import-modal-title`;
  const loadOpponentModalTitleId = `${idBase}-load-opponent-modal-title`;

  function loadOpponentTeam(opponent: Opponent) {
    onImportTeam(opponent.team.pokemon.slice(0, MAX_SIDEBAR_POKEMON));
    setIsLoadOpponentOpen(false);
    toast.success(t.calcPanel.loaded(opponent.label, title));
  }

  async function copyPokemonExportText(target: ParsedPokemon) {
    try {
      await navigator.clipboard.writeText(formatPokemonPaste(target));
      toast.success(t.calcPanel.copied(text.species(target.species)));
    } catch {
      toast.error(t.calcPanel.copyFailed);
    }
  }

  const teamExportText = formatTeamPaste(sidebar.map((entry) => entry.pokemon));
  const exportTeamModalTitleId = `${idBase}-export-team-modal-title`;

  async function copyTeamExportText() {
    try {
      await navigator.clipboard.writeText(teamExportText);
      toast.success(t.calcPanel.copiedTeam(title, sidebar.length));
    } catch {
      toast.error(t.calcPanel.copyFailed);
    }
  }

  // Same derivation PokemonEditor uses internally — called again here (pure,
  // cheap) rather than threaded back out of it, since this component also
  // needs the breakdown/effectiveAbility for battle-state-dependent values
  // (the Speed multiplier row, the HP bar) that the editor itself has no
  // concept of.
  const { breakdown, effectiveAbility, effectivePokemon, hasMegaForm, types } = computePokemonBuild(
    pokemon,
    mega,
    statOverrides,
  );

  const finalStats = breakdown?.final ?? null;
  const battleStatContext: BattleStatContext | null = finalStats && {
    stats: finalStats,
    stages: {
      atk: battleState.atkStage,
      def: battleState.defStage,
      spa: battleState.spaStage,
      spd: battleState.spdStage,
      spe: battleState.speStage,
    },
    item: effectivePokemon?.item,
    ability: effectiveAbility,
    types,
    statused: battleState.status !== "Healthy",
    paralyzed: battleState.status === "Paralyzed",
    weather,
    terrain,
    tailwind,
  };

  function describeSource(source: BattleStatSource): string {
    switch (source.kind) {
      case "stage":
        return t.calcPanel.stage(`${source.stage > 0 ? "+" : ""}${source.stage}`);
      case "item":
        return text.item(source.name);
      case "ability":
        return text.ability(source.name);
      case "weather":
        return t.calc.weathers[source.weather];
      case "tailwind":
        return text.move("Tailwind");
      case "paralysis":
        return t.calcPanel.statuses.Paralyzed;
    }
  }

  function renderBattleStat(stat: StatKey) {
    if (stat === "hp" || !battleStatContext || !finalStats) return null;
    const { value, sources } = computeBattleStat(stat, battleStatContext);
    // Compared with the stat-screen value (Speed before its item).
    const screenValue =
      stat === "spe" ? (finalStats.speedBeforeItem ?? finalStats.spe) : finalStats[stat];
    // Fixed width either way, so a value appearing doesn't shift the row.
    if (value === screenValue) return <span className="w-7" />;
    return (
      <span
        className={`w-7 text-right font-medium tabular-nums ${value > screenValue ? "text-red-600" : "text-blue-600"}`}
        title={
          sources.length > 0
            ? t.calcPanel.battleStatHint(sources.map(describeSource).join(", "))
            : undefined
        }
      >
        {value}
      </span>
    );
  }

  const maxHp = finalStats?.hp ?? 0;
  const currentHp = Math.max(1, Math.round((battleState.currentHpPercent / 100) * maxHp));

  function updateBattleState(patch: Partial<PokemonBattleState>) {
    onBattleStateChange({ ...battleState, ...patch });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>

      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-3">
        <span className="text-xs font-medium text-zinc-500">
          {t.calcPanel.regulation(REGULATIONS[0].label)}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          {loadableOpponents && (
            <button
              type="button"
              onClick={() => setIsLoadOpponentOpen(true)}
              aria-label={t.calcPanel.loadTeamLabel(title)}
              title={t.calcPanel.loadTeamHint}
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              <Icon name={IconName.Download} size={14} />
              {t.calcPanel.loadTeam}
            </button>
          )}
          {sidebar.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExportTeamOpen(true)}
              aria-label={t.calcPanel.exportTeamLabel(title)}
              title={t.calcPanel.exportTeamHint}
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              <Icon name={IconName.ContentCopy} size={14} />
              {t.calcPanel.exportTeam}
            </button>
          )}
          {pokemon && (
            <button
              type="button"
              onClick={() => copyPokemonExportText(pokemon)}
              aria-label={t.calcPanel.exportSetLabel(title)}
              title={t.calcPanel.exportSetHint}
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              <Icon name={IconName.ContentCopy} size={14} />
              {t.calcPanel.exportSet}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsImportOpen(true);
              setImportError(null);
            }}
            aria-label={t.calcPanel.importLabel(title)}
            title={t.calcPanel.importHint}
            className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700"
          >
            <Icon name={IconName.ContentPaste} size={14} />
            {t.calcPanel.import}
          </button>
        </div>
      </div>

      {isImportOpen && (
        <Modal onClose={closeImport} labelledBy={importModalTitleId}>
          <h2 id={importModalTitleId} className="mb-1 text-lg font-semibold text-zinc-900">
            {t.calcPanel.importTitle(title)}
          </h2>
          <p className="mb-4 text-sm text-zinc-600">{t.calcPanel.importIntro}</p>
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
            aria-label={t.calcPanel.importTextLabel(title)}
            className="w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
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
              className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
            >
              {t.calcPanel.import}
            </button>
            <button
              type="button"
              onClick={closeImport}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {isLoadOpponentOpen && loadableOpponents && (
        <Modal onClose={() => setIsLoadOpponentOpen(false)} labelledBy={loadOpponentModalTitleId}>
          <h2 id={loadOpponentModalTitleId} className="mb-1 text-lg font-semibold text-zinc-900">
            {t.calcPanel.loadTitle(title)}
          </h2>
          <p className="mb-4 text-sm text-zinc-600">{t.calcPanel.loadIntro}</p>
          {loadableOpponents.length === 0 ? (
            <p className="text-sm text-zinc-600">
              {t.calcPanel.noOpponents}
            </p>
          ) : (
            <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
              {loadableOpponents.map((opponent) => (
                <button
                  key={opponent.id}
                  type="button"
                  onClick={() => loadOpponentTeam(opponent)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left hover:bg-zinc-100"
                >
                  <span className="truncate text-sm font-medium text-zinc-900">{opponent.label}</span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {t.calcPanel.pokemonCount(opponent.team.pokemon.length)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setIsLoadOpponentOpen(false)}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {isExportTeamOpen && (
        <Modal onClose={() => setIsExportTeamOpen(false)} labelledBy={exportTeamModalTitleId}>
          <h2 id={exportTeamModalTitleId} className="mb-1 text-lg font-semibold text-zinc-900">
            {t.calcPanel.exportTitle(title)}
          </h2>
          <p className="mb-4 text-sm text-zinc-600">{t.calcPanel.exportIntro(sidebar.length)}</p>
          <textarea
            readOnly
            value={teamExportText}
            rows={12}
            onFocus={(event) => event.target.select()}
            aria-label={t.calcPanel.exportTextLabel(title)}
            className="w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={copyTeamExportText}
              className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
            >
              {t.calcPanel.copyToClipboard}
            </button>
            <button
              type="button"
              onClick={() => setIsExportTeamOpen(false)}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {t.common.close}
            </button>
          </div>
        </Modal>
      )}

      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            <PokemonSetPicker
              title={title}
              pokemon={pokemon}
              onSelect={(newPokemon) => {
                if (selectedIndex !== null) {
                  onReplacePokemon(newPokemon);
                } else {
                  onAddPokemon(newPokemon);
                }
              }}
            />
            {hasMegaForm && (
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
                {t.editor.mega}
              </button>
            )}
            {pokemon && sidebar.length < MAX_SIDEBAR_POKEMON && (
              <button
                type="button"
                onClick={() => {
                  onSaveToSidebar();
                  toast.success(t.calcPanel.saved(text.species(pokemon.species), title));
                }}
                aria-label={t.calcPanel.saveLabel(title)}
                title={t.calcPanel.saveHint}
                className="flex shrink-0 h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                <Icon name={IconName.Add} size={14} />
              </button>
            )}
          </div>

          <PokemonEditor
            title={title}
            pokemon={pokemon}
            mega={mega}
            statOverrides={statOverrides}
            onStatOverridesChange={onStatOverridesChange}
            onAbilityChange={onAbilityChange}
            onItemChange={onItemChange}
            onMovesChange={onMovesChange}
            simpleFields
            renderMoveExtra={(move) => {
              const isCrit = battleState.critMoves.includes(move);
              const isStatusMove = MOVES[normalizeSpeciesKey(move)]?.category === "Status";
              const effect = EFFECT_MOVES[move];
              const hitRange = moveHitRange(move, effectiveAbility);
              const setCount = (count: number) =>
                updateBattleState({ moveCounts: { ...battleState.moveCounts, [move]: count } });
              return (
                <>
                  {!isStatusMove && (
                    <button
                      type="button"
                      onClick={() =>
                        updateBattleState({
                          critMoves: isCrit
                            ? battleState.critMoves.filter((m) => m !== move)
                            : [...battleState.critMoves, move],
                        })
                      }
                      aria-pressed={isCrit}
                      aria-label={t.calcPanel.critLabel(text.move(move))}
                      className={`shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isCrit
                          ? "border-zinc-600 bg-zinc-600 text-white dark:bg-zinc-400"
                          : "border-zinc-300 text-zinc-500 hover:bg-zinc-100"
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
                      className={moveCountSelectClassName}
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
                      className={moveCountSelectClassName}
                    >
                      {countRange(hitRange.min, hitRange.max).map((count) => (
                        <option key={count} value={count}>
                          {t.calcPanel.hitsCount(count)}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              );
            }}
            maxTotalStatPoints={MAX_TOTAL_STAT_POINTS}
            extraStatColumns={[
              {
                id: "stage",
                header: t.editor.stage,
                render: (stat) => {
                  const stageKey = STAGE_KEY_BY_STAT[stat];
                  if (!stageKey) return null;
                  return (
                    <select
                      value={battleState[stageKey]}
                      onChange={(event) =>
                        updateBattleState({
                          [stageKey]: Number(event.target.value),
                        })
                      }
                      aria-label={t.calcPanel.stageLabel(title, t.stats.short[stat])}
                      className="rounded border border-zinc-300 bg-zinc-50 px-1 py-0.5 text-xs text-zinc-900"
                    >
                      {STAGE_OPTIONS.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage > 0 ? `+${stage}` : stage === 0 ? "--" : stage}
                        </option>
                      ))}
                    </select>
                  );
                },
              },
              { id: "battle", render: renderBattleStat },
            ]}
            // The stat screen's Speed, without its item — the Battle column
            // adds Choice Scarf/Iron Ball with everything else.
            renderFinalCell={(stat, value) =>
              stat === "spe" ? (finalStats?.speedBeforeItem ?? value) : value
            }
          >
            {breakdown && (
              <div className="flex items-center gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-zinc-600">
                  <span className="tabular-nums">
                    {t.calcPanel.currentHp(currentHp, maxHp, battleState.currentHpPercent)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={battleState.currentHpPercent}
                    onChange={(event) =>
                      updateBattleState({
                        currentHpPercent: Number(event.target.value),
                      })
                    }
                    aria-label={t.calcPanel.currentHpLabel(title)}
                    className="w-full accent-zinc-600"
                  />
                </label>
                <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-600">
                  {t.calcPanel.status}
                  <select
                    value={battleState.status}
                    onChange={(event) =>
                      updateBattleState({
                        status: event.target.value as PokemonStatus,
                      })
                    }
                    className="rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {t.calcPanel.statuses[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </PokemonEditor>
        </div>

        <div
          className="flex shrink-0 flex-col gap-1.5 border-l border-zinc-200 pl-3"
          role="listbox"
          aria-label={t.calcPanel.sidebar(title)}
        >
          {sidebar.map((entry, index) => {
            const isSelected = selectedIndex === index;
            return (
              <div key={index} className="flex items-center gap-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  title={
                    entry.pokemon.item
                      ? `${text.species(entry.pokemon.species)} @ ${text.item(entry.pokemon.item)}`
                      : text.species(entry.pokemon.species)
                  }
                  onClick={() => onSelectIndex(index)}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 bg-zinc-50 transition-colors ${
                    isSelected
                      ? "border-zinc-600"
                      : "border-transparent hover:border-zinc-300"
                  }`}
                >
                  <PokemonSprite species={entry.pokemon.species} fill />
                  {entry.pokemon.item && (
                    <span className="absolute -bottom-1 -right-1">
                      <ItemIcon item={entry.pokemon.item} size={16} />
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => copyPokemonExportText(entry.pokemon)}
                    aria-label={t.calcPanel.copyAsExport(text.species(entry.pokemon.species))}
                    title={t.calcPanel.copyAsExportHint}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name={IconName.ContentCopy} size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePokemon(index)}
                    aria-label={t.calcPanel.remove(text.species(entry.pokemon.species))}
                    title={t.calcPanel.remove(text.species(entry.pokemon.species))}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                  >
                    <Icon name={IconName.Close} size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
