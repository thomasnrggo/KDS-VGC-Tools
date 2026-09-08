"use client";

import { useMemo, useState } from "react";
import { computeSpeedTierRows, type SpeedTierRow } from "@/lib/stats/computeSpeedTiers";
import {
  matchesSpeedQuery,
  parseSpeedQuery,
  speedQueryTier,
  type SpeedQueryTier,
} from "@/lib/stats/speedQuery";
import { PokemonSprite } from "../PokemonSprite";
import { SearchField } from "../SearchField";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

interface SpeedTiersListProps {
  /** src/data/species.json keys legal under the selected regulation. */
  speciesKeys: string[];
  /** Legal Mega Stone display name(s) for a species key under the selected regulation — see Regulation.megaStoneItemsForSpecies. */
  megaStoneItemsForSpecies: (speciesKey: string) => string[];
}

type MetricKey =
  | "baseSpe"
  | "maxSpeed"
  | "neutral32"
  | "neutral0"
  | "minSpeed"
  | "maxScarf"
  | "neutral32Scarf";

interface SpeedRecord {
  id: string;
  row: SpeedTierRow;
  metricKey: MetricKey;
  metricLabel: string;
  value: number;
}

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

/** Row/text background per Speed-query proximity tier — exact match in amber, a result faster than the search in green, slower in red; `null` (no numeric query, or search by name) gets the default hover-only treatment. */
function tierRowClass(tier: SpeedQueryTier | null): string {
  switch (tier) {
    case "exact":
      return "bg-amber-50 hover:bg-amber-100/70";
    case "higher":
      return "bg-green-50 hover:bg-green-100/70";
    case "lower":
      return "bg-red-50 hover:bg-red-100/70";
    default:
      return "hover:bg-mauve-50/60";
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
      return "text-mauve-900";
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
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-mauve-600 text-white"
          : "bg-mauve-100 text-mauve-500 hover:bg-mauve-200"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * The "one record per row" alternate view: every legal species' (plus Mega
 * forms') Speed at every metric, each as its own row, sorted together by
 * value — a true speed tier list rather than a per-Pokémon spreadsheet. See
 * SpeedTiersTable for the wide, one-row-per-Pokémon equivalent.
 */
export function SpeedTiersList({ speciesKeys, megaStoneItemsForSpecies }: SpeedTiersListProps) {
  const [query, setQuery] = useState("");
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    () => new Set(METRICS.filter((metric) => metric.defaultActive).map((metric) => metric.key)),
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const rows = useMemo(
    () => computeSpeedTierRows(speciesKeys, megaStoneItemsForSpecies),
    [speciesKeys, megaStoneItemsForSpecies],
  );

  const allRecords = useMemo(() => flattenToRecords(rows), [rows]);

  const numericQuery = useMemo(() => parseSpeedQuery(query), [query]);

  const visibleRecords = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    const filtered = allRecords.filter((record) => {
      if (!activeMetrics.has(record.metricKey)) return false;
      // A numeric query (e.g. "150") searches by Speed value, within the
      // tolerance band — otherwise it's a name substring match.
      if (numericQuery !== null) return matchesSpeedQuery(record.value, numericQuery);
      if (trimmedQuery && !record.row.name.toLowerCase().includes(trimmedQuery)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const comparison = a.value - b.value || a.row.name.localeCompare(b.row.name);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [allRecords, activeMetrics, query, numericQuery, sortDirection]);

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
          placeholder="Search Pokémon or Speed…"
          ariaLabel="Search Pokémon or Speed"
          className="max-w-xs"
        />
        <div role="group" aria-label="Filter metrics" className="flex flex-wrap gap-1.5">
          {METRICS.map((metric) => (
            <MetricFilterChip
              key={metric.key}
              label={metric.label}
              active={activeMetrics.has(metric.key)}
              onClick={() => toggleMetric(metric.key)}
            />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-mauve-200 bg-white">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-mauve-50">
              <tr className="border-b border-mauve-200">
                <th className="w-12 p-0 font-normal">
                  <span className="flex w-full items-center pl-3 pr-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-mauve-500">
                    #
                  </span>
                </th>
                <th className="p-0 font-normal">
                  <span className="flex w-full items-center px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-mauve-500">
                    Pokémon
                  </span>
                </th>
                <th className="p-0 font-normal">
                  <button
                    type="button"
                    onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                    className="flex w-full items-center justify-end gap-0.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-mauve-900 whitespace-nowrap"
                  >
                    <Icon
                      name={sortDirection === "asc" ? IconName.ExpandLess : IconName.ExpandMore}
                      size={16}
                    />
                    Speed
                  </button>
                </th>
                <th className="p-0 font-normal">
                  <span className="flex w-full items-center px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-mauve-500">
                    Config
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record, index) => {
                const tier = numericQuery !== null ? speedQueryTier(record.value, numericQuery) : null;
                return (
                  <tr
                    key={record.id}
                    className={`border-b border-mauve-100 last:border-b-0 ${tierRowClass(tier)}`}
                  >
                    <td className="w-12 pl-3 pr-1 py-1.5 text-mauve-400">{index + 1}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="relative h-8 w-8 shrink-0">
                          <PokemonSprite species={record.row.speciesName} item={record.row.item} fill />
                        </span>
                        <span className="truncate font-medium text-mauve-900">
                          {record.row.name}
                        </span>
                      </div>
                    </td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${tierTextClass(tier)}`}>
                      {record.value}
                    </td>
                    <td className="px-3 py-1.5 text-mauve-600">{record.metricLabel}</td>
                  </tr>
                );
              })}
              {visibleRecords.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-mauve-400">
                    No records match the current search/filters.
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
