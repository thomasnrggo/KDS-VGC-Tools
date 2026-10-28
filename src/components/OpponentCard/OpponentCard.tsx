"use client";

import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import { Fragment, useState, type ReactNode } from "react";
import { getPlanForTeam } from "@/lib/opponent";
import { suggestTags } from "@/lib/opponentTags";
import type { MatchupPlan, Opponent, ParsedPokemon } from "@/types";
import { TeamRoster } from "../TeamRoster";
import { OpponentTags } from "../OpponentTags";
import { leadBackSlotProps, PokemonSlotPicker } from "../PokemonSlotPicker";
import { RowActionsMenu, type RowAction } from "../RowActionsMenu";
import { Icon } from "../Icon";
import { toast } from "../Toast";
import { IconName } from "@/enums";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/RichTextEditor";
import { PlanControls } from "@/components/GamePlanCard";
import {
  addPlan,
  listPlans,
  movePlan,
  notesToHtml,
  planLetter,
  removePlan,
  theirPicksSummary,
  updatePlanAt,
} from "@/lib/matchupPlans";

export interface OpponentCardProps {
  opponent: Opponent;
  myTeamPokemon: ParsedPokemon[];
  activeTeamId: string | null;
  /** False when there's an active team but it isn't tagged for the page's currently selected regulation — blocks Lead/Back picking with an explanatory message instead of letting you plan with an off-regulation team (see MyTeamHeader's matching warning badge on the team switcher). */
  activeTeamMatchesRegulation: boolean;
  onEdit: () => void;
  /** Omit to hide Remove — a prep-group opponent only its adder and the group owner may remove. */
  onRemove?: () => void;
  /** Opens this opponent's team in the Damage Calculator (a new tab) — an icon next to the name. */
  calcHref?: string;
  /** The opponent's matchup page — makes its name a link, with an icon beside the calculator's. */
  matchupHref?: string;
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
  const t = useMessages();
  return (
    <span
      title={t.opponentCard.copiedFromTitle(label)}
      className="truncate rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    >
      {t.opponentCard.copiedFrom(label)}
    </span>
  );
}

function GamePlanNotes({
  notes,
  activeTeamId,
  onNotesChange,
  titleAccessory,
  copiedFromLabel,
  planLabel,
  planToggle,
  theirPicks,
}: {
  /** "Plan A", "Plan B"… — shown once the matchup has more than one plan. */
  planLabel?: string;
  /** Plan A's "+N plans" button, beside its badge. */
  planToggle?: ReactNode;
  /**
   * The opponent's expected picks for this plan ("Garchomp - Farigiraf & …"),
   * shown as "vs …" after the badge from md up, and on a tap of the badge.
   */
  theirPicks?: string;
  notes: string;
  activeTeamId: string | null;
  onNotesChange: (html: string) => void;
  /** Right-aligned on the "Game plan" title row — desktop puts the opponent's tags here. */
  titleAccessory?: ReactNode;
  copiedFromLabel?: string;
}) {
  const t = useMessages();
  const versus = theirPicks && `${t.matchupPage.vs} ${theirPicks}`;
  const badgeClasses =
    "shrink-0 rounded-full bg-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-700 uppercase";

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className={cn(COLUMN_TITLE_CLASSES, "shrink-0")}>{t.opponentCard.gamePlan}</h3>
          {planLabel &&
            (versus ? (
              // A tap on the badge shows who the plan is against — the
              // only place it shows on phones, where the text is hidden.
              <Popover.Root>
                <Popover.Trigger className={cn(badgeClasses, "cursor-pointer hover:bg-zinc-400")}>
                  {planLabel}
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner side="top" sideOffset={6} className="isolate z-50">
                    <Popover.Popup className="max-w-xs rounded-md bg-chrome-800 px-3 py-1.5 text-xs text-white shadow-md">
                      {versus}
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            ) : (
              <span className={badgeClasses}>{planLabel}</span>
            ))}
          {versus && (
            <span
              title={versus}
              className="hidden min-w-0 truncate text-xs text-zinc-500 md:inline"
            >
              {versus}
            </span>
          )}
          {planToggle}
          {copiedFromLabel && <CopiedFromBadge label={copiedFromLabel} />}
        </div>
        {titleAccessory}
      </div>
      {/* Rich text (bold, bullets) like the matchup page's plans — Plan A's notes are the same field. */}
      <RichTextEditor
        variant="bare"
        value={notesToHtml(notes)}
        onChange={onNotesChange}
        disabled={!activeTeamId}
        placeholder={activeTeamId ? t.opponentCard.notesPlaceholder : t.opponentCard.notesNeedTeam}
        ariaLabel={planLabel ? `${planLabel} — ${t.opponentCard.notes}` : t.opponentCard.notes}
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
  calcHref,
  matchupHref,
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
  const t = useMessages();
  const plan = getPlanForTeam(opponent, activeTeamId);
  // Mobile only — desktop's 3-column grid (below) always shows everything;
  // below md the row starts collapsed to just the name + roster, since the
  // lead/back pickers and game plan notes make each row very tall stacked
  // vertically (see PLANNING.md).
  const [isExpanded, setIsExpanded] = useState(false);

  const slotProps = leadBackSlotProps(plan, myTeamPokemon, onUpdatePlan, t, { flexBack: true });
  // Plans B, C… under the row, behind a "+N plans" toggle — editable here
  // too; the matchup page is the roomier place for them.
  const plans = listPlans(plan);
  const text = usePokemonText();
  const picksSummary = (index: number) =>
    theirPicksSummary(plans[index]?.theirs, opponent.team.pokemon, text.species);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const planAName = t.matchupPage.plan(planLetter(0));
  const planALabel = plans.length > 1 ? planAName : undefined;
  const canPlan = !!activeTeamId && activeTeamMatchesRegulation;
  // "+N plans" sits beside the variants toggle; Plans B, C… then show as more
  // rows of the card's own columns (your picks, game plan) — the opponent's
  // expected picks stay on the matchup page.
  const plansToggle = canPlan && plans.length > 1 && (
    <button
      type="button"
      onClick={() => setIsPlansOpen((open) => !open)}
      aria-expanded={isPlansOpen}
      title={isPlansOpen ? t.matchupPage.hidePlans : undefined}
      className="flex h-5 shrink-0 items-center gap-0.5 rounded-full border border-zinc-400 pr-0.5 pl-1.5 text-[11px] font-medium text-zinc-600 hover:border-zinc-500 hover:bg-zinc-100"
    >
      {t.matchupPage.morePlans(plans.length - 1)}
      <Icon name={isPlansOpen ? IconName.ExpandLess : IconName.ExpandMore} size={14} />
    </button>
  );

  async function copyRawPaste() {
    try {
      await navigator.clipboard.writeText(opponent.team.rawPaste);
      toast.success(t.opponentCard.copiedToClipboard(opponent.label));
    } catch {
      toast.error(t.opponentCard.copyFailed);
    }
  }

  const actionsMenu = (
    <RowActionsMenu
      onEdit={onEdit}
      onRemove={onRemove}
      label={t.opponentCard.options}
      middleAction={{
        label: t.opponentCard.copy,
        icon: IconName.ContentCopy,
        onClick: copyRawPaste,
      }}
      extraActions={[
        ...(canPlan
          ? [
              {
                label: t.matchupPage.addPlan,
                icon: IconName.Add,
                onClick: () => {
                  onUpdatePlan(addPlan);
                  setIsPlansOpen(true);
                },
              },
            ]
          : []),
        ...(extraActions ?? []),
      ]}
    />
  );

  const variantToggleButton = variantToggle && (
    <button
      type="button"
      onClick={variantToggle.onToggle}
      aria-expanded={variantToggle.isExpanded}
      title={variantToggle.isExpanded ? t.opponentCard.hideVariants : t.opponentCard.showVariants}
      className="flex h-7 shrink-0 items-center gap-0.5 rounded-full border border-zinc-400 pr-1 pl-2 text-xs font-medium text-zinc-600 hover:border-zinc-500 hover:bg-zinc-100"
    >
      {t.opponentCard.variantCount(variantToggle.count)}
      <Icon name={variantToggle.isExpanded ? IconName.ExpandLess : IconName.ExpandMore} size={16} />
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

  const pickers = (slots: typeof slotProps) => (
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
        <h3 className={cn(COLUMN_TITLE_CLASSES, "md:hidden lg:flex")}>{t.opponentCard.lead}</h3>
        <h3 className={cn(COLUMN_TITLE_CLASSES, "hidden md:flex lg:hidden")}>
          {t.opponentCard.leadsAndBacks}
        </h3>
        <div className="flex gap-2">
          <PokemonSlotPicker {...slots(0)} />
          <PokemonSlotPicker {...slots(1)} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={cn(COLUMN_TITLE_CLASSES, "md:hidden lg:flex")}>{t.opponentCard.back}</h3>
        <div className="flex gap-2">
          <PokemonSlotPicker {...slots(2)} />
          <PokemonSlotPicker {...slots(3)} />
        </div>
      </div>
    </div>
  );

  const leadBackContent = !activeTeamId ? (
    <p className="max-w-48 text-sm text-amber-600">{t.opponentCard.needTeam}</p>
  ) : !activeTeamMatchesRegulation ? (
    <p className="max-w-48 text-sm text-amber-600">{t.opponentCard.teamNotInRegulation}</p>
  ) : (
    pickers(slotProps)
  );

  const extraPlanRows = (isPlansOpen && canPlan ? plans.slice(1) : []).map((gamePlan, offset) => {
    const index = offset + 1;
    const name = t.matchupPage.plan(planLetter(index));
    return {
      key: gamePlan.id,
      pickers: pickers(
        leadBackSlotProps(
          gamePlan,
          myTeamPokemon,
          (updater) => onUpdatePlan((p) => updatePlanAt(p, index, updater)),
          t,
          { flexBack: true },
        ),
      ),
      notes: (
        <GamePlanNotes
          notes={gamePlan.notes}
          activeTeamId={activeTeamId}
          onNotesChange={(html) =>
            onUpdatePlan((p) => updatePlanAt(p, index, (plan) => ({ ...plan, notes: html })))
          }
          planLabel={name}
          theirPicks={picksSummary(index)}
          titleAccessory={
            <PlanControls
              name={name}
              index={index}
              total={plans.length}
              onMove={(direction) => onUpdatePlan((p) => movePlan(p, index, direction))}
              onRemove={() => onUpdatePlan((p) => removePlan(p, index))}
            />
          }
        />
      ),
    };
  });

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
                {matchupHref ? (
                  <Link
                    href={matchupHref}
                    title={t.matchupPage.open}
                    className="min-w-0 truncate text-xs font-semibold tracking-wide text-zinc-600 uppercase hover:text-zinc-900 hover:underline"
                  >
                    {opponent.label}
                  </Link>
                ) : (
                  <span
                    title={opponent.label}
                    className="min-w-0 truncate text-xs font-semibold tracking-wide text-zinc-600 uppercase"
                  >
                    {opponent.label}
                  </span>
                )}
                {isVariant && (
                  <span className="shrink-0 rounded-full bg-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 uppercase">
                    {t.opponentCard.variant}
                  </span>
                )}
                {opponent.pokepasteUrl && (
                  <a
                    href={opponent.pokepasteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.opponentCard.openPokepaste}
                    title={t.opponentCard.openPokepaste}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name={IconName.OpenInNew} size={16} />
                  </a>
                )}
                {matchupHref && (
                  <Link
                    href={matchupHref}
                    aria-label={t.matchupPage.open}
                    title={t.matchupPage.open}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name={IconName.Description} size={16} />
                  </Link>
                )}
                {calcHref && (
                  <a
                    href={calcHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.opponents.openInCalc}
                    title={t.opponents.openInCalc}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name={IconName.Calculate} size={16} />
                  </a>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {variantToggleButton}
                {actionsMenu}
                <CollapsibleTrigger
                  aria-label={
                    isExpanded ? t.opponentCard.collapseDetails : t.opponentCard.expandDetails
                  }
                  title={isExpanded ? t.opponentCard.collapse : t.opponentCard.expand}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <Icon name={isExpanded ? IconName.ExpandLess : IconName.ExpandMore} size={18} />
                </CollapsibleTrigger>
              </div>
            </div>
            <TeamRoster pokemon={opponent.team.pokemon} isMatch={isMatch} speedMode="range" />
            <div className="mt-2">{tagsContent}</div>
          </div>
          <CollapsibleContent>
            <div className="border-t border-zinc-300 p-4">{leadBackContent}</div>
            <div className="border-t border-zinc-300 p-4">
              <GamePlanNotes
                notes={plan.notes}
                activeTeamId={activeTeamId}
                onNotesChange={(html) => onUpdatePlan((p) => ({ ...p, notes: html }))}
                copiedFromLabel={copiedFromLabel}
                // Phones hide the "vs …" text, so the badge shows whenever there are picks to tap for.
                planLabel={planALabel ?? (canPlan && picksSummary(0) ? planAName : undefined)}
                theirPicks={canPlan ? picksSummary(0) : undefined}
                planToggle={plansToggle}
              />
            </div>
            {extraPlanRows.map((row) => (
              <div key={row.key}>
                <div className="border-t border-zinc-300 p-4">{row.pickers}</div>
                <div className="border-t border-zinc-300 p-4">{row.notes}</div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop: unchanged always-visible 3-column grid. */}
      <div className="hidden md:grid md:grid-cols-[auto_auto_1fr] lg:grid-cols-[auto_auto_1fr]">
        <div className={COLUMN_CLASSES}>
          <div className="p-4">
            <div className="mb-1 flex h-7 w-0 min-w-full items-center gap-1">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {dragHandle}
                {matchupHref ? (
                  <Link
                    href={matchupHref}
                    title={t.matchupPage.open}
                    className="min-w-0 truncate text-xs font-semibold tracking-wide text-zinc-600 uppercase hover:text-zinc-900 hover:underline"
                  >
                    {opponent.label}
                  </Link>
                ) : (
                  <span
                    title={opponent.label}
                    className="min-w-0 truncate text-xs font-semibold tracking-wide text-zinc-600 uppercase"
                  >
                    {opponent.label}
                  </span>
                )}
                {isVariant && (
                  <span className="shrink-0 rounded-full bg-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 uppercase">
                    {t.opponentCard.variant}
                  </span>
                )}
                {opponent.pokepasteUrl && (
                  <a
                    href={opponent.pokepasteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.opponentCard.openPokepaste}
                    title={t.opponentCard.openPokepaste}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name={IconName.OpenInNew} size={16} />
                  </a>
                )}
                {matchupHref && (
                  <Link
                    href={matchupHref}
                    aria-label={t.matchupPage.open}
                    title={t.matchupPage.open}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name={IconName.Description} size={16} />
                  </Link>
                )}
                {calcHref && (
                  <a
                    href={calcHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.opponents.openInCalc}
                    title={t.opponents.openInCalc}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name={IconName.Calculate} size={16} />
                  </a>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* Desktop's ⋮ menu lives on the Game plan title row, next to
                    the tags; this spot holds the variants toggle instead. */}
                {variantToggleButton}
              </div>
            </div>
            <TeamRoster pokemon={opponent.team.pokemon} isMatch={isMatch} speedMode="range" />
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
              onNotesChange={(html) => onUpdatePlan((p) => ({ ...p, notes: html }))}
              titleAccessory={
                <div className="flex min-w-0 items-center gap-2">
                  {tagsContent}
                  {actionsMenu}
                </div>
              }
              copiedFromLabel={copiedFromLabel}
              planLabel={planALabel}
              theirPicks={canPlan ? picksSummary(0) : undefined}
              planToggle={plansToggle}
            />
          </div>
        </div>
        {/* Plans B, C…: the first column stays empty — same opponent. */}
        {extraPlanRows.map((row) => (
          <Fragment key={row.key}>
            <div className={cn(COLUMN_CLASSES, "border-t border-zinc-300")} />
            <div className={cn(COLUMN_CLASSES, "border-t border-zinc-300")}>
              <div className="p-4">{row.pickers}</div>
            </div>
            <div className={cn(COLUMN_CLASSES, "border-t border-zinc-300")}>
              <div className="p-4">{row.notes}</div>
            </div>
          </Fragment>
        ))}
      </div>
    </li>
  );
}
