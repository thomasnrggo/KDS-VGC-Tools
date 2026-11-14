"use client";

import { Select } from "@/components/Select";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Button, IconButton, iconButtonVariants, TextAction, TogglePill } from "../Button";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import { Modal, ModalActions, ModalDescription, ModalTitle } from "../Modal";
import { BuilderEditor } from "./BuilderEditor";
import { TeamThreats } from "../TeamThreats";
import { BuilderCalculator } from "./BuilderCalculator";
import { SidePanel } from "../SidePanel";
import { PokemonSprite } from "../PokemonSprite";
import { shortRegulationLabel } from "../TeamRegulationTags";
import { Textarea } from "../Textarea";
import { toast } from "../Toast";
import { IconName } from "@/enums";
import { REGULATIONS } from "@/data/regulations";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsPhone } from "@/hooks/useIsPhone";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { formatPokemonPaste, formatTeamPaste } from "@/lib/formatPokemonPaste";
import { parseTeam } from "@/lib/parseTeam";
import { getRegulationLegalityIssues } from "@/lib/regulationLegality";
import { teamWithPokemonMoved, teamWithoutSlot } from "@/lib/rosterSlots";
import { isEditableTarget } from "@/lib/isEditableTarget";
import { cn } from "@/lib/utils";
import type { ParsedPokemon, Team } from "@/types";

const MAX_SLOTS = 6;

const PASTE_PLACEHOLDER =
  "Charizard @ Charizardite Y\nAbility: Blaze\nEVs: 17 HP / 25 Def / 11 SpA / 13 Spe\nModest Nature\n- Heat Wave\n- Weather Ball\n- Solar Beam\n- Protect";

interface TeamBuilderProps {
  team: Team;
  onChange: (updater: (team: Team) => Team) => void;
  /**
   * Removes the Pokémon at `index` from the saved team and everything that
   * picks from it (see removePokemonEverywhere) — omitted for a new team's
   * unsaved draft, which nothing picks from yet, so it's removed in place.
   */
  onRemovePokemon?: (index: number) => void;
  /**
   * Moves the Pokémon at `from` to `to` in the saved team and everything that
   * picks from it (see movePokemonEverywhere) — omitted for a new team's
   * unsaved draft, which is reordered in place.
   */
  onMovePokemon?: (from: number, to: number) => void;
  /** The team's page, once it has one — where the back link goes (My Teams until then). */
  teamHref?: string;
  /** The page's heading, for screen readers — the back link and team name stand in for it visually. */
  heading: string;
  /** The slot to open on (a Pokémon card clicked on the team's Overview). */
  initialSlot?: number;
}

/**
 * The Team Builder: a team's name, regulation and up to six Pokémon, each
 * edited with the same fields as the Damage Calculator (and the same
 * keyboard flow — Enter in one field moves to the next). Import / Export
 * (one dialog) works on the whole team; Copy/Paste on one Pokémon, also from the
 * keyboard (Ctrl/⌘+C and Ctrl/⌘+V outside a text field).
 */
/** What the panel beside the builder shows. */
type PanelMode = "analysis" | "calculator";
const PANEL_MODES: PanelMode[] = ["analysis", "calculator"];

export function TeamBuilder({
  team,
  onChange,
  onRemovePokemon,
  onMovePokemon,
  teamHref,
  heading,
  initialSlot = 0,
}: TeamBuilderProps) {
  const t = useMessages();
  const text = usePokemonText();
  const isPhone = useIsPhone();
  const [selectedIndex, setSelectedIndex] = useState(initialSlot);
  const [pasteDraft, setPasteDraft] = useState<{ text: string; error: string | null } | null>(null);
  const [importDraft, setImportDraft] = useState<{ text: string; error: string | null } | null>(
    null,
  );
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  // Dragging a tile to reorder: the one dragged, and the tile it's over.
  const [draggedTile, setDraggedTile] = useState<number | null>(null);
  const [dropTile, setDropTile] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const pokemon = team.pokemon;
  const regulation =
    REGULATIONS.find((regulation) => regulation.id === team.regulationIds[0]) ?? REGULATIONS[0];
  const regulationLabel = t.common.regulationLabel(regulation.label);
  const canAdd = pokemon.length < MAX_SLOTS;
  // The "+" tile is the slot after the last Pokémon — there's no picking one further out.
  const index = Math.min(selectedIndex, canAdd ? pokemon.length : pokemon.length - 1);
  const selected: ParsedPokemon | null = pokemon[index] ?? null;
  const selectedName = selected ? text.species(selected.species) : t.teamBuilder.slot(index + 1);
  const issues = getRegulationLegalityIssues(pokemon, regulation);
  // The panel beside the builder (a drawer on phones): the analysis (the team
  // page's Threats tab) or the calculator (your side being the Pokémon open
  // here) — a preview behind its flag, always there for the admin.
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("analysis");
  // Kept once opened, so the opponent set up there survives a look at the analysis.
  const [hasCalculator, setHasCalculator] = useState(false);
  const { flags } = useFeatureFlags();
  const { isStaff } = useIsAdmin();
  const canUsePanel = (flags.teamThreats || isStaff) && pokemon.length > 0;
  const modalOpen =
    pasteDraft !== null ||
    importDraft !== null ||
    confirmRemoveIndex !== null ||
    (isPanelOpen && isPhone);

  function setRoster(next: ParsedPokemon[]) {
    onChange((current) => ({ ...current, pokemon: next, rawPaste: formatTeamPaste(next) }));
  }

  /** Puts a Pokémon in the selected slot — or, on the "+" tile, adds it. */
  function putSelected(mon: ParsedPokemon) {
    const next = [...pokemon];
    next[index] = mon;
    setRoster(next);
    setSelectedIndex(index);
  }

  function setRegulation(regulationId: string) {
    onChange((current) => ({
      ...current,
      // The builder's regulation is the team's first; any other tags stay.
      regulationIds: [
        regulationId,
        ...current.regulationIds.slice(1).filter((id) => id !== regulationId),
      ],
    }));
  }

  function removeAt(removed: number) {
    const name = text.species(pokemon[removed].species);
    if (onRemovePokemon) onRemovePokemon(removed);
    else onChange((current) => teamWithoutSlot(current, removed));
    setSelectedIndex(Math.max(0, Math.min(removed, pokemon.length - 2)));
    setConfirmRemoveIndex(null);
    toast.success(t.teamBuilder.removed(name));
  }

  /** Moves the Pokémon at `from` to `to` (the ones between shift a place); it stays selected. */
  function movePokemon(from: number, to: number) {
    if (from === to || to < 0 || to >= pokemon.length || !pokemon[from]) return;
    if (onMovePokemon) onMovePokemon(from, to);
    else onChange((current) => teamWithPokemonMoved(current, from, to));
    setSelectedIndex(to);
  }

  /** Alt+← / → moves the selected Pokémon a place (true if it was that key). */
  function handleMoveKey(event: { key: string; altKey: boolean; preventDefault: () => void }) {
    if (!event.altKey || !selected) return false;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return false;
    event.preventDefault();
    const to = index + (event.key === "ArrowLeft" ? -1 : 1);
    movePokemon(index, to);
    // Keep the focus on the moved tile, so the keys can keep moving it.
    requestAnimationFrame(() =>
      stripRef.current?.querySelector<HTMLElement>(`[data-tile="${to}"]`)?.focus(),
    );
    return true;
  }

  /** Opens Import / Export with the team's text, ready to copy or to paste over. */
  function openImportExport() {
    setImportDraft({ text: formatTeamPaste(pokemon), error: null });
  }

  /** Removes the selected Pokémon — asking first once the team is saved (it touches plans). */
  function requestRemove() {
    if (onRemovePokemon) setConfirmRemoveIndex(index);
    else removeAt(index);
  }

  async function copyPokemon(mon: ParsedPokemon) {
    try {
      await navigator.clipboard.writeText(formatPokemonPaste(mon));
      toast.success(t.calcPanel.copied(text.species(mon.species)));
    } catch {
      toast.error(t.calcPanel.copyFailed);
    }
  }

  /** Copies one Pokémon's Import / Export text as it stands. */
  async function copyText(value: string, name: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t.calcPanel.copied(name));
    } catch {
      toast.error(t.calcPanel.copyFailed);
    }
  }

  /** Copies the Import / Export text as it stands (the team's, or what's been pasted over it). */
  async function copyTeamText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t.calcPanel.copiedTeam(parseTeam(text.trim()).length));
    } catch {
      toast.error(t.calcPanel.copyFailed);
    }
  }

  /** One Pokémon's paste into the selected slot; an error message when it isn't exactly one. */
  function pastePokemon(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return t.calcPanel.importEmpty;
    const parsed = parseTeam(trimmed);
    if (parsed.length === 0) return t.calcPanel.importInvalid;
    if (parsed.length > 1) return t.teamBuilder.pasteMultiple;
    putSelected(parsed[0]);
    toast.success(t.teamBuilder.pasted(text.species(parsed[0].species)));
    return null;
  }

  function submitPaste() {
    if (!pasteDraft) return;
    const error = pastePokemon(pasteDraft.text);
    setPasteDraft(error ? { ...pasteDraft, error } : null);
  }

  function submitImport() {
    if (!importDraft) return;
    const trimmed = importDraft.text.trim();
    const parsed = trimmed ? parseTeam(trimmed) : [];
    const error = !trimmed
      ? t.calcPanel.importEmpty
      : parsed.length === 0
        ? t.calcPanel.importInvalid
        : parsed.length > MAX_SLOTS
          ? t.errors.tooManyPokemon(parsed.length)
          : null;
    if (error) {
      setImportDraft({ ...importDraft, error });
      return;
    }
    setRoster(parsed);
    setSelectedIndex(0);
    setImportDraft(null);
    toast.success(t.teamBuilder.imported(parsed.length));
  }

  // Outside a text field, Ctrl/⌘+V pastes a copied Pokémon into the selected
  // slot (a whole team opens Import / Export with it), and Ctrl/⌘+C copies the
  // selected Pokémon — the keyboard version of the Copy/Paste buttons.
  useEffect(() => {
    if (modalOpen) return;
    function handlePaste(event: ClipboardEvent) {
      if (isEditableTarget(event.target)) return;
      const raw = event.clipboardData?.getData("text/plain") ?? "";
      const parsed = raw.trim() ? parseTeam(raw.trim()) : [];
      if (parsed.length === 0) return;
      event.preventDefault();
      if (parsed.length > 1) setImportDraft({ text: raw, error: null });
      else pastePokemon(raw);
    }
    function handleCopy(event: ClipboardEvent) {
      if (isEditableTarget(event.target) || !selected) return;
      if (window.getSelection()?.toString()) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", formatPokemonPaste(selected));
      toast.success(t.calcPanel.copied(text.species(selected.species)));
    }
    // Outside a text field, Ctrl/⌘+Delete (or Backspace — a Mac's Delete
    // key) removes the selected Pokémon, like its delete button.
    // Anywhere else outside a text field (and not on the row, which handles
    // its own keys), ← / → switch Pokémon too.
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        (event.ctrlKey || event.metaKey) &&
        selected &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        requestRemove();
        return;
      }
      // Typing on the row (or with nothing focused, like on arriving) goes
      // into the Pokémon field — focused before the key lands, so it gets it.
      if (
        !isPhone &&
        event.key.length === 1 &&
        event.key !== " " &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        (event.target === document.body ||
          (event.target instanceof Node && !!stripRef.current?.contains(event.target)))
      ) {
        focusSpeciesField();
        return;
      }
      if (
        !event.defaultPrevented &&
        !isEditableTarget(event.target) &&
        !(event.target instanceof Node && stripRef.current?.contains(event.target)) &&
        handleMoveKey(event)
      ) {
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.shiftKey || isEditableTarget(event.target)) return;
      if (event.target instanceof Node && stripRef.current?.contains(event.target)) return;
      const next = stepTile(index, event.key);
      if (next === null) return;
      event.preventDefault();
      selectTile(next);
    }
    document.addEventListener("paste", handlePaste);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  /** The tile ←, →, Home or End lead to from `tileIndex` (null for other keys). */
  function stepTile(tileIndex: number, key: string): number | null {
    const last = canAdd ? pokemon.length : pokemon.length - 1;
    if (key === "ArrowRight") return Math.min(tileIndex + 1, last);
    if (key === "ArrowLeft") return Math.max(tileIndex - 1, 0);
    if (key === "Home") return 0;
    if (key === "End") return last;
    return null;
  }

  /** Selects a tile and focuses it, so more arrows keep moving along the row. */
  function selectTile(index: number) {
    setSelectedIndex(index);
    stripRef.current?.querySelector<HTMLElement>(`[data-tile="${index}"]`)?.focus();
  }

  /**
   * Clicking a tile opens it with the focus in its Pokémon field, ready to
   * type (desktop — on phones the field opens a sheet, so the tile keeps it).
   * Arrowing along the row keeps the focus there; typing then moves it (see
   * the keydown handler).
   */
  function openTile(index: number) {
    setSelectedIndex(index);
    if (isPhone) return;
    // After the editor re-renders for the new slot.
    requestAnimationFrame(focusSpeciesField);
  }

  /** Focuses the editor's Pokémon field (its first). */
  function focusSpeciesField() {
    panelRef.current?.querySelector<HTMLInputElement>("input[role=combobox]")?.focus();
  }

  // ← / → move along the Pokémon row, like tabs.
  function handleStripKeyDown(event: KeyboardEvent<HTMLButtonElement>, tileIndex: number) {
    if (tileIndex === index && handleMoveKey(event)) return;
    const next = stepTile(tileIndex, event.key);
    if (next === null) return;
    event.preventDefault();
    selectTile(next);
  }

  function legalityMessage(issue: (typeof issues)[number]): string {
    const species = text.species(issue.species);
    const item = text.item(issue.item ?? "");
    if (issue.kind === "species") return t.regulationTags.illegalSpecies(species, regulationLabel);
    return issue.kind === "megaStone"
      ? t.regulationTags.illegalMegaStone(item, species, regulationLabel)
      : t.regulationTags.illegalItem(item, regulationLabel);
  }

  function setPanelOpen(open: boolean) {
    setIsPanelOpen(open);
  }

  function showPanel(mode: PanelMode) {
    setPanelMode(mode);
    if (mode === "calculator") setHasCalculator(true);
    setPanelOpen(true);
  }

  /** A header button: opens the panel on its mode, or closes it when that mode is showing. */
  function togglePanel(mode: PanelMode) {
    if (isPanelOpen && panelMode === mode) setPanelOpen(false);
    else showPanel(mode);
  }

  const panelHeader = (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5">
      <div role="group" aria-label={t.teamBuilder.panel} className="flex gap-1.5">
        {PANEL_MODES.map((mode) => (
          <TogglePill
            key={mode}
            active={panelMode === mode}
            onClick={() => showPanel(mode)}
            className="px-3 py-1 text-sm"
          >
            {t.teamBuilder.panelModes[mode]}
          </TogglePill>
        ))}
      </div>
      <IconButton
        variant="ghost"
        onClick={() => setPanelOpen(false)}
        aria-label={t.common.close}
        title={t.common.close}
      >
        <Icon name={IconName.Close} size={18} />
      </IconButton>
    </div>
  );
  const panelBody = (
    // A container, so what's inside lays out by the panel's width.
    <div className="@container min-h-0 flex-1 overflow-y-auto p-4">
      {/* The analysis is only built while it shows (its calcs redo on every edit). */}
      {panelMode === "analysis" && <TeamThreats pokemon={pokemon} regulationId={regulation.id} />}
      {hasCalculator && (
        <div className={cn(panelMode !== "calculator" && "hidden")}>
          <BuilderCalculator team={team} pokemon={selected} slot={index} onChange={onChange} />
        </div>
      )}
    </div>
  );

  return (
    // Beside the builder, the analysis panel (desktop): it takes its room
    // instead of covering it, so both can be used at once.
    <div className="flex items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* One compact row (instead of a breadcrumb): back (to the team's page, or My Teams), name
          and regulation on the left, Import / Export on the right (an icon in the same row on phones). */}
        <h1 className="sr-only">{heading}</h1>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div
            className={cn(
              "grid min-w-0 items-center gap-2",
              isPhone
                ? canUsePanel
                  ? "grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto]"
                  : "grid-cols-[auto_minmax(0,1fr)_auto_auto]"
                : "grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,20rem)_auto]",
            )}
          >
            <Link
              href={teamHref ?? "/teams"}
              aria-label={teamHref ? t.teamBuilder.backToTeam : t.teamBuilder.backToMyTeams}
              title={teamHref ? t.teamBuilder.backToTeam : t.teamBuilder.backToMyTeams}
              className={iconButtonVariants()}
            >
              <Icon name={IconName.ExpandMore} size={18} className="rotate-90" />
            </Link>
            <input
              value={team.name}
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
              // A team always has a name — a cleared one goes back to "New team".
              onBlur={() => {
                if (!team.name.trim()) {
                  onChange((current) => ({ ...current, name: t.teamBuilder.newTeam }));
                }
              }}
              maxLength={60}
              aria-label={t.teamBuilder.teamName}
              placeholder={t.teamBuilder.teamName}
              className="h-8 min-w-0 rounded-md border border-zinc-300 bg-field px-2.5 text-sm font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
            />
            <Select
              variant="field"
              value={regulation.id}
              onChange={setRegulation}
              ariaLabel={t.common.regulation}
              title={t.teamBuilder.regulationHint}
              options={REGULATIONS.map((option) => ({
                value: option.id,
                // Phones: just "M-C", leaving the team name room.
                label: isPhone
                  ? shortRegulationLabel(option.label)
                  : t.common.regulationLabel(option.label),
              }))}
              className="h-8 w-auto shrink-0 rounded-md bg-field px-2.5"
            />
            {/* Phones: the header row's icons, Analyze and Calculator beside Import / Export like on desktop. */}
            {isPhone && canUsePanel && (
              <>
                <IconButton
                  onClick={() => showPanel("analysis")}
                  aria-label={t.teamBuilder.analyze}
                  title={t.teamBuilder.analyzeHint}
                >
                  <Icon name={IconName.BarChart} size={16} />
                </IconButton>
                <IconButton
                  onClick={() => showPanel("calculator")}
                  aria-label={t.teamBuilder.calculator}
                  title={t.teamBuilder.calculatorHint}
                >
                  <Icon name={IconName.Calculate} size={16} />
                </IconButton>
              </>
            )}
            {isPhone && (
              <IconButton
                onClick={openImportExport}
                aria-label={t.teamBuilder.importExport}
                title={t.teamBuilder.importExportHint}
              >
                <Icon name={IconName.ContentPaste} size={16} />
              </IconButton>
            )}
          </div>
          <div className={cn("flex flex-wrap items-center gap-1.5", isPhone && "hidden")}>
            {/* Each opens the panel beside the builder on its mode (filled while it shows). */}
            {canUsePanel &&
              PANEL_MODES.map((mode) => {
                const isShown = isPanelOpen && panelMode === mode;
                return (
                  <Button
                    key={mode}
                    variant={isShown ? "primary" : "outline"}
                    aria-pressed={isShown}
                    onClick={() => togglePanel(mode)}
                    title={
                      mode === "analysis" ? t.teamBuilder.analyzeHint : t.teamBuilder.calculatorHint
                    }
                    className="px-3 py-1"
                  >
                    {mode === "analysis" ? t.teamBuilder.analyze : t.teamBuilder.calculator}
                  </Button>
                );
              })}
            {/* One dialog for both, like Showdown: the team's text to copy, or paste one over it. */}
            <Button
              variant="outline"
              onClick={openImportExport}
              title={t.teamBuilder.importExportHint}
              className="flex items-center gap-1.5 px-3 py-1"
            >
              <Icon name={IconName.ContentPaste} size={14} />
              {t.teamBuilder.importExport}
            </Button>
          </div>
        </div>

        {/* The team's Pokémon, then a "+" tile — ← / → move along it like tabs. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <div
              ref={stripRef}
              role="tablist"
              aria-label={t.teamBuilder.slots}
              className="flex flex-wrap items-center gap-1.5"
            >
              {pokemon.map((mon, tileIndex) => {
                const isSelected = tileIndex === index;
                const name = text.species(mon.species);
                const isIllegal = issues.some((issue) => issue.index === tileIndex);
                return (
                  <div
                    key={tileIndex}
                    // Drag a tile onto another to move it there (desktop).
                    draggable={!isPhone}
                    onDragStart={(event) => {
                      setDraggedTile(tileIndex);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedTile(null);
                      setDropTile(null);
                    }}
                    onDragOver={(event) => {
                      if (draggedTile === null) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (dropTile !== tileIndex) setDropTile(tileIndex);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedTile !== null) movePokemon(draggedTile, tileIndex);
                      setDraggedTile(null);
                      setDropTile(null);
                    }}
                    className={cn(
                      "relative shrink-0 rounded-lg",
                      draggedTile === tileIndex && "opacity-40",
                      dropTile === tileIndex &&
                        draggedTile !== tileIndex &&
                        "outline outline-2 outline-offset-2 outline-zinc-500",
                    )}
                  >
                    <button
                      type="button"
                      role="tab"
                      data-tile={tileIndex}
                      aria-selected={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => openTile(tileIndex)}
                      onKeyDown={(event) => handleStripKeyDown(event, tileIndex)}
                      aria-label={isIllegal ? `${name} — ${t.teamBuilder.illegalSlot(name)}` : name}
                      title={`${mon.item ? `${name} @ ${text.item(mon.item)}` : name}${isPhone ? "" : ` — ${t.teamBuilder.dragHint}`}`}
                      className={cn(
                        "relative block h-12 w-12 overflow-hidden rounded-lg border-2 bg-zinc-500/20 transition-colors focus:ring-2 focus:ring-zinc-400 focus:outline-none",
                        isSelected ? "border-zinc-600" : "border-transparent hover:border-zinc-400",
                        isIllegal && "ring-2 ring-amber-500",
                        // The tile itself shows it can be dragged (a button's cursor is the default).
                        !isPhone && "cursor-grab active:cursor-grabbing",
                      )}
                    >
                      <PokemonSprite species={mon.species} item={mon.item} fill />
                    </button>
                    {mon.item && (
                      <span className="pointer-events-none absolute -right-1.5 -bottom-1.5">
                        <ItemIcon item={mon.item} size={20} />
                      </span>
                    )}
                  </div>
                );
              })}
              {canAdd && (
                <button
                  type="button"
                  role="tab"
                  data-tile={pokemon.length}
                  aria-selected={index === pokemon.length}
                  tabIndex={index === pokemon.length ? 0 : -1}
                  onClick={() => openTile(pokemon.length)}
                  onKeyDown={(event) => handleStripKeyDown(event, pokemon.length)}
                  aria-label={t.teamBuilder.addPokemon}
                  title={t.teamBuilder.addPokemon}
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:ring-2 focus:ring-zinc-400 focus:outline-none",
                    index === pokemon.length
                      ? "border-zinc-600 text-zinc-700"
                      : "border-zinc-400 text-zinc-500 hover:border-zinc-600 hover:text-zinc-700",
                  )}
                >
                  <Icon name={IconName.Add} size={20} />
                </button>
              )}
            </div>
            {/* Phones leave it out, so all six tiles fit on one row. */}
            {!isPhone && (
              <span className="ml-auto shrink-0 text-xs text-zinc-500">
                {t.teamBuilder.pokemonCount(pokemon.length)}
              </span>
            )}
          </div>
          {issues.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700">
              <Icon name={IconName.Warning} size={14} className="mt-px" />
              <span>
                {t.teamBuilder.notLegal(regulationLabel)} {issues.map(legalityMessage).join(" ")}
              </span>
            </p>
          )}
        </div>

        <section
          ref={panelRef}
          role="tabpanel"
          aria-label={selectedName}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:p-4"
        >
          {/* Keyed by slot, so switching Pokémon starts its form fresh. */}
          <BuilderEditor
            key={index}
            pokemon={selected}
            title={selectedName}
            regulation={regulation}
            onChange={putSelected}
            // The slot's own actions (like Showdown's Copy / Import / Delete), beside the stats heading.
            actions={
              <div className="flex items-center gap-1">
                {/* Phones can't drag the tiles: a place left or right instead. */}
                {selected && isPhone && pokemon.length > 1 && (
                  <>
                    <IconButton
                      variant="ghost"
                      onClick={() => movePokemon(index, index - 1)}
                      disabled={index === 0}
                      aria-label={t.teamBuilder.moveLeft(selectedName)}
                      title={t.teamBuilder.moveLeft(selectedName)}
                    >
                      <Icon name={IconName.ChevronLeft} size={18} />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      onClick={() => movePokemon(index, index + 1)}
                      disabled={index === pokemon.length - 1}
                      aria-label={t.teamBuilder.moveRight(selectedName)}
                      title={t.teamBuilder.moveRight(selectedName)}
                    >
                      <Icon name={IconName.ChevronRight} size={18} />
                    </IconButton>
                  </>
                )}
                {selected && (
                  <TextAction
                    onClick={() => void copyPokemon(selected)}
                    aria-label={t.teamBuilder.copyLabel(selectedName)}
                    title={t.teamBuilder.copyLabel(selectedName)}
                  >
                    <Icon name={IconName.ContentCopy} size={14} />
                    {!isPhone && t.teamBuilder.copy}
                  </TextAction>
                )}
                {/* One dialog, like the team's: this Pokémon's text to copy, or paste one over it. */}
                <TextAction
                  onClick={() =>
                    setPasteDraft({
                      text: selected ? formatPokemonPaste(selected) : "",
                      error: null,
                    })
                  }
                  aria-label={
                    selected
                      ? t.teamBuilder.pokemonImportExportLabel(selectedName)
                      : t.teamBuilder.pasteLabel
                  }
                  title={
                    selected
                      ? t.teamBuilder.pokemonImportExportLabel(selectedName)
                      : t.teamBuilder.pasteLabel
                  }
                >
                  <Icon name={IconName.ContentPaste} size={14} />
                  {!isPhone && (selected ? t.teamBuilder.importExport : t.teamBuilder.paste)}
                </TextAction>
                {selected && (
                  <IconButton
                    variant="ghost"
                    onClick={requestRemove}
                    aria-label={t.teamBuilder.remove(selectedName)}
                    title={t.teamBuilder.remove(selectedName)}
                    className="hover:text-red-600"
                  >
                    <Icon name={IconName.Delete} size={16} />
                  </IconButton>
                )}
              </div>
            }
          />
          {!isPhone && (
            <p className="text-xs text-zinc-500">
              {selected ? t.teamBuilder.keyboardHint : t.teamBuilder.pasteShortcutHint}
            </p>
          )}
        </section>

        {pasteDraft && (
          <Modal
            onClose={() => setPasteDraft(null)}
            labelledBy="paste-pokemon-title"
            fullScreenOnPhone
          >
            <ModalTitle id="paste-pokemon-title">
              {selected
                ? t.teamBuilder.pokemonImportExportTitle(selectedName)
                : t.teamBuilder.pasteTitle}
            </ModalTitle>
            <ModalDescription>
              {selected
                ? t.teamBuilder.pasteIntroReplace(selectedName)
                : t.teamBuilder.pasteIntroAdd}
            </ModalDescription>
            <Textarea
              value={pasteDraft.text}
              onChange={(event) => setPasteDraft({ text: event.target.value, error: null })}
              onFocus={(event) => event.target.select()}
              placeholder={PASTE_PLACEHOLDER}
              rows={10}
              autoFocus={!isPhone}
              aria-label={t.teamBuilder.pasteTextLabel}
              className="min-h-0 flex-1"
            />
            {pasteDraft.error && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {pasteDraft.error}
              </p>
            )}
            <ModalActions>
              {/* Save only once the text differs from the Pokémon. */}
              <Button
                onClick={submitPaste}
                disabled={
                  !!selected && pasteDraft.text.trim() === formatPokemonPaste(selected).trim()
                }
              >
                {selected ? t.teamBuilder.saveImport : t.teamBuilder.paste}
              </Button>
              {selected && (
                <Button
                  variant="outline"
                  onClick={() => void copyText(pasteDraft.text, selectedName)}
                  disabled={!pasteDraft.text.trim()}
                >
                  {t.calcPanel.copyToClipboard}
                </Button>
              )}
              <Button variant="outline" onClick={() => setPasteDraft(null)}>
                {selected ? t.common.close : t.common.cancel}
              </Button>
            </ModalActions>
          </Modal>
        )}

        {importDraft && (
          <Modal
            onClose={() => setImportDraft(null)}
            labelledBy="import-team-title"
            fullScreenOnPhone
          >
            <ModalTitle id="import-team-title">{t.teamBuilder.importExport}</ModalTitle>
            <ModalDescription>
              {t.teamBuilder.importIntro} {pokemon.length > 0 && t.teamBuilder.importReplaces}
            </ModalDescription>
            <Textarea
              value={importDraft.text}
              onChange={(event) => setImportDraft({ text: event.target.value, error: null })}
              onFocus={(event) => event.target.select()}
              placeholder={PASTE_PLACEHOLDER}
              rows={12}
              autoFocus={!isPhone}
              aria-label={t.teamBuilder.importTextLabel}
              className="min-h-0 flex-1"
            />
            {importDraft.error && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {importDraft.error}
              </p>
            )}
            <ModalActions>
              {/* Save only once the text differs from the team. */}
              <Button
                onClick={submitImport}
                disabled={importDraft.text.trim() === formatTeamPaste(pokemon).trim()}
              >
                {t.teamBuilder.saveImport}
              </Button>
              <Button
                variant="outline"
                onClick={() => void copyTeamText(importDraft.text)}
                disabled={!importDraft.text.trim()}
              >
                {t.calcPanel.copyToClipboard}
              </Button>
              <Button variant="outline" onClick={() => setImportDraft(null)}>
                {t.common.close}
              </Button>
            </ModalActions>
          </Modal>
        )}

        {confirmRemoveIndex !== null && pokemon[confirmRemoveIndex] && (
          <Modal onClose={() => setConfirmRemoveIndex(null)} labelledBy="remove-pokemon-title">
            <ModalTitle id="remove-pokemon-title">
              {t.teamBuilder.confirmRemoveTitle(text.species(pokemon[confirmRemoveIndex].species))}
            </ModalTitle>
            <ModalDescription>{t.teamBuilder.confirmRemoveBody}</ModalDescription>
            <ModalActions>
              <Button variant="danger" onClick={() => removeAt(confirmRemoveIndex)}>
                {t.common.remove}
              </Button>
              <Button variant="outline" onClick={() => setConfirmRemoveIndex(null)}>
                {t.common.cancel}
              </Button>
            </ModalActions>
          </Modal>
        )}
      </div>
      {/* Beside the builder on desktop (pushing it over), the whole screen on phones. */}
      <SidePanel
        open={isPanelOpen}
        onOpenChange={setPanelOpen}
        label={t.teamBuilder.panelTitle(team.name)}
        header={panelHeader}
      >
        {panelBody}
      </SidePanel>
    </div>
  );
}
