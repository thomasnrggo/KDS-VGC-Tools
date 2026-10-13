"use client";

import { useState } from "react";
import {
  defaultDecision,
  type ImportDecision,
  type ImportRow,
} from "@/lib/opponentImport";
import { Modal } from "../Modal";
import { TeamRoster } from "../TeamRoster";
import { useMessages } from "@/hooks/useLanguage";

interface ImportReviewProps {
  rows: ImportRow[];
  onConfirm: (decisions: ImportDecision[]) => void;
  onCancel: () => void;
}

const NEW = "new";
const SKIP = "skip";

function decisionValue(decision: ImportDecision): string {
  return decision.action === "variant" ? String(decision.candidateIndex) : decision.action;
}

function decisionFromValue(value: string): ImportDecision {
  if (value === NEW) return { action: "new" };
  if (value === SKIP) return { action: "skip" };
  return { action: "variant", candidateIndex: Number(value) };
}


/**
 * The import step that asks before grouping: lists every incoming team with
 * what will happen to it — duplicates and unparseable teams are skipped
 * (shown, not editable), and each team with a variant candidate gets a
 * picker defaulting to its best group (see defaultDecision). Only opened
 * when at least one team has a candidate; otherwise imports go straight
 * through.
 */
export function ImportReview({ rows, onConfirm, onCancel }: ImportReviewProps) {
  const t = useMessages();
  const [decisions, setDecisions] = useState<ImportDecision[]>(() => rows.map(defaultDecision));

  const importCount = rows.filter(
    (row, index) => !row.error && row.duplicateOf === undefined && decisions[index].action !== "skip",
  ).length;
  const variantCount = decisions.filter((decision) => decision.action === "variant").length;

  return (
    <Modal onClose={onCancel} labelledBy="import-review-title" size="wide">
      <h2 id="import-review-title" className="mb-1 text-lg font-semibold text-zinc-900">
        {t.importReview.title}
      </h2>
      <p className="mb-4 text-sm text-zinc-600">
        {t.importReview.intro}
      </p>

      <ul className="flex max-h-[60vh] flex-col divide-y divide-zinc-200 overflow-y-auto rounded-lg border border-zinc-200">
        {rows.map((row, index) => {
          const isLocked = !!row.error || row.duplicateOf !== undefined;
          const decision = decisions[index];
          const chosenCandidate =
            decision.action === "variant" ? row.candidates[decision.candidateIndex] : undefined;
          return (
            <li
              key={index}
              className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between ${
                isLocked ? "opacity-60" : ""
              }`}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  {row.label}
                </span>
                {row.pokemon.length > 0 && <TeamRoster pokemon={row.pokemon} speedMode="range" />}
              </div>
              {row.error ? (
                <span className="shrink-0 text-sm text-zinc-500">{t.importReview.cantImport(row.error)}</span>
              ) : row.duplicateOf !== undefined ? (
                <span className="shrink-0 text-sm text-zinc-500">
                  {t.importReview.alreadySaved(row.duplicateOf)}
                </span>
              ) : (
                <div className="flex w-full shrink-0 flex-col gap-1 sm:w-64">
                  <select
                    value={decisionValue(decision)}
                    onChange={(event) => {
                      const next = [...decisions];
                      next[index] = decisionFromValue(event.target.value);
                      setDecisions(next);
                    }}
                    aria-label={t.importReview.whatToDo(row.label)}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-700"
                  >
                    {row.candidates.map((candidate, candidateIndex) => (
                      <option key={candidateIndex} value={String(candidateIndex)}>
                        {t.importReview.variantOf(candidate.label)}
                      </option>
                    ))}
                    <option value={NEW}>{t.importReview.addAsNew}</option>
                    <option value={SKIP}>{t.importReview.dontImport}</option>
                  </select>
                  {/* The match detail sits under the picker rather than in
                      the option text, which a native select truncates. */}
                  {chosenCandidate && (
                    <span className="px-1 text-xs text-zinc-500">
                      {t.importReview.inCommon(
                        chosenCandidate.comparison.sharedPokemon,
                        chosenCandidate.comparison.sharedMegas,
                      )}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onConfirm(decisions)}
          disabled={importCount === 0}
          className="rounded-full bg-zinc-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-400 dark:hover:bg-zinc-300"
        >
          {t.importReview.importButton(importCount, variantCount)}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          {t.common.cancel}
        </button>
      </div>
    </Modal>
  );
}
