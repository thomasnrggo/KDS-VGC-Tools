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

interface SpeedTiersTableProps {
  /** src/data/species.json keys legal under the selected regulation. */
  speciesKeys: string[];
  /** Legal Mega Stone display name(s) for a species key under the selected regulation — see Regulation.megaStoneItemsForSpecies. */
  megaStoneItemsForSpecies: (speciesKey: string) => string[];
}

type SortKey =
  | "name"
  | "baseSpe"
  | "maxSpeed"
  | "neutral32"
  | "neutral0"
  | "minSpeed"
  | "maxScarf"
  | "neutral32Scarf"
  | "special";
type SortDirection = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "baseSpe", label: "Base" },
  { key: "maxSpeed", label: "Max Speed" },
  { key: "neutral32", label: "Neutral +32" },
  { key: "neutral0", label: "Neutral 0" },
  { key: "minSpeed", label: "Min Speed" },
  { key: "maxScarf", label: "Max Scarf" },
  { key: "neutral32Scarf", label: "Neutral +32 Scarf" },
  { key: "special", label: "Special" },
];

/** Resolves a row's value for a given sort key — routes "special" through its nested `.value` instead of indexing it directly, since it's an object, not a plain number. */
function valueForSort(row: SpeedTierRow, key: SortKey): number | string | null {
  if (key === "name") return row.name;
  if (key === "special") return row.special ? row.special.value : null;
  return row[key];
}

/** Row background per Speed-query proximity tier — exact match in amber, a result faster than the search in green, slower in red; `null` (no numeric query, or search by name) gets the default hover-only treatment. */
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

/** Numeric columns sort biggest-first on first click; the name column sorts A-Z first — matches how each reads naturally. */
function defaultDirectionFor(key: SortKey): SortDirection {
  return key === "name" ? "asc" : "desc";
}

function SortableHeader({
  label,
  active,
  direction,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  align: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th className="p-0 font-normal">
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-0.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${
          active ? "text-mauve-900" : "text-mauve-500 hover:text-mauve-800"
        } ${align === "right" ? "justify-end" : "justify-start"}`}
      >
        {align === "right" && active && (
          <Icon name={direction === "asc" ? IconName.ExpandLess : IconName.ExpandMore} size={16} />
        )}
        {label}
        {align === "left" && active && (
          <Icon name={direction === "asc" ? IconName.ExpandLess : IconName.ExpandMore} size={16} />
        )}
      </button>
    </th>
  );
}

/**
 * A pikalytics-style Speed Tiers reference table: every legal species under a
 * regulation (plus one extra row per legal Mega Stone), with Speed at the
 * handful of Stat-Point/nature/item spreads that actually matter for
 * outspeed math in Pokémon Champions (32 Stat Points replaces the classic
 * 252 EVs — see PLANNING.md). Sortable by any column, defaulting to Max
 * Speed descending, same as pikalytics' own default. Mega rows show "–" in
 * both Scarf columns — a held Mega Stone and Choice Scarf can't occupy the
 * same item slot. The "Special" column surfaces a row's conditional
 * Speed-doubling ability (a weather ability it has legal access to, or
 * Unburden) as Max Speed doubled + the condition, e.g. "300 in Rain" for
 * Mega Swampert — "–" for every row with no such ability.
 */
export function SpeedTiersTable({ speciesKeys, megaStoneItemsForSpecies }: SpeedTiersTableProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("maxSpeed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const rows = useMemo(
    () => computeSpeedTierRows(speciesKeys, megaStoneItemsForSpecies),
    [speciesKeys, megaStoneItemsForSpecies],
  );

  const numericQuery = useMemo(() => parseSpeedQuery(query), [query]);
  // A numeric query (e.g. "150") filters/highlights by Speed value, read off
  // whichever column is currently sorted — falling back to Max Speed when
  // sorted by name, since name has no numeric value to compare.
  const numericSortKey: SortKey = sortKey === "name" ? "maxSpeed" : sortKey;

  const visibleRows = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    const filtered =
      numericQuery !== null
        ? rows.filter((row) => {
            const value = valueForSort(row, numericSortKey);
            return typeof value === "number" && matchesSpeedQuery(value, numericQuery);
          })
        : trimmedQuery
          ? rows.filter((row) => row.name.toLowerCase().includes(trimmedQuery))
          : rows;

    const sorted = [...filtered].sort((a, b) => {
      const aValue = valueForSort(a, sortKey);
      const bValue = valueForSort(b, sortKey);
      // Null values (Scarf columns on Mega rows, Special on rows with no
      // doubling ability) always sort last, regardless of direction.
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      const comparison =
        typeof aValue === "string"
          ? aValue.localeCompare(bValue as string)
          : aValue - (bValue as number);
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [rows, query, numericQuery, numericSortKey, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(defaultDirectionFor(key));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchField
        query={query}
        onQueryChange={setQuery}
        placeholder="Search Pokémon or Speed…"
        ariaLabel="Search Pokémon or Speed"
        className="max-w-xs"
      />

      <div className="overflow-x-auto rounded-lg border border-mauve-200 bg-white">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[1060px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-mauve-50">
              <tr className="border-b border-mauve-200">
                <th className="w-10 p-0 font-normal">
                  <span className="flex w-full items-center pl-3 pr-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-mauve-500">
                    #
                  </span>
                </th>
                <SortableHeader
                  label="Pokémon"
                  align="left"
                  active={sortKey === "name"}
                  direction={sortDirection}
                  onClick={() => handleSort("name")}
                />
                {COLUMNS.map((column) => (
                  <SortableHeader
                    key={column.key}
                    label={column.label}
                    align="right"
                    active={sortKey === column.key}
                    direction={sortDirection}
                    onClick={() => handleSort(column.key)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const sortValue = valueForSort(row, numericSortKey);
                const tier =
                  numericQuery !== null && typeof sortValue === "number"
                    ? speedQueryTier(sortValue, numericQuery)
                    : null;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-mauve-100 last:border-b-0 ${tierRowClass(tier)}`}
                  >
                    <td className="w-10 pl-3 pr-1 py-1.5 text-mauve-400">{index + 1}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="relative h-8 w-8 shrink-0">
                          <PokemonSprite species={row.speciesName} item={row.item} fill />
                        </span>
                        <span className="truncate font-medium text-mauve-900">
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right text-mauve-700">{row.baseSpe}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-mauve-900">
                      {row.maxSpeed}
                    </td>
                    <td className="px-3 py-1.5 text-right text-mauve-700">{row.neutral32}</td>
                    <td className="px-3 py-1.5 text-right text-mauve-700">{row.neutral0}</td>
                    <td className="px-3 py-1.5 text-right text-mauve-700">{row.minSpeed}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-mauve-900">
                      {row.maxScarf ?? "–"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-mauve-700">
                      {row.neutral32Scarf ?? "–"}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      {row.special ? (
                        <>
                          <span className="font-semibold text-mauve-900">{row.special.value}</span>{" "}
                          <span className="text-xs text-mauve-500">{row.special.descriptor}</span>
                        </>
                      ) : (
                        <span className="text-mauve-700">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-3 py-6 text-center text-mauve-400">
                    No Pokémon match &quot;{query}&quot;.
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
