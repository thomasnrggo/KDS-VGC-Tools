"use client";

import { useState } from "react";
import type { ParsedPokemon } from "@/types";
import { analyzeTeamCoverage, coverageGaps, weakSpots, type DefenseCell } from "@/lib/teamCoverage";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { useMeta } from "@/hooks/useMeta";
import { cn } from "@/lib/utils";
import { TogglePill } from "../Button";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { PokemonSprite } from "../PokemonSprite";
import { TypeIcon } from "../TypeIcon";

const FRACTIONS: Record<number, string> = {
  0.125: "⅛",
  0.25: "¼",
  0.5: "½",
  0.75: "¾",
  1.25: "1¼",
};

/** "4×", "½×", "0" — short enough for a phone-width column. */
function formatMultiplier(value: number): string {
  if (value === 0) return "0";
  return `${FRACTIONS[value] ?? Number(value.toFixed(2))}×`;
}

/** Defense: red the more a type hurts, green the more it's resisted. */
function defenseCellClass(value: number): string {
  if (value === 0) return "bg-chrome-800 text-chrome-100";
  if (value <= 0.25) return "bg-green-500/35 font-semibold text-green-800 dark:text-green-200";
  if (value < 1) return "bg-green-500/15 text-green-700 dark:text-green-300";
  if (value === 1) return "text-zinc-400";
  if (value >= 4) return "bg-red-500/40 font-semibold text-red-800 dark:text-red-100";
  if (value >= 2) return "bg-red-500/20 text-red-700 dark:text-red-300";
  return "bg-red-500/10 text-red-600 dark:text-red-300";
}

/** Offense: green for a super-effective hit, muted for a resisted best. */
function offenseCellClass(value: number | null): string {
  if (value === null) return "text-zinc-300";
  if (value === 0) return "bg-chrome-800 text-chrome-100";
  if (value >= 4) return "bg-green-500/35 font-semibold text-green-800 dark:text-green-200";
  if (value > 1) return "bg-green-500/20 text-green-700 dark:text-green-300";
  if (value === 1) return "text-zinc-400";
  return "bg-red-500/10 text-red-600 dark:text-red-300";
}

function netClass(net: number): string {
  if (net > 0) return "text-green-700 dark:text-green-300";
  if (net < 0) return "font-semibold text-red-600 dark:text-red-300";
  return "text-zinc-500";
}

type Table = "defense" | "offense";

interface TeamCoverageProps {
  pokemon: ParsedPokemon[];
  /** The team's regulation, for its metagame data. */
  regulationId: string | undefined;
}

/**
 * The team page's Coverage tab, answer first: the weak spots (who's hit, who
 * covers it) and coverage gaps (and the best the team has), then an 18-type
 * tally grid — tap a type for its breakdown — and the full type × member
 * table, collapsed. See src/lib/teamCoverage.ts.
 */
export function TeamCoverage({ pokemon, regulationId }: TeamCoverageProps) {
  const t = useMessages();
  const text = usePokemonText();
  const { appLanguage } = useLanguageSettings();
  const { meta } = useMeta(regulationId);
  const [table, setTable] = useState<Table>("defense");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  if (pokemon.length === 0) {
    return <p className="text-sm text-zinc-500">{t.coverage.empty}</p>;
  }

  const coverage = analyzeTeamCoverage(pokemon);
  const spots = weakSpots(coverage);
  const gaps = coverageGaps(coverage);
  // Type column, one per member, then the summary column(s).
  const memberColumns = `repeat(${pokemon.length}, minmax(0, 2.75rem))`;

  const memberHeaders = pokemon.map((mon, index) => (
    <span
      key={index}
      title={text.species(mon.species)}
      className="relative mx-auto h-8 w-8 sm:h-9 sm:w-9"
    >
      <PokemonSprite species={mon.species} item={mon.item} fill />
    </span>
  ));

  function typeLabel(type: string) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 overflow-hidden rounded">
          <TypeIcon type={type} size={18} />
        </span>
        <span className="hidden truncate text-xs text-zinc-700 sm:inline">{text.type(type)}</span>
      </span>
    );
  }

  function cellTitle(cell: DefenseCell) {
    return cell.reason ? t.coverage.changedBy(cell.reason) : undefined;
  }

  const defenseTable = (
    <div
      role="table"
      aria-label={t.coverage.defense}
      className="grid items-center gap-x-1 gap-y-0.5 text-center text-xs tabular-nums"
      style={{ gridTemplateColumns: `minmax(1.75rem, 7rem) ${memberColumns} repeat(3, 2.25rem)` }}
    >
      <span className="text-left text-[10px] font-semibold text-zinc-500 uppercase">
        {t.coverage.type}
      </span>
      {memberHeaders}
      <span className="text-[10px] font-semibold text-zinc-500 uppercase">{t.coverage.weak}</span>
      <span className="text-[10px] font-semibold text-zinc-500 uppercase">{t.coverage.resist}</span>
      <span className="text-[10px] font-semibold text-zinc-500 uppercase">{t.coverage.net}</span>
      {coverage.defense.map((row) => (
        <div key={row.type} role="row" className="contents">
          {typeLabel(row.type)}
          {row.cells.map((cell, index) => (
            <span
              key={index}
              title={cellTitle(cell)}
              className={cn(
                "relative flex h-7 items-center justify-center rounded",
                defenseCellClass(cell.multiplier),
              )}
            >
              {formatMultiplier(cell.multiplier)}
              {/* A dot marks a cell an ability or item changed. */}
              {cell.reason && (
                <span className="absolute top-0.5 right-0.5 h-1 w-1 rounded-full bg-current opacity-70" />
              )}
            </span>
          ))}
          <span className={row.weak > 0 ? "text-red-600 dark:text-red-300" : "text-zinc-400"}>
            {row.weak}
          </span>
          <span className={row.resist > 0 ? "text-green-700 dark:text-green-300" : "text-zinc-400"}>
            {row.resist}
          </span>
          <span className={netClass(row.net)}>{row.net > 0 ? `+${row.net}` : row.net}</span>
        </div>
      ))}
    </div>
  );

  const offenseTable = coverage.hasMoves ? (
    <div
      role="table"
      aria-label={t.coverage.offense}
      className="grid items-center gap-x-1 gap-y-0.5 text-center text-xs tabular-nums"
      style={{ gridTemplateColumns: `minmax(1.75rem, 7rem) ${memberColumns} 3rem` }}
    >
      <span className="text-left text-[10px] font-semibold text-zinc-500 uppercase">
        {t.coverage.type}
      </span>
      {memberHeaders}
      <span className="text-[10px] leading-tight font-semibold text-zinc-500 uppercase">
        {t.coverage.superEffective}
      </span>
      {coverage.offense.map((row) => (
        <div key={row.type} role="row" className="contents">
          {typeLabel(row.type)}
          {row.best.map((value, index) => {
            const move = row.bestMoves[index];
            return (
              <span
                key={index}
                title={value === null ? t.coverage.noMovesCell : move ? text.move(move) : undefined}
                className={cn(
                  "flex h-7 items-center justify-center rounded",
                  offenseCellClass(value),
                )}
              >
                {value === null ? "—" : formatMultiplier(value)}
              </span>
            );
          })}
          <span
            className={
              row.superEffective > 0
                ? "text-green-700 dark:text-green-300"
                : "font-semibold text-red-600 dark:text-red-300"
            }
          >
            {row.superEffective}
          </span>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-sm text-zinc-500">{t.coverage.noMoves}</p>
  );

  // Which side the overview grid, its breakdown and the full table show.
  const side = table;
  const selectedDefense = coverage.defense.find((row) => row.type === selectedType);
  const selectedOffense = coverage.offense.find((row) => row.type === selectedType);

  return (
    <div className="flex flex-col gap-6">
      {/* The answer first: what to watch out for, naming who's hit and who covers it. */}
      <section className="flex flex-col gap-2">
        <h2 className={SECTION_TITLE}>{t.coverage.watchOut}</h2>
        {spots.length === 0 ? (
          <p className="text-sm text-zinc-500">{t.coverage.noWeakSpots}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-zinc-50">
            {spots.map((row) => {
              const hit = memberIndexes(row.cells, (value) => value > 1);
              const covers = memberIndexes(row.cells, (value) => value < 1);
              return (
                <li
                  key={row.type}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5"
                >
                  <TypeName type={row.type} className="w-28 shrink-0" />
                  <MemberGroup
                    label={t.coverage.weak}
                    tone="bad"
                    members={hit.map((index) => ({
                      mon: pokemon[index],
                      badge: badgeFor(row.cells[index].multiplier),
                    }))}
                    emptyLabel={t.coverage.nobody}
                  />
                  <MemberGroup
                    label={t.coverage.resist}
                    tone="good"
                    members={covers.map((index) => ({
                      mon: pokemon[index],
                      badge: badgeFor(row.cells[index].multiplier),
                    }))}
                    emptyLabel={t.coverage.nobody}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={SECTION_TITLE}>{t.coverage.gaps}</h2>
        {!coverage.hasMoves ? (
          <p className="text-sm text-zinc-500">{t.coverage.noMoves}</p>
        ) : gaps.length === 0 ? (
          <p className="text-sm text-zinc-500">{t.coverage.noGaps}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-zinc-50">
            {gaps.map((row) => {
              const best = Math.max(...row.best.map((value) => value ?? -1));
              const users = memberIndexes(row.best, (value) => value === best);
              return (
                <li
                  key={row.type}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5"
                >
                  <TypeName type={row.type} className="w-28 shrink-0" />
                  <span className="text-sm text-zinc-700">
                    {best <= 0
                      ? t.coverage.bestNone
                      : best < 1
                        ? t.coverage.bestResisted
                        : t.coverage.bestNeutral}
                  </span>
                  {best > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      {users.map((index) => {
                        const move = row.bestMoves[index];
                        return (
                          <MemberSprite
                            key={index}
                            mon={pokemon[index]}
                            title={move ? text.move(move) : undefined}
                          />
                        );
                      })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* The overview: every type at a glance, tap one for who it hits and who covers it. */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={SECTION_TITLE}>{t.coverage.allTypes}</h2>
          <div className="flex gap-1.5">
            {(["defense", "offense"] as const).map((option) => (
              <TogglePill
                key={option}
                active={side === option}
                onClick={() => setTable(option)}
                className="px-3.5 py-1.5 text-sm"
              >
                {t.coverage[option]}
              </TogglePill>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          {side === "defense" ? t.coverage.defenseTally : t.coverage.offenseTally}
        </p>
        {side === "offense" && !coverage.hasMoves ? (
          <p className="text-sm text-zinc-500">{t.coverage.noMoves}</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 xl:grid-cols-9">
            {(side === "defense" ? coverage.defense : coverage.offense).map((row) => {
              const isDefense = "cells" in row;
              const bad = isDefense ? row.weak : 0;
              const good = isDefense ? row.resist : row.superEffective;
              const flagged = isDefense
                ? spots.some((spot) => spot.type === row.type)
                : row.superEffective === 0;
              const isSelected = selectedType === row.type;
              return (
                <button
                  key={row.type}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedType(isSelected ? null : row.type)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-lg border bg-zinc-50 p-2 text-left transition-colors hover:bg-zinc-100",
                    flagged ? "border-red-300 dark:border-red-800" : "border-zinc-200",
                    isSelected && "ring-2 ring-zinc-500",
                  )}
                >
                  <TypeName type={row.type} small />
                  <Tally bad={bad} good={good} total={pokemon.length} />
                </button>
              );
            })}
          </div>
        )}

        {/* The tapped type's breakdown. */}
        {side === "defense" && selectedDefense && (
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <TypeName type={selectedDefense.type} />
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {groupByMultiplier(selectedDefense.cells.map((cell) => cell.multiplier)).map(
                ([multiplier, indexes]) => (
                  <span key={multiplier} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs tabular-nums",
                        defenseCellClass(multiplier),
                      )}
                    >
                      {formatMultiplier(multiplier)}
                    </span>
                    {indexes.map((index) => (
                      <MemberSprite
                        key={index}
                        mon={pokemon[index]}
                        title={cellTitle(selectedDefense.cells[index])}
                      />
                    ))}
                  </span>
                ),
              )}
            </div>
          </div>
        )}
        {side === "offense" && coverage.hasMoves && selectedOffense && (
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <TypeName type={selectedOffense.type} />
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {selectedOffense.best.map((value, index) => (
                <span key={index} className="flex items-center gap-1.5">
                  <MemberSprite mon={pokemon[index]} />
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs tabular-nums",
                      offenseCellClass(value),
                    )}
                  >
                    {value === null ? "—" : formatMultiplier(value)}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {value === null
                      ? t.coverage.noMovesCell
                      : selectedOffense.bestMoves[index] &&
                        text.move(selectedOffense.bestMoves[index])}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Every number, for when the overview isn't enough. */}
      <details className="group flex flex-col gap-2">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-zinc-700 hover:text-zinc-900">
          <Icon
            name={IconName.ExpandMore}
            size={18}
            className="-rotate-90 transition-transform group-open:rotate-0"
          />
          <span className="group-open:hidden">{t.coverage.showTable}</span>
          <span className="hidden group-open:inline">{t.coverage.hideTable}</span>
        </summary>
        <div className="mt-3 flex flex-col gap-2 overflow-x-auto">
          <p className="text-xs text-zinc-500">
            {side === "defense" ? t.coverage.defenseHint : t.coverage.offenseHint}
          </p>
          {side === "defense" ? defenseTable : offenseTable}
        </div>
      </details>

      <div className="flex flex-col gap-1 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
        <p>{t.coverage.scope}</p>
        {meta && (
          <p>
            {t.coverage.metaSource(
              meta.official.tournaments.length,
              meta.official.teams,
              new Date(meta.updatedAt).toLocaleDateString(appLanguage, {
                month: "short",
                day: "numeric",
              }),
              meta.official.source,
            )}
          </p>
        )}
      </div>
    </div>
  );
}

const SECTION_TITLE = "text-xs font-semibold tracking-wide text-zinc-500 uppercase";

/** The members (by index) whose value passes `test`. */
function memberIndexes<T>(values: T[], test: (value: number) => boolean): number[] {
  return values.flatMap((value, index) => {
    const number =
      typeof value === "number" ? value : (value as { multiplier?: number } | null)?.multiplier;
    return number !== undefined && number !== null && test(number) ? [index] : [];
  });
}

/** Members grouped by multiplier, most damage first. */
function groupByMultiplier(values: number[]): [number, number[]][] {
  const groups = new Map<number, number[]>();
  values.forEach((value, index) => groups.set(value, [...(groups.get(value) ?? []), index]));
  return [...groups.entries()].sort(([a], [b]) => b - a);
}

/** A sprite's corner badge: only the extremes (4×, ¼×, immune), since the group already says weak or resists. */
function badgeFor(multiplier: number): string | undefined {
  if (multiplier === 0 || multiplier >= 4 || multiplier <= 0.25)
    return formatMultiplier(multiplier);
  return undefined;
}

function TypeName({
  type,
  small = false,
  className,
}: {
  type: string;
  small?: boolean;
  className?: string;
}) {
  const text = usePokemonText();
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span className="shrink-0 overflow-hidden rounded">
        <TypeIcon type={type} size={small ? 16 : 20} />
      </span>
      <span className={cn("truncate font-medium text-zinc-900", small ? "text-xs" : "text-sm")}>
        {text.type(type)}
      </span>
    </span>
  );
}

function MemberSprite({
  mon,
  badge,
  title,
}: {
  mon: ParsedPokemon;
  badge?: string;
  title?: string;
}) {
  const text = usePokemonText();
  const name = text.species(mon.species);
  return (
    <span title={title ? `${name} — ${title}` : name} className="relative h-9 w-9 shrink-0">
      <span className="absolute inset-0 overflow-hidden rounded-md bg-zinc-200">
        <PokemonSprite species={mon.species} item={mon.item} fill />
      </span>
      {badge && (
        <span className="absolute -right-1 -bottom-1 rounded bg-chrome-800 px-1 text-[10px] leading-4 font-semibold text-chrome-50 tabular-nums">
          {badge}
        </span>
      )}
    </span>
  );
}

/** "Weak: [sprites]" or "Resist: [sprites]", with "nobody" when empty. */
function MemberGroup({
  label,
  tone,
  members,
  emptyLabel,
}: {
  label: string;
  tone: "good" | "bad";
  members: { mon: ParsedPokemon; badge?: string }[];
  emptyLabel: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          "text-xs font-semibold",
          tone === "bad" ? "text-red-600 dark:text-red-300" : "text-green-700 dark:text-green-300",
        )}
      >
        {label}
      </span>
      {members.length === 0 ? (
        <span className="text-sm text-zinc-500">{emptyLabel}</span>
      ) : (
        <span className="flex flex-wrap gap-1.5">
          {members.map(({ mon, badge }, index) => (
            <MemberSprite key={index} mon={mon} badge={badge} />
          ))}
        </span>
      )}
    </span>
  );
}

/** A type tile's tally: a red tick per member weak to it, a green one per member that resists (or hits it, on offense). */
function Tally({ bad, good, total }: { bad: number; good: number; total: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${bad} / ${good}`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-3 flex-1 rounded-sm",
            index < bad ? "bg-red-500" : index >= total - good ? "bg-green-600" : "bg-zinc-200",
          )}
        />
      ))}
    </span>
  );
}
