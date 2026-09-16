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
  | "neutral32Scarf";
type SortDirection = "asc" | "desc";

const SCARF_NOT_APPLICABLE_HINT =
  "Doesn't apply to the Mega Pokémon in this row — a held Mega Stone and Choice Scarf can't occupy the same item slot.";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "baseSpe", label: "Base" },
  { key: "maxSpeed", label: "Max Speed" },
  { key: "neutral32", label: "Neutral +32" },
  { key: "neutral0", label: "Neutral 0" },
  { key: "minSpeed", label: "Min Speed" },
  { key: "maxScarf", label: "Max Scarf" },
  { key: "neutral32Scarf", label: "Neutral +32 Scarf" },
];

/** Resolves a row's value for a given sort key. */
function valueForSort(row: SpeedTierRow, key: SortKey): number | string | null {
  if (key === "name") return row.name;
  return row[key];
}

/**
 * One spreadsheet row shared by every Pokémon tied across every displayed
 * stat column — not just the sorted one. Grouping on anything less than the
 * full displayed stat line would silently merge rows a viewer could still
 * tell apart.
 *
 * The Scarf columns are the one exception: `maxScarf`/`neutral32Scarf` are
 * null on a Mega row purely because a held Mega Stone and Choice Scarf can't
 * share an item slot — not because the computed speed would differ (it's the
 * same formula off the same base stat as every other tied column, which is
 * why the group already ties on those). So a null there doesn't block a
 * merge; `scarfNotApplicable` flags it for a footnote instead.
 */
interface RowGroup {
  id: string;
  rows: SpeedTierRow[];
  maxScarf: number | null;
  neutral32Scarf: number | null;
  /** True when some but not all members can hold a Choice Scarf — the shown Scarf values don't apply to the Mega member(s). */
  scarfNotApplicable: boolean;
}

/** Equality key for grouping, deliberately excluding the Scarf columns — see RowGroup's doc comment for why. */
function rowGroupKey(row: SpeedTierRow): string {
  return [row.baseSpe, row.maxSpeed, row.neutral32, row.neutral0, row.minSpeed].join("|");
}

/** Groups rows tied on every stat column (Scarf columns excepted) into one spreadsheet line. Members are sorted alphabetically for a stable sprite/name order. */
function groupRows(rows: SpeedTierRow[]): RowGroup[] {
  const membersByKey = new Map<string, SpeedTierRow[]>();
  for (const row of rows) {
    const key = rowGroupKey(row);
    const members = membersByKey.get(key);
    if (members) {
      members.push(row);
    } else {
      membersByKey.set(key, [row]);
    }
  }

  return [...membersByKey.entries()].map(([key, members]) => {
    const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
    const scarfEligible = sortedMembers.filter((row) => row.maxScarf !== null);
    return {
      id: key,
      rows: sortedMembers,
      maxScarf: scarfEligible[0]?.maxScarf ?? null,
      neutral32Scarf: scarfEligible[0]?.neutral32Scarf ?? null,
      scarfNotApplicable: scarfEligible.length > 0 && scarfEligible.length < sortedMembers.length,
    };
  });
}

/** Wraps a single row as its own one-member group — used in "By Pokémon" mode, where grouping is skipped entirely and every Pokémon gets its own row. Shares the same RowGroup shape as groupRows' output so the rest of the component doesn't need to branch on mode. */
function toSingletonGroup(row: SpeedTierRow): RowGroup {
  return {
    id: row.id,
    rows: [row],
    maxScarf: row.maxScarf,
    neutral32Scarf: row.neutral32Scarf,
    scarfNotApplicable: false,
  };
}

/** Resolves a group's value for a given sort/highlight key — Scarf columns read the group's computed value (which can come from a non-Mega member even if the alphabetically-first one is a Mega), everything else comes from the first member since the group already ties on it. */
function groupValueForSort(group: RowGroup, key: SortKey): number | string | null {
  if (key === "maxScarf") return group.maxScarf;
  if (key === "neutral32Scarf") return group.neutral32Scarf;
  return valueForSort(group.rows[0], key);
}

/** Row background per Speed-query proximity tier — exact match in amber, a result faster than the search in green, slower in red; `null` (no numeric query, or search by name) gets the default hover-only treatment. */
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

/** Numeric columns sort biggest-first on first click; the name column sorts A-Z first — matches how each reads naturally. */
function defaultDirectionFor(key: SortKey): SortDirection {
  return key === "name" ? "asc" : "desc";
}

/** A plain, non-interactive column header — for the columns that display a computed Speed value but aren't sortable (only Base and Pokémon are). */
function StaticHeader({ label }: { label: string }) {
  return (
    <th className="p-0 font-normal">
      <span className="flex w-full items-center justify-end px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 whitespace-nowrap">
        {label}
      </span>
    </th>
  );
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
          active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-800"
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
 * 252 EVs — see PLANNING.md). Sortable by Pokémon name or Base Speed only —
 * every other column is a derived value shown for reference, not something
 * worth sorting by on its own. Defaults to Base descending. Mega rows show "–" in
 * both Scarf columns — a held Mega Stone and Choice Scarf can't occupy the
 * same item slot. Pokémon tied on every displayed stat column (e.g. Mega
 * Alakazam and Mega Aerodactyl, both at 150 Base) share one row — sprites
 * side by side instead of repeated names — since anything less than full
 * equality could silently merge rows a viewer could still tell apart. The
 * Scarf columns are exempt from that: a Mega row's null there is just the
 * item-slot rule, not a different number, so a group can still merge across
 * it — the shared Scarf value comes from a non-Mega member when one exists,
 * marked with a footnoted `*` since it doesn't apply to the Mega member(s).
 * A "Grouped" / "By Pokémon" toggle switches between that merged view and
 * one row per Pokémon (with its name shown instead of sprites-only), for
 * when a viewer wants to see every entry individually.
 */
export function SpeedTiersTable({ speciesKeys, megaStoneItemsForSpecies }: SpeedTiersTableProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("baseSpe");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [groupMode, setGroupMode] = useState(true);

  const rows = useMemo(
    () => computeSpeedTierRows(speciesKeys, megaStoneItemsForSpecies),
    [speciesKeys, megaStoneItemsForSpecies],
  );

  const numericQuery = useMemo(() => parseSpeedQuery(query), [query]);
  // A numeric query (e.g. "150") filters/highlights by Speed value, read off
  // whichever column is currently sorted — falling back to Max Speed when
  // sorted by name, since name has no numeric value to compare.
  const numericSortKey: SortKey = sortKey === "name" ? "maxSpeed" : sortKey;

  const searchTerms = useMemo(() => parseSearchTerms(query), [query]);

  const visibleGroups = useMemo(() => {
    const filtered =
      numericQuery !== null
        ? rows.filter((row) => {
            const value = valueForSort(row, numericSortKey);
            return typeof value === "number" && matchesSpeedQuery(value, numericQuery);
          })
        : searchTerms.length
          ? rows.filter((row) => matchesAnySearchTerm(row.name, searchTerms))
          : rows;

    const groups = groupMode ? groupRows(filtered) : filtered.map(toSingletonGroup);

    const sorted = [...groups].sort((a, b) => {
      // Every member of a group ties on every column (Scarf columns handled
      // via the group's own computed value — see groupValueForSort), so this
      // always compares like-for-like across groups.
      const aValue = groupValueForSort(a, sortKey);
      const bValue = groupValueForSort(b, sortKey);
      // Null values (Scarf columns on Mega rows) always sort last,
      // regardless of direction.
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
  }, [rows, searchTerms, numericQuery, numericSortKey, sortKey, sortDirection, groupMode]);

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
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          query={query}
          onQueryChange={setQuery}
          placeholder='Search Pokémon or Speed… (e.g. "charizard garchomp")'
          ariaLabel="Search Pokémon or Speed"
          className="max-w-xs"
        />
        <GroupModeToggle grouped={groupMode} onChange={setGroupMode} className="ml-auto" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[1060px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50">
              <tr className="border-b border-zinc-200">
                <th className="w-10 p-0 font-normal">
                  <span className="flex w-full items-center pl-3 pr-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
                {COLUMNS.map((column) =>
                  column.key === "baseSpe" ? (
                    <SortableHeader
                      key={column.key}
                      label={column.label}
                      align="right"
                      active={sortKey === column.key}
                      direction={sortDirection}
                      onClick={() => handleSort(column.key)}
                    />
                  ) : (
                    <StaticHeader key={column.key} label={column.label} />
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((group, index) => {
                const representative = group.rows[0];
                const sortValue = groupValueForSort(group, numericSortKey);
                const tier =
                  numericQuery !== null && typeof sortValue === "number"
                    ? speedQueryTier(sortValue, numericQuery)
                    : null;
                return (
                  <tr
                    key={group.id}
                    className={`border-b border-zinc-100 last:border-b-0 ${tierRowClass(tier)}`}
                  >
                    <td className="w-10 pl-3 pr-1 py-1.5 text-zinc-400">{index + 1}</td>
                    <td className="px-3 py-1.5">
                      {groupMode ? (
                        // max-w caps the row at 7 sprites (7 * 56px sprite + 6 * 6px gap) before wrapping to a new line.
                        <div className="flex max-w-[428px] flex-wrap items-center gap-1.5">
                          {group.rows.map((row) => (
                            <Tooltip key={row.id}>
                              <TooltipTrigger render={<span className="relative h-14 w-14 shrink-0" />}>
                                <PokemonSprite species={row.speciesName} item={row.item} fill />
                              </TooltipTrigger>
                              <TooltipContent>{row.name}</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="relative h-14 w-14 shrink-0">
                            <PokemonSprite species={representative.speciesName} item={representative.item} fill />
                          </span>
                          <span className="truncate font-medium text-zinc-900">
                            {representative.name}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{representative.baseSpe}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-zinc-900">
                      {representative.maxSpeed}
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{representative.neutral32}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{representative.neutral0}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">{representative.minSpeed}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-zinc-900">
                      {group.maxScarf ?? "–"}
                      {group.scarfNotApplicable && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <sup className="ml-0.5 cursor-help text-xs font-normal text-zinc-400" />
                            }
                          >
                            *
                          </TooltipTrigger>
                          <TooltipContent>{SCARF_NOT_APPLICABLE_HINT}</TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">
                      {group.neutral32Scarf ?? "–"}
                      {group.scarfNotApplicable && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <sup className="ml-0.5 cursor-help text-xs font-normal text-zinc-400" />
                            }
                          >
                            *
                          </TooltipTrigger>
                          <TooltipContent>{SCARF_NOT_APPLICABLE_HINT}</TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleGroups.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-3 py-6 text-center text-zinc-400">
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
