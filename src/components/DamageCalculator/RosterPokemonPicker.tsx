"use client";

import { useState } from "react";
import type { StatOverrides } from "@/lib/stats/applyStatOverrides";
import { parseTeam } from "@/lib/parseTeam";
import { formatPokemonPaste, formatTeamPaste } from "@/lib/formatPokemonPaste";
import { WEATHER_SPEED_DOUBLING_ABILITIES } from "@/constants";
import { REGULATIONS } from "@/data/regulations";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { toast } from "../Toast";
import { IconName } from "@/enums";
import { PokemonEditor, computePokemonBuild } from "../PokemonEditor";
import type { DamageCalcOptions, Opponent, ParsedPokemon, StatKey } from "@/types";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";

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
  /** Allies already fainted this battle — Last Respects gains 50 power per ally. */
  faintedAllies: number;
}

export const DEFAULT_BATTLE_STATE: PokemonBattleState = {
  status: "Healthy",
  currentHpPercent: 100,
  atkStage: 0,
  defStage: 0,
  spaStage: 0,
  spdStage: 0,
  speStage: 0,
  faintedAllies: 0,
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
  const { breakdown, effectiveAbility } = computePokemonBuild(pokemon, mega, statOverrides);

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
    abilityDoublesSpeed && effectiveAbility ? text.ability(effectiveAbility) : null,
    tailwind ? text.move("Tailwind") : null,
    battleState.speStage !== 0
      ? t.calcPanel.stage(`${battleState.speStage > 0 ? "+" : ""}${battleState.speStage}`)
      : null,
    battleState.status === "Paralyzed" ? t.calcPanel.statuses.Paralyzed : null,
  ].filter((source): source is string => !!source);
  const finalStats = breakdown?.final ?? null;
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
          {pokemon && sidebar.length < MAX_SIDEBAR_POKEMON && (
            <div className="flex items-center justify-end">
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
            </div>
          )}

          <PokemonEditor
            title={title}
            pokemon={pokemon}
            onSpeciesChange={(newPokemon) => {
              if (selectedIndex !== null) {
                onReplacePokemon(newPokemon);
              } else {
                onAddPokemon(newPokemon);
              }
            }}
            mega={mega}
            onMegaChange={onMegaChange}
            statOverrides={statOverrides}
            onStatOverridesChange={onStatOverridesChange}
            onAbilityChange={onAbilityChange}
            onItemChange={onItemChange}
            onMovesChange={onMovesChange}
            renderStatRowExtra={(stat) => {
              const stageKey = STAGE_KEY_BY_STAT[stat];
              if (!stageKey) return null;
              return (
                <select
                  value={battleState[stageKey]}
                  onChange={(event) =>
                    updateBattleState({ [stageKey]: Number(event.target.value) })
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
            }}
            renderFinalCell={(stat, value) => {
              if (stat !== "spe" || totalSpeedMultiplier === 1) return value;
              return (
                <span
                  title={t.calcPanel.speedHint(speedLabelParts.join(", "), roundedSpeedMultiplier)}
                >
                  {effectiveSpe}{" "}
                  <span className="text-zinc-500">
                    (×{roundedSpeedMultiplier} {speedLabelParts.join(", ")})
                  </span>
                </span>
              );
            }}
          >
            {breakdown && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                    {t.calcPanel.status}
                    <select
                      value={battleState.status}
                      onChange={(event) =>
                        updateBattleState({ status: event.target.value as PokemonStatus })
                      }
                      className="rounded border border-zinc-300 bg-zinc-50 px-1 py-0.5 text-xs text-zinc-900"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {t.calcPanel.statuses[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {pokemon?.moves?.some((move) => move === "Last Respects") && (
                    <label
                      title={t.calcPanel.faintedAlliesHint(text.move("Last Respects"))}
                      className="flex items-center gap-1.5 text-xs font-medium text-zinc-600"
                    >
                      {t.calcPanel.faintedAllies}
                      <select
                        value={battleState.faintedAllies ?? 0}
                        onChange={(event) =>
                          updateBattleState({ faintedAllies: Number(event.target.value) })
                        }
                        className="rounded border border-zinc-300 bg-zinc-50 px-1 py-0.5 text-xs text-zinc-900"
                      >
                        {[0, 1, 2, 3, 4, 5].map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-600">
                    {t.calcPanel.currentHp(currentHp, maxHp, battleState.currentHpPercent)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={battleState.currentHpPercent}
                    onChange={(event) =>
                      updateBattleState({ currentHpPercent: Number(event.target.value) })
                    }
                    aria-label={t.calcPanel.currentHpLabel(title)}
                    className="w-full accent-zinc-600"
                  />
                </div>
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
