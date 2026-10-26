"use client";

import { useMemo, useState } from "react";
import { computeSpeedTierRows, type SpeedTierRow } from "@/lib/stats/computeSpeedTiers";
import {
  matchesSpeedQuery,
  parseSpeedQuery,
  speedQueryTier,
  type SpeedQueryTier,
} from "@/lib/stats/speedQuery";
import { matchesAnySearchTerm, parseSearchTerms } from "@/lib/pokemonMatchesQuery";
import { PokemonSprite } from "../PokemonSprite";
import { SearchField } from "../SearchField";
import { GroupModeToggle } from "../GroupModeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

interface SpeedTiersListProps {
  /** src/data/species.json keys legal under the selected regulation. */
  speciesKeys: string[];
  /** Legal Mega Stone display name(s) for a species key under the selected regulation — see Regulation.megaStoneItemsForSpecies. */
  megaStoneItemsForSpecies: (speciesKey: string) => string[];
}

type MetricKey =
  "baseSpe" | "maxSpeed" | "neutral32" | "neutral0" | "minSpeed" | "maxScarf" | "neutral32Scarf";

interface SpeedRecord {
  id: string;
  row: SpeedTierRow;
  metricKey: MetricKey;
  metricLabel: string;
  value: number;
}

/** One speed-tier line: every record tied on the same value at the same metric, e.g. Mega Alakazam and Mega Aerodactyl both at 222 Max Speed. */
interface SpeedGroup {
  id: string;
  metricKey: MetricKey;
  metricLabel: string;
  value: number;
  records: SpeedRecord[];
}

// `label` is a stable sort tiebreaker; what's shown comes from the dictionary (speedTable.columns).
const METRICS: { key: MetricKey; label: string; defaultActive: boolean }[] = [
  { key: "maxScarf", label: "Max Scarf", defaultActive: true },
  { key: "maxSpeed", label: "Max Speed", defaultActive: true },
  { key: "neutral32Scarf", label: "Neutral +32 Scarf", defaultActive: true },
  { key: "neutral32", label: "Neutral +32", defaultActive: true },
  { key: "neutral0", label: "Neutral 0", defaultActive: true },
  // Off by default: the raw base stat, before any Stat Points/nature are
  // applied — no real Pokémon shows up with this as its actual Speed, it's
  // reference-only (Neutral 0 is the real floor a Pokémon can actually have
  // in battle: 0 Stat Points + a neutral nature, still with the fixed IV of
  // 31 every Pokémon has in Champions).
  { key: "baseSpe", label: "Base", defaultActive: false },
  { key: "minSpeed", label: "Min Speed", defaultActive: true },
];

type SortDirection = "asc" | "desc";

/**
 * Flattens computeSpeedTierRows' wide rows (one Pokémon, six-to-seven
 * columns) into one entry per (Pokémon, metric) pair — every "record" gets
 * its own row, all sorted together by raw Speed value, so you can see
 * exactly where e.g. a Neutral +32 Alakazam falls relative to a Max Scarf
 * Talonflame. Per a 2026-09-08 follow-up request, as an alternate view of
 * the same underlying data SpeedTiersTable renders as a spreadsheet.
 */
function flattenToRecords(rows: SpeedTierRow[]): SpeedRecord[] {
  const records: SpeedRecord[] = [];
  for (const row of rows) {
    for (const metric of METRICS) {
      const value = row[metric.key];
      if (value === null) continue;
      records.push({
        id: `${row.id}-${metric.key}`,
        row,
        metricKey: metric.key,
        metricLabel: metric.label,
        value,
      });
    }
  }
  return records;
}

/** Groups records tied on the same value at the same metric into one tier line — same value at a different metric stays separate, since "Max Speed 200" and "Neutral +32 Scarf 200" aren't the same line. Order within a group is alphabetical, for a stable sprite layout. */
function groupRecords(records: SpeedRecord[]): SpeedGroup[] {
  const groups = new Map<string, SpeedGroup>();
  for (const record of records) {
    const key = `${record.value}-${record.metricKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.records.push(record);
    } else {
      groups.set(key, {
        id: key,
        metricKey: record.metricKey,
        metricLabel: record.metricLabel,
        value: record.value,
        records: [record],
      });
    }
  }
  for (const group of groups.values()) {
    group.records.sort((a, b) => a.row.name.localeCompare(b.row.name));
  }
  return [...groups.values()];
}

/** Wraps a single record as its own one-member group — used in "By Pokémon" mode, where grouping is skipped entirely and every (Pokémon, metric) record gets its own row. Shares the same SpeedGroup shape as groupRecords' output so the rest of the component doesn't need to branch on mode. */
function toSingletonGroup(record: SpeedRecord): SpeedGroup {
  return {
    id: record.id,
    metricKey: record.metricKey,
    metricLabel: record.metricLabel,
    value: record.value,
    records: [record],
  };
}

/** Row/text background per Speed-query proximity tier — exact match in amber, a result faster than the search in green, slower in red; `null` (no numeric query, or search by name) gets the default hover-only treatment. */
function tierRowClass(tier: SpeedQueryTier | null): string {
  switch (tier) {
    case "exact":
      return "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950 dark:hover:bg-amber-900/70";
    case "higher":
      return "bg-green-50 hover:bg-green-100/70 dark:bg-green-950 dark:hover:bg-green-900/70";
    case "lower":
      return "bg-red-50 hover:bg-red-100/70 dark:bg-red-950 dark:hover:bg-red-900/70";
    default:
      return "hover:bg-zinc-50/60";
  }
}

function tierTextClass(tier: SpeedQueryTier | null): string {
  switch (tier) {
    case "exact":
      return "text-amber-700";
    case "higher":
      return "text-green-700";
    case "lower":
      return "text-red-700";
    default:
      return "text-zinc-900";
  }
}

function MetricFilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-chrome-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200",
      )}
    >
      {label}
    </button>
  );
}

/**
 * The "one tier per row" alternate view: every legal species' (plus Mega
 * forms') Speed at every metric, sorted together by value — a true speed
 * tier list rather than a per-Pokémon spreadsheet. Records tied on the same
 * value at the same metric (e.g. Mega Alakazam and Mega Aerodactyl both at
 * 222 Max Speed) share one row, shown as sprites rather than repeated names.
 * A "Grouped" / "By Pokémon" toggle switches between that merged view and
 * one row per (Pokémon, metric) record, with its name shown instead of
 * sprites-only. See SpeedTiersTable for the wide, one-row-per-Pokémon
 * spreadsheet equivalent.
 */
export function SpeedTiersList({ speciesKeys, megaStoneItemsForSpecies }: SpeedTiersListProps) {
  const t = useMessages();
  const text = usePokemonText();
  const displayName = (row: SpeedTierRow) => text.speciesForm(row.speciesName, row.item, row.name);
  const [query, setQuery] = useState("");
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    () => new Set(METRICS.filter((metric) => metric.defaultActive).map((metric) => metric.key)),
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [groupMode, setGroupMode] = useState(true);

  const rows = useMemo(
    () => computeSpeedTierRows(speciesKeys, megaStoneItemsForSpecies),
    [speciesKeys, megaStoneItemsForSpecies],
  );

  const allRecords = useMemo(() => flattenToRecords(rows), [rows]);

  const numericQuery = useMemo(() => parseSpeedQuery(query), [query]);
  const searchTerms = useMemo(() => parseSearchTerms(query), [query]);

  const visibleGroups = useMemo(() => {
    const filtered = allRecords.filter((record) => {
      if (!activeMetrics.has(record.metricKey)) return false;
      // A numeric query (e.g. "150") searches by Speed value, within the
      // tolerance band — otherwise it's a name search, matching if the
      // Pokémon's name contains ANY of the space-separated terms (e.g.
      // "charizard garchomp" returns rows for either one).
      if (numericQuery !== null) return matchesSpeedQuery(record.value, numericQuery);
      if (
        searchTerms.length &&
        !matchesAnySearchTerm(
          record.row.name,
          searchTerms,
          text.speciesForm(record.row.speciesName, record.row.item, record.row.name),
        )
      ) {
        return false;
      }
      return true;
    });

    const groups = groupMode ? groupRecords(filtered) : filtered.map(toSingletonGroup);

    return groups.sort((a, b) => {
      const comparison =
        a.value - b.value ||
        a.metricLabel.localeCompare(b.metricLabel) ||
        a.records[0].row.name.localeCompare(b.records[0].row.name);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [allRecords, activeMetrics, searchTerms, numericQuery, sortDirection, groupMode, text]);

  function toggleMetric(key: MetricKey) {
    setActiveMetrics((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          query={query}
          onQueryChange={setQuery}
          placeholder={t.speedTable.searchPlaceholder}
          ariaLabel={t.speedTable.searchLabel}
          className="max-w-xs"
        />
        <div role="group" aria-label={t.speedList.filterMetrics} className="flex flex-wrap gap-1.5">
          {METRICS.map((metric) => (
            <MetricFilterChip
              key={metric.key}
              label={t.speedTable.columns[metric.key]}
              active={activeMetrics.has(metric.key)}
              onClick={() => toggleMetric(metric.key)}
            />
          ))}
        </div>
        <GroupModeToggle grouped={groupMode} onChange={setGroupMode} className="ml-auto" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50">
              <tr className="border-b border-zinc-200">
                <th className="w-12 p-0 font-normal">
                  <span className="flex w-full items-center py-2 pr-1 pl-3 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    #
                  </span>
                </th>
                <th className="p-0 font-normal">
                  <span className="flex w-full items-center px-3 py-2 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {t.speedTable.pokemon}
                  </span>
                </th>
                <th className="p-0 font-normal">
                  <button
                    type="button"
                    onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                    className="flex w-full items-center justify-end gap-0.5 px-3 py-2 text-xs font-semibold tracking-wide whitespace-nowrap text-zinc-900 uppercase"
                  >
                    <Icon
                      name={sortDirection === "asc" ? IconName.ExpandLess : IconName.ExpandMore}
                      size={16}
                    />
                    {t.speedList.speed}
                  </button>
                </th>
                <th className="p-0 font-normal">
                  <span className="flex w-full items-center px-3 py-2 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {t.speedList.config}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((group, index) => {
                const tier =
                  numericQuery !== null ? speedQueryTier(group.value, numericQuery) : null;
                return (
                  <tr
                    key={group.id}
                    className={cn("border-b border-zinc-100 last:border-b-0", tierRowClass(tier))}
                  >
                    <td className="w-12 py-1.5 pr-1 pl-3 text-zinc-400">{index + 1}</td>
                    <td className="px-3 py-1.5">
                      {groupMode ? (
                        // max-w caps the row at 7 sprites (7 * 56px sprite + 6 * 6px gap) before wrapping to a new line.
                        <div className="flex max-w-[428px] flex-wrap items-center gap-1.5">
                          {group.records.map((record) => (
                            <Tooltip key={record.id}>
                              <TooltipTrigger
                                render={<span className="relative h-14 w-14 shrink-0" />}
                              >
                                <PokemonSprite
                                  species={record.row.speciesName}
                                  item={record.row.item}
                                  fill
                                />
                              </TooltipTrigger>
                              <TooltipContent>{displayName(record.row)}</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="relative h-14 w-14 shrink-0">
                            <PokemonSprite
                              species={group.records[0].row.speciesName}
                              item={group.records[0].row.item}
                              fill
                            />
                          </span>
                          <span className="truncate font-medium text-zinc-900">
                            {displayName(group.records[0].row)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className={cn("px-3 py-1.5 text-right font-semibold", tierTextClass(tier))}>
                      {group.value}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-zinc-600">
                      {t.speedTable.columns[group.metricKey]}
                    </td>
                  </tr>
                );
              })}
              {visibleGroups.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">
                    {t.speedList.noMatches}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
