"use client";

import { leadBackSlotProps, PokemonSlotPicker } from "../PokemonSlotPicker";
import { PlanControls } from "../GamePlanCard";
import { RichTextEditor } from "../RichTextEditor";
import { useMessages } from "@/hooks/useLanguage";
import { notesToHtml } from "@/lib/matchupPlans";
import type { ParsedPokemon, TeamCombination } from "@/types";

const LABEL_CLASSES = "text-xs font-semibold tracking-wide text-zinc-500 uppercase";

interface TeamCombinationCardProps {
  combination: TeamCombination;
  /** Position in the team's list — the arrows reorder it. */
  index: number;
  total: number;
  teamPokemon: ParsedPokemon[];
  onUpdate: (updater: (combination: TeamCombination) => TeamCombination) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * One "common combination" on the Team Report's Strategy tab, laid out like
 * a matchup page plan (GamePlanCard) without the opponent's side: your
 * leads above your back (beside it on phones; picked from this team's roster; Back 2 can be
 * "A or B"), the notes as rich text beside them, and arrows to reorder.
 * Notes saved as plain text before still load (see notesToHtml).
 */
export function TeamCombinationCard({
  combination,
  index,
  total,
  teamPokemon,
  onUpdate,
  onMove,
  onRemove,
}: TeamCombinationCardProps) {
  const t = useMessages();
  const name = t.combination.title(index + 1);
  const slotProps = leadBackSlotProps(combination, teamPokemon, onUpdate, t, { flexBack: true });

  return (
    <section
      aria-label={name}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{name}</h3>
        <PlanControls
          name={name}
          index={index}
          total={total}
          onMove={onMove}
          onRemove={onRemove}
          removeLabel={t.combination.remove}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
        {/* Phones: leads and back side by side above the notes (wrapping if there's no
            room); md+: stacked, with the notes beside them. */}
        <div className="flex flex-wrap gap-x-4 gap-y-3 md:flex-col md:flex-nowrap">
          {(
            [
              [t.combination.leads, [0, 1]],
              [t.combination.back, [2, 3]],
            ] as const
          ).map(([label, pair]) => (
            <div key={label} className="flex flex-col gap-1">
              <h4 className={LABEL_CLASSES}>{label}</h4>
              <div className="flex gap-2">
                {pair.map((slot) => (
                  <PokemonSlotPicker key={slot} {...slotProps(slot)} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h4 className={LABEL_CLASSES}>{t.combination.notes}</h4>
          <RichTextEditor
            value={notesToHtml(combination.notes)}
            onChange={(notes) => onUpdate((c) => ({ ...c, notes }))}
            size="medium"
            placeholder={t.combination.notesPlaceholder}
            ariaLabel={`${name} — ${t.combination.notesLabel}`}
          />
        </div>
      </div>
    </section>
  );
}
