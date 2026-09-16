"use client";

import { useState } from "react";
import { REGULATIONS } from "@/data/regulations";
import { getRegulationLegalityIssues } from "@/lib/regulationLegality";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import type { Team } from "@/types";

interface TeamRegulationTagsProps {
  team: Team;
  onTag: (regulationId: string) => void;
  onUntag: (regulationId: string) => void;
}

/** Strips the "Regulation " prefix a Regulation's own label always carries (e.g. "Regulation M-C" -> "M-C") — these badges are small, so the short form reads better than repeating "Regulation" once per tag. */
function shortLabel(label: string): string {
  return label.replace(/^Regulation\s+/, "");
}

/**
 * A team's regulation tags, shown as small pills with an "add tag" button —
 * lets a team built under one regulation (e.g. M-B) also be tagged as legal
 * under another (e.g. M-C) it happens to still qualify for, so it shows up
 * when picking a team for that regulation elsewhere in the app (Tournaments,
 * Speed Tiers). Every candidate regulation is re-validated against this
 * team's actual roster before it's offered — chronological order alone
 * (M-C came after M-B) is never trusted, since a regulation can ban things
 * as well as add them.
 */
export function TeamRegulationTags({ team, onTag, onUntag }: TeamRegulationTagsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const untaggedRegulations = REGULATIONS.filter(
    (regulation) => !team.regulationIds.includes(regulation.id),
  );

  return (
    <div className="flex flex-wrap items-center gap-1">
      {team.regulationIds.map((regulationId) => {
        const regulation = REGULATIONS.find((r) => r.id === regulationId);
        if (!regulation) return null;
        const canUntag = team.regulationIds.length > 1;
        return (
          <span
            key={regulationId}
            className="flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 py-0.5 pl-2 pr-1 text-[11px] font-medium text-zinc-700"
          >
            {shortLabel(regulation.label)}
            {canUntag && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onUntag(regulationId);
                }}
                aria-label={`Untag ${regulation.label}`}
                title={`Untag ${regulation.label}`}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-300 hover:text-zinc-800"
              >
                <Icon name={IconName.Close} size={10} />
              </button>
            )}
          </span>
        );
      })}
      {untaggedRegulations.length > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsPickerOpen(true);
          }}
          aria-label={`Tag ${team.name} with another regulation`}
          title="Tag with another regulation"
          className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <Icon name={IconName.Add} size={11} />
        </button>
      )}

      {isPickerOpen && (
        <Modal onClose={() => setIsPickerOpen(false)} labelledBy="tag-regulation-modal-title">
          <h2
            id="tag-regulation-modal-title"
            className="mb-1 text-lg font-semibold text-zinc-900"
          >
            Tag {team.name} with a regulation
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            Tagging a regulation makes this team selectable there too — e.g. Tournaments and Speed
            Tiers Timeline. Only regulations this roster is actually legal under are offered.
          </p>
          <ul className="flex flex-col gap-2">
            {untaggedRegulations.map((regulation) => {
              const issues = getRegulationLegalityIssues(team.pokemon, regulation);
              const isLegal = issues.length === 0;
              return (
                <li key={regulation.id}>
                  <button
                    type="button"
                    disabled={!isLegal}
                    onClick={() => {
                      onTag(regulation.id);
                      setIsPickerOpen(false);
                    }}
                    className="flex w-full flex-col gap-1 rounded-lg border border-zinc-200 p-3 text-left transition-colors enabled:hover:border-zinc-400 enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                      <Icon
                        name={isLegal ? IconName.Check : IconName.Close}
                        size={16}
                        className={isLegal ? "text-emerald-600" : "text-zinc-400"}
                      />
                      {regulation.label}
                    </span>
                    {!isLegal && (
                      <span className="pl-6 text-xs text-zinc-500">
                        Not legal here: {issues.map((issue) => issue.reason).join(" ")}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setIsPickerOpen(false)}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
