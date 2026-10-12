"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { getPlanForTeam } from "@/lib/opponent";
import { suggestTags } from "@/lib/opponentTags";
import type {
  MatchupPlan,
  Opponent,
  ParsedPokemon,
  PokemonSlot,
} from "@/types";
import { TeamRoster } from "../TeamRoster";
import { OpponentTags } from "../OpponentTags";
import { PokemonSlotPicker } from "../PokemonSlotPicker";
import { RowActionsMenu, type RowAction } from "../RowActionsMenu";
import { Icon } from "../Icon";
import { toast } from "../Toast";
import { IconName } from "@/enums";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface OpponentCardProps {
  opponent: Opponent;
  myTeamPokemon: ParsedPokemon[];
  activeTeamId: string | null;
  /** False when there's an active team but it isn't tagged for the page's currently selected regulation — blocks Lead/Back picking with an explanatory message instead of letting you plan with an off-regulation team (see MyTeamHeader's matching warning badge on the team switcher). */
  activeTeamMatchesRegulation: boolean;
  onEdit: () => void;
  onRemove: () => void;
  /** Extra ⋮ menu items — Move up/down, Make variant of…, Set as main, etc. */
  extraActions?: RowAction[];
  /** On a main with variants: the show/hide toggle, shown where desktop's ⋮ menu would otherwise sit. */
  variantToggle?: { count: number; isExpanded: boolean; onToggle: () => void };
  /** Shows a "Variant" chip after the name. */
  isVariant?: boolean;
  /** Label of the opponent the active team's plan was copied from, if it's still an unedited copy. */
  copiedFromLabel?: string;
  /** Drag handle shown before the label; the parent owns the drag-and-drop wiring. */
  dragHandle?: ReactNode;
  onUpdatePlan: (updater: (plan: MatchupPlan) => MatchupPlan) => void;
  onUpdateTags: (tags: string[]) => void;
  /** Every tag used in this regulation — autocomplete for the tag input. */
  knownTags: string[];
  isMatch?: (mon: ParsedPokemon) => boolean;
  isTagMatch?: (tag: string) => boolean;
}

const COLUMN_CLASSES = "flex min-w-0 flex-col border-r-1 border-zinc-300";
// h-7 + items-center: matches the roster column's edit/delete icon buttons
// (also h-7) so every column header — icons or not — centers on the same
// line, instead of icon-less headers sitting a few px higher.
const COLUMN_TITLE_CLASSES =
  "flex h-7 items-center text-xs font-semibold uppercase tracking-wide text-zinc-500";

/**
 * Its own component (rather than inline JSX reused at both the mobile and
 * desktop render sites below) so each site's textarea gets its own ref —
 * the same `ref` object can't be shared between two simultaneously-mounted
 * DOM nodes.
 */
/** Flags a variant's plan as still the main's copy — it disappears once the plan is edited (see clearCopiedPlanFlag). */
function CopiedFromBadge({ label }: { label: string }) {
  return (
    <span
      title={`This plan was copied from ${label} when this team became its variant. Edit it to make it this team's own.`}
      className="truncate rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    >
      Copied from {label}
    </span>
  );
}

function GamePlanNotes({
  notes,
  activeTeamId,
  onUpdatePlan,
  titleAccessory,
  copiedFromLabel,
}: {
  notes: string;
  activeTeamId: string | null;
  onUpdatePlan: (updater: (plan: MatchupPlan) => MatchupPlan) => void;
  /** Right-aligned on the "Game plan" title row — desktop puts the opponent's tags here. */
  titleAccessory?: ReactNode;
  copiedFromLabel?: string;
}) {
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Grow the notes textarea to fit its content, up to a cap — re-measured on
  // every value change. `min-h-16`/`max-h-32` (below) bound it: starts at
  // roughly two rows, grows with content, then scrolls internally past that
  // instead of growing the whole card indefinitely.
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [notes]);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className={`${COLUMN_TITLE_CLASSES} shrink-0`}>Game plan</h3>
          {copiedFromLabel && <CopiedFromBadge label={copiedFromLabel} />}
        </div>
        {titleAccessory}
      </div>
      <textarea
        ref={notesRef}
        value={notes}
        onChange={(event) => {
          const value = event.target.value;
          onUpdatePlan((p) => ({ ...p, notes: value }));
        }}
        disabled={!activeTeamId}
        rows={2}
        placeholder={
          activeTeamId
            ? "What would you do against this team?"
            : "Add your own team above to add notes."
        }
        aria-label="Notes"
        className="min-h-16 max-h-32 w-full flex-1 resize-none overflow-y-auto rounded-lg bg-transparent p-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-transparent disabled:cursor-not-allowed disabled:opacity-60"
      />
    </>
  );
}

export function OpponentCard({
  opponent,
  myTeamPokemon,
  activeTeamId,
  activeTeamMatchesRegulation,
  onEdit,
  onRemove,
  extraActions,
  variantToggle,
  isVariant,
  copiedFromLabel,
  dragHandle,
  onUpdatePlan,
  onUpdateTags,
  knownTags,
  isMatch,
  isTagMatch,
}: OpponentCardProps) {
  const plan = getPlanForTeam(opponent, activeTeamId);
  // Mobile only — desktop's 3-column grid (below) always shows everything;
  // below md the row starts collapsed to just the name + roster, since the
  // lead/back pickers and game plan notes make each row very tall stacked
  // vertically (see PLANNING.md).
  const [isExpanded, setIsExpanded] = useState(false);

  function setLeadSlot(slot: 0 | 1, index: PokemonSlot) {
    const next: [PokemonSlot, PokemonSlot] = [...plan.leadPair];
    next[slot] = index;
    onUpdatePlan((p) => ({ ...p, leadPair: next }));
  }

  function setBackSlot(slot: 0 | 1, index: PokemonSlot) {
    const next: [PokemonSlot, PokemonSlot] = [...plan.backPair];
    next[slot] = index;
    onUpdatePlan((p) => ({ ...p, backPair: next }));
  }

  function setLeadMega(slot: 0 | 1, value: boolean) {
    const next: [boolean, boolean] = [...plan.leadMega];
    next[slot] = value;
    onUpdatePlan((p) => ({ ...p, leadMega: next }));
  }

  function setBackMega(slot: 0 | 1, value: boolean) {
    const next: [boolean, boolean] = [...plan.backMega];
    next[slot] = value;
    onUpdatePlan((p) => ({ ...p, backMega: next }));
  }

  async function copyRawPaste() {
    try {
      await navigator.clipboard.writeText(opponent.team.rawPaste);
      toast.success(`Copied ${opponent.label} to clipboard`);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  const actionsMenu = (
    <RowActionsMenu
      onEdit={onEdit}
      onRemove={onRemove}
      label="Opponent options"
      middleAction={{
        label: "Copy",
        icon: IconName.ContentCopy,
        onClick: copyRawPaste,
      }}
      extraActions={extraActions}
    />
  );

  const variantToggleButton = variantToggle && (
    <button
      type="button"
      onClick={variantToggle.onToggle}
      aria-expanded={variantToggle.isExpanded}
      title={variantToggle.isExpanded ? "Hide variants" : "Show variants"}
      className="flex h-7 shrink-0 items-center gap-0.5 rounded-full border border-zinc-400 pl-2 pr-1 text-xs font-medium text-zinc-600 hover:border-zinc-500 hover:bg-zinc-100"
    >
      {variantToggle.count} variant{variantToggle.count === 1 ? "" : "s"}
      <Icon
        name={variantToggle.isExpanded ? IconName.ExpandLess : IconName.ExpandMore}
        size={16}
      />
    </button>
  );

  // Mobile renders this under the roster; desktop on the Game plan title row,
  // right-aligned (md:justify-end — each instance only shows at its own
  // breakpoint, so one node serves both).
  const tagsContent = (
    <OpponentTags
      tags={opponent.tags}
      suggestions={suggestTags(opponent.team.pokemon)}
      knownTags={knownTags}
      onChange={onUpdateTags}
      isMatch={isTagMatch}
      className="md:justify-end"
    />
  );

  const leadBackContent = !activeTeamId ? (
    <p className="max-w-48 text-sm text-amber-600">
      Add your own team above to pick lead/back Pokémon.
    </p>
  ) : !activeTeamMatchesRegulation ? (
    <p className="max-w-48 text-sm text-amber-600">
      Your active team isn&apos;t tagged for this regulation — switch to one
      that is, or tag this one, to pick lead/back Pokémon.
    </p>
  ) : (
    // Stacked (Lead row, then Back row) ONLY in the medium/tablet range —
    // same idea as TeamRoster's md compression — since this column is
    // auto-sized to its content and doesn't gain width until lg gives the
    // whole 3-column grid more room; only then do they sit side by side.
    // Base (mobile) and lg+ both keep the original flex-wrap layout so this
    // doesn't affect either of those. In the md-only stacked range the two
    // rows read as one 2x2 picker grid, so the gap tightens and the Back
    // label hides — a single "Leads and Backs" label (shown only there)
    // covers both instead of two separate ones.
    <div className="flex flex-wrap gap-6 md:flex-col md:gap-2 lg:flex-row lg:flex-wrap lg:gap-6">
      <div className="flex flex-col gap-1">
        <h3 className={`${COLUMN_TITLE_CLASSES} md:hidden lg:flex`}>Lead</h3>
        <h3 className={`${COLUMN_TITLE_CLASSES} hidden md:flex lg:hidden`}>
          Leads and Backs
        </h3>
        <div className="flex gap-2">
          <PokemonSlotPicker
            label="Lead 1"
            myTeamPokemon={myTeamPokemon}
            value={plan.leadPair[0]}
            onChange={(index) => setLeadSlot(0, index)}
            megaEnabled={plan.leadMega[0]}
            onMegaToggle={() => setLeadMega(0, !plan.leadMega[0])}
          />
          <PokemonSlotPicker
            label="Lead 2"
            myTeamPokemon={myTeamPokemon}
            value={plan.leadPair[1]}
            onChange={(index) => setLeadSlot(1, index)}
            megaEnabled={plan.leadMega[1]}
            onMegaToggle={() => setLeadMega(1, !plan.leadMega[1])}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={`${COLUMN_TITLE_CLASSES} md:hidden lg:flex`}>Back</h3>
        <div className="flex gap-2">
          <PokemonSlotPicker
            label="Back 1"
            myTeamPokemon={myTeamPokemon}
            value={plan.backPair[0]}
            onChange={(index) => setBackSlot(0, index)}
            megaEnabled={plan.backMega[0]}
            onMegaToggle={() => setBackMega(0, !plan.backMega[0])}
          />
          <PokemonSlotPicker
            label="Back 2"
            myTeamPokemon={myTeamPokemon}
            value={plan.backPair[1]}
            onChange={(index) => setBackSlot(1, index)}
            megaEnabled={plan.backMega[1]}
            onMegaToggle={() => setBackMega(1, !plan.backMega[1])}
          />
        </div>
      </div>
    </div>
  );

  return (
    <li>
      {/* Mobile: collapsed by default — just the name + roster, with a
          chevron that expands to reveal the lead/back pickers and game
          plan notes below. */}
      <div className="md:hidden">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="p-4">
            <div className="mb-1 flex h-7 items-center gap-1">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {dragHandle}
                <span
                  title={opponent.label}
                  className="max-w-48 truncate text-xs font-semibold uppercase tracking-wide text-zinc-600"
                >
                  {opponent.label}
                </span>
                {isVariant && (
                  <span className="shrink-0 rounded-full bg-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                    Variant
                  </span>
                )}
                {opponent.pokepasteUrl && (
                  <a
                    href={opponent.pokepasteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open Poképaste"
                    title="Open Poképaste"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name={IconName.OpenInNew} size={16} />
                  </a>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {variantToggleButton}
                {actionsMenu}
                <CollapsibleTrigger
                  aria-label={
                    isExpanded ? "Collapse team details" : "Expand team details"
                  }
                  title={isExpanded ? "Collapse" : "Expand"}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <Icon
                    name={isExpanded ? IconName.ExpandLess : IconName.ExpandMore}
                    size={18}
                  />
                </CollapsibleTrigger>
              </div>
            </div>
            <TeamRoster pokemon={opponent.team.pokemon} isMatch={isMatch} />
            <div className="mt-2">{tagsContent}</div>
          </div>
          <CollapsibleContent>
            <div className="border-t border-zinc-300 p-4">{leadBackContent}</div>
            <div className="border-t border-zinc-300 p-4">
              <GamePlanNotes
                notes={plan.notes}
                activeTeamId={activeTeamId}
                onUpdatePlan={onUpdatePlan}
                copiedFromLabel={copiedFromLabel}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop: unchanged always-visible 3-column grid. */}
      <div className="hidden md:grid md:grid-cols-[auto_auto_1fr] lg:grid-cols-[auto_auto_1fr]">
        <div className={COLUMN_CLASSES}>
          <div className="p-4">
            <div className="mb-1 flex h-7 items-center gap-1">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {dragHandle}
                <span
                  title={opponent.label}
                  className="max-w-48 truncate text-xs font-semibold uppercase tracking-wide text-zinc-600 md:max-w-36 lg:max-w-xs"
                >
                  {opponent.label}
                </span>
                {isVariant && (
                  <span className="shrink-0 rounded-full bg-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                    Variant
                  </span>
                )}
                {opponent.pokepasteUrl && (
                  <a
                    href={opponent.pokepasteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open Poképaste"
                    title="Open Poképaste"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name={IconName.OpenInNew} size={16} />
                  </a>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* "Open in Damage Calculator" link hidden — feature has known
                    bugs, not ready to publish yet. Re-add once stable (see
                    PLANNING.md). */}
                {/* Desktop's ⋮ menu lives on the Game plan title row, next to
                    the tags; this spot holds the variants toggle instead. */}
                {variantToggleButton}
              </div>
            </div>
            <TeamRoster pokemon={opponent.team.pokemon} isMatch={isMatch} />
          </div>
        </div>

        <div className={COLUMN_CLASSES}>
          <div className="p-4">{leadBackContent}</div>
        </div>

        <div className={COLUMN_CLASSES}>
          <div className="p-4">
            <GamePlanNotes
              notes={plan.notes}
              activeTeamId={activeTeamId}
              onUpdatePlan={onUpdatePlan}
              titleAccessory={
                <div className="flex min-w-0 items-center gap-2">
                  {tagsContent}
                  {actionsMenu}
                </div>
              }
              copiedFromLabel={copiedFromLabel}
            />
          </div>
        </div>
      </div>
    </li>
  );
}
