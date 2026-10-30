"use client";

import { Select } from "@/components/Select";
import { useEffect, useRef, useState } from "react";
import { applyStatOverrides, type StatOverrides } from "@/lib/stats/applyStatOverrides";
import { parseTeam } from "@/lib/parseTeam";
import { FLOW_ROOT } from "@/lib/fieldFlow";
import { formatPokemonPaste, formatTeamPaste } from "@/lib/formatPokemonPaste";
import { MAX_TOTAL_STAT_POINTS } from "@/lib/stats/calculateFinalStats";
import {
  computeBattleStat,
  type BattleStatContext,
  type BattleStatSource,
} from "@/lib/stats/battleStats";
import { ACTIVATED_SPEED_DOUBLING_ABILITIES } from "@/constants";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Icon } from "../Icon";
import { Modal, ModalActions, ModalDescription, ModalTitle } from "../Modal";
import { Button, IconButton, TextAction, TogglePill } from "../Button";
import { Textarea } from "../Textarea";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { SearchableSelect } from "../SearchableSelect";
import { useIsPhone } from "@/hooks/useIsPhone";
import { toast } from "../Toast";
import { IconName } from "@/enums";
import {
  DEFAULT_SPECIES_KEY,
  PokemonEditor,
  buildCustomPokemon,
  computePokemonBuild,
} from "../PokemonEditor";
import { PokemonSetPicker } from "./PokemonSetPicker";
import { LoadTeamDialog } from "./LoadTeamDialog";
import type { DamageCalcOptions, Opponent, ParsedPokemon, StatKey } from "@/types";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import type { CalcSetsApi, SavedSetRef } from "@/hooks/useCalcSets";
import { findSameNameSet } from "@/lib/calcSets";
import { Slider } from "@/components/Slider";

/** One entry in a side's sidebar — the working roster for that side, up to MAX_SIDEBAR_POKEMON. `isCustom` tracks whether this entry came from the species search (freely editable ability/item/moves) or was loaded from a real pasted team (read-only identity). */
export interface SidebarEntry {
  pokemon: ParsedPokemon;
  isCustom: boolean;
  /** The saved set this entry was picked from or last saved as — "Save set" prefills its name so saving overwrites it. */
  fromSet?: SavedSetRef;
}

export const MAX_SIDEBAR_POKEMON = 6;

/** The standard 7-value status list — only Burned (damage) and Paralyzed (Speed) currently change any computed number; the rest are tracked for reference only, same as the reference calculator's dropdown. */
export type PokemonStatus =
  "Healthy" | "Burned" | "Poisoned" | "Badly Poisoned" | "Paralyzed" | "Asleep" | "Frozen";

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
  /** An ability that needs something to happen first is on (Unburden: its item is gone). */
  abilityActive?: boolean;
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
  onAddPokemon: (pokemon: ParsedPokemon, fromSet?: SavedSetRef) => void;
  /** The main species search's onSelect target when a Pokémon is already selected — swaps that entry's species in place (the search input shows the current species as its value, so picking a new one reads as "change this Pokémon," not "add another"). */
  onReplacePokemon: (pokemon: ParsedPokemon, fromSet?: SavedSetRef) => void;
  /** Links the open entry to the set it was just saved as. */
  onLinkSet: (fromSet: SavedSetRef) => void;
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
  /** Your saved opponents, for "Load Team" (which can also switch to a prep group's list, see LoadTeamDialog) — only passed for the Defender side (the Attacker already seeds from the header's active team), so the button only renders there. */
  loadableOpponents?: Opponent[];
  /** Saved sets (the user's own and public ones) — listed in the species picker, and where "Save set" writes. */
  calcSets: CalcSetsApi;
  /** Extra classes on the card (e.g. hiding it while the other side's tab is open on phones). */
  className?: string;
}

export function RosterPokemonPicker({
  title,
  sidebar,
  selectedIndex,
  onSelectIndex,
  onAddPokemon,
  onReplacePokemon,
  onLinkSet,
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
  calcSets,
  className = "",
}: RosterPokemonPickerProps) {
  const t = useMessages();
  const isPhone = useIsPhone();
  const text = usePokemonText();
  // Which import dialog is open: one Pokémon (added to the roster) or a whole team (replacing it).
  const [importMode, setImportMode] = useState<"pokemon" | "team" | null>(null);
  // Phones: the import/export actions live in a bottom sheet instead of a row of links.
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  // From sm up: the less-used actions in a "⋯" menu beside the inline ones.
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!moreMenuRef.current?.contains(event.target as Node)) setIsMoreOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMoreOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreOpen]);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isExportTeamOpen, setIsExportTeamOpen] = useState(false);
  const [isLoadOpponentOpen, setIsLoadOpponentOpen] = useState(false);
  const [saveSetDraft, setSaveSetDraft] = useState<{ name: string; isPublic: boolean } | null>(
    null,
  );
  const [saveSetError, setSaveSetError] = useState<string | null>(null);
  const [isSavingSet, setIsSavingSet] = useState(false);
  const selected = selectedIndex !== null ? sidebar[selectedIndex] : undefined;
  const pokemon = selected?.pokemon ?? null;
  // What the editor's field labels and picker sheets call this side ("Garchomp move 1",
  // "Garchomp item"): the Pokémon, not "Attacker"/"Defender", since either side can be
  // either. `title` stays for the side-wide things (its roster, import/export).
  const pokemonName = pokemon ? text.species(pokemon.species) : title;

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
      if (parsed.length === 1 && importMode === "pokemon") {
        onAddPokemon(parsed[0]);
      } else {
        onImportTeam(parsed.slice(0, MAX_SIDEBAR_POKEMON));
      }
      setImportText("");
      setImportError(null);
      setImportMode(null);
    } catch {
      // parseTeam only throws via parsePokemonBlock on a genuinely empty
      // block, already excluded by splitIntoBlocks — this catch is a
      // defensive fallback, not a real expected path, so the message stays
      // generic.
      setImportError(t.calcPanel.importInvalid);
    }
  }

  function closeImport() {
    setImportMode(null);
    setImportText("");
    setImportError(null);
  }

  // `title` is translated, so ids come from a stable slug of it.
  const idBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const importModalTitleId = `${idBase}-import-modal-title`;
  const loadOpponentModalTitleId = `${idBase}-load-opponent-modal-title`;

  const saveSetModalTitleId = `${idBase}-save-set-modal-title`;
  const replacedSet =
    pokemon && saveSetDraft?.name.trim()
      ? findSameNameSet(
          saveSetDraft.isPublic ? calcSets.publicSets : calcSets.customSets,
          pokemon,
          saveSetDraft.name,
        )
      : undefined;

  function closeSaveSet() {
    setSaveSetDraft(null);
    setSaveSetError(null);
  }

  async function submitSaveSet() {
    if (!pokemon || !saveSetDraft) return;
    const name = saveSetDraft.name.trim();
    if (!name) {
      setSaveSetError(t.calcPanel.setNameRequired);
      return;
    }
    setIsSavingSet(true);
    try {
      // The Stat Point/nature edits live in statOverrides, on top of the entry — fold them in.
      const kind = saveSetDraft.isPublic ? "public" : "custom";
      const saved = await calcSets.saveSet(kind, applyStatOverrides(pokemon, statOverrides), name);
      onLinkSet({ kind, id: saved.id });
      toast.success(t.calcPanel.setSaved(name));
      closeSaveSet();
    } catch {
      setSaveSetError(t.calcPanel.setSaveFailed);
    } finally {
      setIsSavingSet(false);
    }
  }

  function loadOpponentTeam(opponent: Opponent) {
    onImportTeam(opponent.team.pokemon.slice(0, MAX_SIDEBAR_POKEMON));
    setIsLoadOpponentOpen(false);
    toast.success(t.calcPanel.loaded(opponent.label));
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
      toast.success(t.calcPanel.copiedTeam(sidebar.length));
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
    abilityActive: battleState.abilityActive,
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
        className={cn(
          "w-7 text-right font-medium tabular-nums",
          value > screenValue ? "text-red-600" : "text-blue-600",
        )}
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

  // The app's own picker rather than a native select, like nature/item. On
  // phones it sits beside the nature, label on top; above, next to HP.
  const statusSelect = (
    <SearchableSelect
      options={STATUS_OPTIONS.map((status) => ({
        id: status,
        label: t.calcPanel.statuses[status],
      }))}
      value={t.calcPanel.statuses[battleState.status]}
      onSelect={(option) => updateBattleState({ status: option.id as PokemonStatus })}
      placeholder={t.calcPanel.statuses.Healthy}
      skipFlow
      ariaLabel={t.editor.fieldLabel(pokemonName, t.calcPanel.status)}
      compact={!isPhone}
    />
  );

  // The panel's import/export actions: a bottom sheet on phones (full labels); from sm
  // up Load Team as a link on the left, the everyday Import Pokémon and Export Set as
  // short "Import"/"Export" links on the right, and the rest in a "⋯" menu.
  const actions: Array<{
    key: string;
    icon: IconName;
    label: string;
    hint: string;
    onClick: () => void;
    /** Where it sits from sm up; omitted = the "⋯" menu. */
    placement?: "left" | "right";
    /** Its link text from sm up, when shorter than `label`. */
    shortLabel?: string;
  }> = [
    ...(loadableOpponents
      ? [
          {
            key: "load",
            placement: "left" as const,
            icon: IconName.Download,
            label: t.calcPanel.loadTeam,
            hint: t.calcPanel.loadTeamHint,
            onClick: () => setIsLoadOpponentOpen(true),
          },
        ]
      : []),
    ...(["pokemon", "team"] as const).map((mode) => ({
      key: `import-${mode}`,
      placement: mode === "pokemon" ? ("right" as const) : undefined,
      shortLabel: mode === "pokemon" ? t.calcPanel.import : undefined,
      icon: IconName.ContentPaste,
      label: mode === "pokemon" ? t.calcPanel.importPokemon : t.calcPanel.importTeam,
      hint: t.calcPanel.importHint,
      onClick: () => {
        setImportMode(mode);
        setImportError(null);
      },
    })),
    ...(pokemon
      ? [
          {
            key: "export-set",
            placement: "right" as const,
            shortLabel: t.calcPanel.export,
            icon: IconName.ContentCopy,
            label: t.calcPanel.exportSet,
            hint: t.calcPanel.exportSetHint,
            onClick: () => void copyPokemonExportText(pokemon),
          },
        ]
      : []),
    ...(sidebar.length > 0
      ? [
          {
            key: "export-team",
            icon: IconName.ContentCopy,
            label: t.calcPanel.exportTeam,
            hint: t.calcPanel.exportTeamHint,
            onClick: () => setIsExportTeamOpen(true),
          },
        ]
      : []),
  ];

  return (
    // FLOW_ROOT: Enter in one field moves to the next (Pokémon, item, ability, Stat Points, nature, moves).
    <div
      {...FLOW_ROOT}
      className={cn("flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 sm:p-4", className)}
    >
      {/* Only for screen readers: either side can attack, so the panel is
          known by its Pokémon (the side tabs, "X's moves"), not a role. */}
      <h3 className="sr-only">{title}</h3>

      {isPhone ? (
        <div className="flex justify-end border-b border-zinc-200 pb-3">
          <TextAction onClick={() => setIsActionsOpen(true)} aria-haspopup="dialog">
            <Icon name={IconName.SwapVert} size={14} />
            {t.calcPanel.importExport}
            <Icon name={IconName.ExpandMore} size={14} />
          </TextAction>
          <Drawer open={isActionsOpen} onOpenChange={setIsActionsOpen} showSwipeHandle>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{t.calcPanel.importExport}</DrawerTitle>
              </DrawerHeader>
              <div className="flex flex-col gap-1 p-4 pt-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => {
                      setIsActionsOpen(false);
                      action.onClick();
                    }}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-base text-zinc-800 hover:bg-zinc-100"
                  >
                    <Icon name={action.icon} size={20} className="text-zinc-500" />
                    {action.label}
                  </button>
                ))}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-b border-zinc-200 pb-3">
          {actions
            .filter((action) => action.placement)
            .map((action) => (
              <TextAction
                key={action.key}
                onClick={action.onClick}
                title={action.hint}
                aria-label={action.label}
                className={cn(action.placement === "left" && "mr-auto")}
              >
                <Icon name={action.icon} size={14} />
                {action.shortLabel ?? action.label}
              </TextAction>
            ))}
          <div ref={moreMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsMoreOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isMoreOpen}
              aria-label={t.calcPanel.moreActions}
              title={t.calcPanel.moreActions}
              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <Icon name={IconName.MoreVert} size={16} />
            </button>
            {isMoreOpen && (
              <div
                role="menu"
                className="absolute top-full right-0 z-20 mt-1 flex w-48 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 py-1 shadow-lg"
              >
                {actions
                  .filter((action) => !action.placement)
                  .map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMoreOpen(false);
                        action.onClick();
                      }}
                      title={action.hint}
                      className="flex items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                    >
                      <Icon name={action.icon} size={16} className="text-zinc-500" />
                      {action.label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {importMode && (
        <Modal onClose={closeImport} labelledBy={importModalTitleId} fullScreenOnPhone>
          <ModalTitle id={importModalTitleId}>
            {importMode === "pokemon" ? t.calcPanel.importPokemon : t.calcPanel.importTeam}
          </ModalTitle>
          <ModalDescription>
            {importMode === "pokemon"
              ? t.calcPanel.importPokemonIntro
              : t.calcPanel.importTeamIntro}
          </ModalDescription>
          <Textarea
            value={importText}
            onChange={(event) => {
              setImportText(event.target.value);
              setImportError(null);
            }}
            placeholder={
              "Charizard @ Charizardite Y\nAbility: Blaze\nEVs: 17 HP / 25 Def / 11 SpA / 13 Spe\nModest Nature\n- Heat Wave\n- Weather Ball\n- Solar Beam\n- Protect"
            }
            rows={12}
            // Not on phones: the keyboard would cover the sheet, and pasting doesn't need it.
            autoFocus={!isPhone}
            aria-label={t.calcPanel.importTextLabel(title)}
            className="min-h-0 flex-1"
          />
          {importError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {importError}
            </p>
          )}
          <ModalActions>
            <Button onClick={submitImport}>{t.calcPanel.import}</Button>
            <Button variant="outline" onClick={closeImport}>
              {t.common.cancel}
            </Button>
          </ModalActions>
        </Modal>
      )}

      {isLoadOpponentOpen && loadableOpponents && (
        <LoadTeamDialog
          opponents={loadableOpponents}
          onLoad={loadOpponentTeam}
          onClose={() => setIsLoadOpponentOpen(false)}
          labelledBy={loadOpponentModalTitleId}
        />
      )}

      {saveSetDraft && pokemon && (
        <Modal onClose={closeSaveSet} labelledBy={saveSetModalTitleId}>
          <ModalTitle id={saveSetModalTitleId}>
            {t.calcPanel.saveSetTitle(text.species(pokemon.species))}
          </ModalTitle>
          <ModalDescription>{t.calcPanel.saveSetIntro}</ModalDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitSaveSet();
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
              {t.calcPanel.setName}
              <input
                type="text"
                value={saveSetDraft.name}
                onChange={(event) => {
                  setSaveSetDraft({ ...saveSetDraft, name: event.target.value });
                  setSaveSetError(null);
                }}
                placeholder={t.calcPanel.setNamePlaceholder}
                autoFocus
                maxLength={60}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-normal text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
            </label>
            {calcSets.canEditPublic && (
              <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={saveSetDraft.isPublic}
                  onChange={(event) =>
                    setSaveSetDraft({ ...saveSetDraft, isPublic: event.target.checked })
                  }
                />
                {t.calcPanel.makePublic}
              </label>
            )}
            {replacedSet && (
              <p className="mt-2 text-xs text-amber-600">
                {saveSetDraft.isPublic
                  ? t.calcPanel.replacesPublicSet(replacedSet.name)
                  : t.calcPanel.replacesSet(replacedSet.name)}
              </p>
            )}
            {saveSetError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {saveSetError}
              </p>
            )}
            <ModalActions>
              <Button type="submit" disabled={isSavingSet}>
                {isSavingSet ? t.common.saving : t.common.save}
              </Button>
              <Button variant="outline" onClick={closeSaveSet}>
                {t.common.cancel}
              </Button>
            </ModalActions>
          </form>
        </Modal>
      )}

      {isExportTeamOpen && (
        <Modal
          onClose={() => setIsExportTeamOpen(false)}
          labelledBy={exportTeamModalTitleId}
          fullScreenOnPhone
        >
          <ModalTitle id={exportTeamModalTitleId}>{t.calcPanel.exportTeam}</ModalTitle>
          <ModalDescription>{t.calcPanel.exportIntro(sidebar.length)}</ModalDescription>
          <Textarea
            readOnly
            value={teamExportText}
            rows={12}
            onFocus={(event) => event.target.select()}
            aria-label={t.calcPanel.exportTextLabel(title)}
            className="min-h-0 flex-1"
          />
          <ModalActions>
            <Button onClick={copyTeamExportText}>{t.calcPanel.copyToClipboard}</Button>
            <Button variant="outline" onClick={() => setIsExportTeamOpen(false)}>
              {t.common.close}
            </Button>
          </ModalActions>
        </Modal>
      )}

      {/* The roster strip sits beside the editor; below lg it moves to MobileRosterBar, fixed to the bottom of the screen. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            <PokemonSetPicker
              title={pokemonName}
              pokemon={pokemon}
              calcSets={calcSets}
              onSelect={(newPokemon, fromSet) => {
                if (selectedIndex !== null) {
                  onReplacePokemon(newPokemon, fromSet);
                } else {
                  onAddPokemon(newPokemon, fromSet);
                }
              }}
            />
            {hasMegaForm && (
              <TogglePill
                active={mega}
                onClick={() => onMegaChange(!mega)}
                className={cn("shrink-0 px-2 py-2 font-semibold", !mega && "text-zinc-500")}
              >
                {t.editor.mega}
              </TogglePill>
            )}
            {pokemon && (
              <IconButton
                variant="ghost"
                onClick={() => {
                  // Prefill the set this entry came from, so Save overwrites it. A
                  // public set only stays public for the admin; anyone else saves
                  // their own copy under the same name.
                  const fromSet = calcSets.findSet(selected?.fromSet);
                  setSaveSetDraft({
                    name: fromSet?.name ?? "",
                    isPublic: selected?.fromSet?.kind === "public" && calcSets.canEditPublic,
                  });
                }}
                aria-label={t.calcPanel.saveSetLabel(text.species(pokemon.species))}
                title={t.calcPanel.saveSet}
              >
                <Icon name={IconName.BookmarkAdd} size={14} />
              </IconButton>
            )}
            {pokemon && sidebar.length < MAX_SIDEBAR_POKEMON && (
              <IconButton
                variant="ghost"
                onClick={() => {
                  onSaveToSidebar();
                  toast.success(t.calcPanel.saved(text.species(pokemon.species), title));
                }}
                aria-label={t.calcPanel.saveLabel(title)}
                title={t.calcPanel.saveHint}
              >
                <Icon name={IconName.Add} size={14} />
              </IconButton>
            )}
          </div>

          <PokemonEditor
            title={pokemonName}
            pokemon={pokemon}
            mega={mega}
            statOverrides={statOverrides}
            onStatOverridesChange={onStatOverridesChange}
            onAbilityChange={onAbilityChange}
            onItemChange={onItemChange}
            onMovesChange={onMovesChange}
            simpleFields
            maxTotalStatPoints={MAX_TOTAL_STAT_POINTS}
            extraStatColumns={[
              {
                id: "stage",
                header: t.editor.stage,
                render: (stat) => {
                  const stageKey = STAGE_KEY_BY_STAT[stat];
                  if (!stageKey) return null;
                  return (
                    <Select
                      variant="compact"
                      value={String(battleState[stageKey])}
                      onChange={(value) => updateBattleState({ [stageKey]: Number(value) })}
                      ariaLabel={t.calcPanel.stageLabel(title, t.stats.short[stat])}
                      options={STAGE_OPTIONS.map((stage) => ({
                        value: String(stage),
                        label: stage > 0 ? `+${stage}` : stage === 0 ? "--" : String(stage),
                      }))}
                      className="rounded border-zinc-300 bg-zinc-50 px-1 text-zinc-900"
                    />
                  );
                },
              },
              { id: "battle", render: renderBattleStat },
            ]}
            // The stat screen's Speed, without its item — the Battle column
            // adds Choice Scarf/Iron Ball with everything else.
            besideNature={
              isPhone && (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-zinc-500">
                    {t.calcPanel.status}
                  </span>
                  {statusSelect}
                </div>
              )
            }
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
                  <Slider
                    min={0}
                    max={100}
                    value={battleState.currentHpPercent}
                    onChange={(event) =>
                      updateBattleState({
                        currentHpPercent: Number(event.target.value),
                      })
                    }
                    aria-label={t.calcPanel.currentHpLabel(title)}
                  />
                </label>
                {effectiveAbility &&
                  ACTIVATED_SPEED_DOUBLING_ABILITIES.includes(effectiveAbility) && (
                    <TogglePill
                      active={!!battleState.abilityActive}
                      onClick={() =>
                        updateBattleState({ abilityActive: !battleState.abilityActive })
                      }
                      title={t.calcPanel.abilityActiveHint(text.ability(effectiveAbility))}
                      className="shrink-0"
                    >
                      {t.calcPanel.abilityActive(text.ability(effectiveAbility))}
                    </TogglePill>
                  )}
                {!isPhone && (
                  <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-600">
                    <span>{t.calcPanel.status}</span>
                    <div className="w-28">{statusSelect}</div>
                  </div>
                )}
              </div>
            )}
          </PokemonEditor>
        </div>

        <div
          className="hidden shrink-0 flex-col gap-1.5 border-l border-zinc-200 pl-3 lg:flex"
          role="listbox"
          aria-label={t.calcPanel.sidebar(title)}
        >
          {sidebar.map((entry, index) => {
            const isSelected = selectedIndex === index;
            return (
              <div key={index} className="flex items-center gap-1">
                {/* The badge sits outside the button so the tile's rounded clip doesn't cut it off. */}
                <div className="relative shrink-0">
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
                    className={cn(
                      "relative block h-12 w-12 overflow-hidden rounded-lg border-2 bg-zinc-50 transition-colors",
                      isSelected ? "border-zinc-600" : "border-zinc-300 hover:border-zinc-400",
                    )}
                  >
                    <span className="absolute inset-0.5">
                      {/* The open entry follows the Mega toggle (no item = base form), like the rest of the calc's sprites. */}
                      <PokemonSprite
                        species={entry.pokemon.species}
                        item={isSelected && !mega ? undefined : entry.pokemon.item}
                        fill
                      />
                    </span>
                  </button>
                  {entry.pokemon.item && (
                    <span className="pointer-events-none absolute -right-1 -bottom-1">
                      <ItemIcon item={entry.pokemon.item} size={16} />
                    </span>
                  )}
                </div>
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
          {sidebar.length < MAX_SIDEBAR_POKEMON && (
            <button
              type="button"
              onClick={() => onAddPokemon(buildCustomPokemon(DEFAULT_SPECIES_KEY))}
              aria-label={t.calcPanel.addBlank(title)}
              title={t.calcPanel.addBlank(title)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-600"
            >
              <Icon name={IconName.Add} size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
