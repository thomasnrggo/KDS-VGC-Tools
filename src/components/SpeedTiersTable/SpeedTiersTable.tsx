"use client";

import { useMemo, useState } from "react";
import { computeSpeedTierRows } from "@/lib/stats/computeSpeedTiers";
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
  | "maxScarf"
  | "neutral32Scarf";
type SortDirection = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "baseSpe", label: "Base" },
  { key: "maxSpeed", label: "Max Speed" },
  { key: "neutral32", label: "Neutral +32" },
  { key: "neutral0", label: "Neutral 0" },
  { key: "maxScarf", label: "Max Scarf" },
  { key: "neutral32Scarf", label: "Neutral +32 Scarf" },
];

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
 * same item slot.
 */
export function SpeedTiersTable({ speciesKeys, megaStoneItemsForSpecies }: SpeedTiersTableProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("maxSpeed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const rows = useMemo(
    () => computeSpeedTierRows(speciesKeys, megaStoneItemsForSpecies),
    [speciesKeys, megaStoneItemsForSpecies],
  );

  const visibleRows = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    const filtered = trimmedQuery
      ? rows.filter((row) => row.name.toLowerCase().includes(trimmedQuery))
      : rows;

    const sorted = [...filtered].sort((a, b) => {
      const aValue = sortKey === "name" ? a.name : a[sortKey];
      const bValue = sortKey === "name" ? b.name : b[sortKey];
      // Null Scarf values (Mega rows) always sort last, regardless of direction.
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
  }, [rows, query, sortKey, sortDirection]);

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
        placeholder="Search Pokémon…"
        ariaLabel="Search Pokémon"
        className="max-w-xs"
      />

      <div className="overflow-x-auto rounded-lg border border-mauve-200 bg-white">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-mauve-50">
              <tr className="border-b border-mauve-200">
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
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-mauve-100 last:border-b-0 hover:bg-mauve-50/60"
                >
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
                  <td className="px-3 py-1.5 text-right font-semibold text-mauve-900">
                    {row.maxScarf ?? "–"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-mauve-700">
                    {row.neutral32Scarf ?? "–"}
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-center text-mauve-400">
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
