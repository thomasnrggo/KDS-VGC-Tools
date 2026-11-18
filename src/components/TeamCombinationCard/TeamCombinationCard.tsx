"use client";

import { leadBackSlotProps, PokemonSlotPicker } from "../PokemonSlotPicker";
import { PlanControls } from "../GamePlanCard";
import { RichTextEditor, RichTextView } from "../RichTextEditor";
import { useState } from "react";
import { useCollapsedCombinations } from "@/hooks/useCollapsedCombinations";
import { Icon } from "../Icon";
import { TextAction } from "../Button";
import { IconName } from "@/enums";
import { DEFAULT_ARCHETYPE_SET } from "@/lib/archetypes";
import { hasRichText } from "@/lib/richText";
import { useMessages } from "@/hooks/useLanguage";
import { notesToHtml } from "@/lib/matchupPlans";
import type { CombinationRecord } from "@/lib/combinationInsights";
import { cn } from "@/lib/utils";
import type { ParsedPokemon, TeamCombination } from "@/types";

const LABEL_CLASSES = "text-[11px] font-semibold tracking-wide text-zinc-500 uppercase";

interface TeamCombinationCardProps {
  combination: TeamCombination;
  /** Position in the team's list — the arrows reorder it. */
  index: number;
  total: number;
  teamPokemon: ParsedPokemon[];
  /** How it did in the games you logged with this four (combinationRecord); none on a shared report. */
  record?: CombinationRecord;
  /** Omit the three to show it read only — a shared report's combination. */
  onUpdate?: (updater: (combination: TeamCombination) => TeamCombination) => void;
  onMove?: (direction: -1 | 1) => void;
  onRemove?: () => void;
}

const noChange = () => {};

/**
 * One "common combination" on the Team Report's Strategy tab: a name you
 * give it, labels for what it's for ("vs Trick Room") beside it, and how it
 * did in the games you logged with these four; below, your leads above your
 * back (beside them on phones; picked from this team's roster; Back 2 can
 * be "A or B") and the notes as rich text beside them. Notes saved as plain
 * text before still load (see notesToHtml).
 */
export function TeamCombinationCard({
  combination,
  index,
  total,
  teamPokemon,
  record,
  onUpdate,
  onMove,
  onRemove,
}: TeamCombinationCardProps) {
  const t = useMessages();
  const c = t.combination;
  const fallbackName = c.title(index + 1);
  const name = combination.name?.trim() || fallbackName;
  const slotProps = leadBackSlotProps(combination, teamPokemon, onUpdate ?? noChange, t, {
    flexBack: true,
  });
  const notes = notesToHtml(combination.notes);

  const labelsChange =
    onUpdate &&
    ((labels: string[]) =>
      onUpdate((current) => {
        const next = { ...current };
        // `delete`, not `undefined` — Firestore rejects undefined values.
        if (labels.length) next.labels = labels;
        else delete next.labels;
        return next;
      }));

  const { collapsed, setCollapsed } = useCollapsedCombinations();
  const isCollapsed = collapsed.includes(combination.id);
  const picks = (
    [
      [c.leads, [0, 1]],
      [c.back, [2, 3]],
    ] as const
  ).map(([label, pair]) => (
    <div key={label} className="flex flex-col gap-1">
      <h4 className={LABEL_CLASSES}>{label}</h4>
      <div className="flex gap-2">
        {pair.map((slot) => (
          <PokemonSlotPicker key={slot} {...slotProps(slot)} readOnly={!onUpdate} />
        ))}
      </div>
    </div>
  ));

  return (
    <section
      aria-label={name}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-raised p-4 shadow-xs"
    >
      {/* Collapse, the name, its labels beside it, then the record and the controls. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <button
          type="button"
          onClick={() => setCollapsed([combination.id], !isCollapsed)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? c.expand(name) : c.collapse(name)}
          title={isCollapsed ? c.expand(name) : c.collapse(name)}
          className="-ml-1 rounded text-zinc-500 hover:text-zinc-800"
        >
          <Icon
            name={IconName.ExpandMore}
            size={18}
            className={cn("transition-transform", isCollapsed && "-rotate-90")}
          />
        </button>
        {onUpdate ? (
          <input
            value={combination.name ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onUpdate((current) => {
                const next = { ...current };
                if (value) next.name = value;
                else delete next.name;
                return next;
              });
            }}
            placeholder={fallbackName}
            aria-label={c.nameLabel}
            maxLength={60}
            className="-ml-1.5 field-sizing-content max-w-full min-w-24 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-zinc-900 placeholder:text-zinc-900 hover:border-zinc-200 focus:border-zinc-300 focus:bg-field focus:outline-none"
          />
        ) : (
          <h3 className="text-sm font-semibold text-zinc-900">{name}</h3>
        )}
        <CombinationLabels labels={combination.labels ?? []} onChange={labelsChange} />
        <div className="ml-auto flex items-center gap-2">
          {record && record.played > 0 && (
            <span className="shrink-0 text-xs text-zinc-500 tabular-nums" title={c.recordHint}>
              {c.record(
                record.wins,
                record.losses,
                record.ties,
                `${Math.round(((record.wins + record.ties / 2) / record.played) * 100)}%`,
              )}
            </span>
          )}
          {onMove && onRemove && (
            <PlanControls
              name={name}
              index={index}
              total={total}
              onMove={onMove}
              onRemove={onRemove}
              removeLabel={c.remove}
            />
          )}
        </div>
      </div>

      {isCollapsed ? (
        // Collapsed: the picks in one row, Leads | Back; the notes hidden.
        <div className="flex flex-wrap gap-x-4 gap-y-3">{picks}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
          {/* Phones: leads and back side by side above the notes (wrapping if there's no
              room); md+: stacked, with the notes beside them. */}
          <div className="flex flex-wrap gap-x-4 gap-y-3 md:flex-col md:flex-nowrap">{picks}</div>
          <div className="flex min-w-0 flex-col gap-2">
            <h4 className={LABEL_CLASSES}>{c.notes}</h4>
            {!onUpdate ? (
              hasRichText(notes) && <RichTextView html={notes} />
            ) : (
              <RichTextEditor
                value={notes}
                onChange={(notes) => onUpdate((current) => ({ ...current, notes }))}
                size="medium"
                placeholder={c.notesPlaceholder}
                ariaLabel={`${name} — ${c.notesLabel}`}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Labels a combination can have, at most. */
const MAX_LABELS = 6;

/** Suggested labels: "vs" each main archetype (not its variants — "Sun", not "Sun · Chlorophyll"). */
const SUGGESTED_ARCHETYPES = DEFAULT_ARCHETYPE_SET.archetypes
  .filter((archetype) => !archetype.name.includes("·"))
  .map((archetype) => archetype.name);

/**
 * What a combination is for, as chips — "vs Trick Room", "vs Sun", or
 * anything typed — with "+ Label" to add one (the archetypes suggested) and
 * × to remove one. Read only without `onChange`.
 */
function CombinationLabels({
  labels,
  onChange,
}: {
  labels: string[];
  onChange?: (labels: string[]) => void;
}) {
  const c = useMessages().combination;
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  if (labels.length === 0 && !onChange) return null;

  const add = (label: string) => {
    const value = label.trim();
    if (!value || !onChange) return;
    if (!labels.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      onChange([...labels, value]);
    }
    setDraft("");
    setIsAdding(false);
  };
  const suggestions = SUGGESTED_ARCHETYPES.map(c.vsLabel).filter(
    (label) => !labels.includes(label) && label.toLowerCase().includes(draft.trim().toLowerCase()),
  );

  // Inline in the card's title row; the add field wraps to a line of its own below it.
  return (
    <>
      <ul className="flex flex-wrap items-center gap-1.5">
        {labels.map((label) => (
          <li
            key={label}
            className="flex items-center gap-1 rounded-full bg-chrome-800 py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-chrome-50"
          >
            {label}
            {onChange && (
              <button
                type="button"
                onClick={() => onChange(labels.filter((entry) => entry !== label))}
                aria-label={c.removeLabel(label)}
                className="rounded-full text-chrome-300 hover:text-chrome-50"
              >
                <Icon name={IconName.Close} size={12} />
              </button>
            )}
          </li>
        ))}
        {onChange && !isAdding && labels.length < MAX_LABELS && (
          <li>
            <TextAction
              className={cn("flex items-center gap-0.5 text-xs", labels.length === 0 && "-ml-0.5")}
              onClick={() => setIsAdding(true)}
            >
              <Icon name={IconName.Add} size={14} />
              {c.addLabel}
            </TextAction>
          </li>
        )}
      </ul>
      {isAdding && (
        <div className="order-last flex basis-full flex-col gap-1.5 rounded-lg border border-zinc-200 p-2">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add(draft);
                } else if (event.key === "Escape") {
                  setIsAdding(false);
                  setDraft("");
                }
              }}
              placeholder={c.labelPlaceholder}
              aria-label={c.addLabel}
              maxLength={30}
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-field px-2 py-1 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
            />
            <TextAction
              className="text-xs"
              onClick={() => {
                setIsAdding(false);
                setDraft("");
              }}
            >
              {c.cancel}
            </TextAction>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => add(label)}
                  className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
