"use client";

import { useState } from "react";
import { calculateFinalStats } from "@/lib/stats/calculateFinalStats";
import { estimateOpponentSpeedRange } from "@/lib/stats/estimateOpponentSpeedRange";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import type { ParsedPokemon } from "@/types";
import { cn } from "@/lib/utils";

interface RoundSpeedLineProps {
  myTeam: ParsedPokemon[];
  opponentTeam: ParsedPokemon[];
}

type Side = "mine" | "opponent";

interface LineEntry {
  id: string;
  side: Side;
  pokemon: ParsedPokemon;
  /** Axis value used for placement — the real Speed for mine, the estimated range's midpoint for opponent (equal to both ends when a known nature collapsed it to a single assumed value). */
  speed: number;
  /** Badge text — a plain number, or "min–max" for an opponent range that hasn't collapsed to one value. */
  label: string;
  speedAffectingItem: boolean;
}

/** Compact single-row track, same fixed height the standalone Speed Tiers page's SpeedLine uses — a quick-glance section shouldn't grow with roster size, so crowding is resolved horizontally (spreadPositions/groupBadges below) instead of stacking rows. */
const LINE_HEIGHT_PX = 128;
const BADGE_CLEARANCE_PX = 10;
const TRACK_PADDING_PERCENT = 6;
const AXIS_PADDING = 10;
const MIN_GAP_PERCENT = 4;
const BADGE_GROUP_THRESHOLD_PERCENT = 3;
/**
 * Assumed rendered width of one badge segment, in px — a plain number
 * (SpeedLine's own tuned slot width) vs. a wider "min–max" range. A grouped
 * pill's members lay out via ordinary flexbox at their own natural width, so
 * when a group mixes both kinds (e.g. a wide range next to a narrow number),
 * treating every member as the same width would shift every member after
 * the first away from its actual position by half the wide member's excess
 * width — badgeMemberOffsets below sums each member's *own* assumed width
 * instead of a single constant, so a sprite's offset from the group's
 * center matches its own segment's real position regardless of what's next
 * to it. Each badge span is also given this same width as a CSS min-width
 * (see BadgeGroupPill), so the assumption and the actual layout agree.
 */
const NARROW_BADGE_WIDTH_PX = 34;
const WIDE_BADGE_WIDTH_PX = 54;

function estimatedBadgeWidth(label: string): number {
  return label.includes("–") ? WIDE_BADGE_WIDTH_PX : NARROW_BADGE_WIDTH_PX;
}

/** Per-member offset (px, relative to the group's own center) for every member of a badge group, computed from each member's own assumed width rather than a shared slot size — see the doc comment above. */
function badgeMemberOffsets(labels: string[]): number[] {
  const widths = labels.map(estimatedBadgeWidth);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  let cumulative = -totalWidth / 2;
  return widths.map((width) => {
    const offset = cumulative + width / 2;
    cumulative += width;
    return offset;
  });
}

const RING_CLASS_BY_SIDE: Record<Side, string> = {
  mine: "border-sky-500",
  opponent: "border-rose-500",
};

const HIGHLIGHT_BG_CLASS_BY_SIDE: Record<Side, string> = {
  mine: "bg-sky-100 dark:bg-sky-950",
  opponent: "bg-rose-100 dark:bg-rose-950",
};

const HIGHLIGHT_RING_CLASS_BY_SIDE: Record<Side, string> = {
  mine: "ring-sky-400",
  opponent: "ring-rose-400",
};

function isSpeedAffectingItem(item: string | undefined): boolean {
  if (!item) return false;
  const key = normalizeSpeciesKey(item);
  return key === "choice-scarf" || key === "iron-ball";
}

function percentForSpeed(speed: number, min: number, max: number): number {
  if (max === min) return 50;
  const ratio = (speed - min) / (max - min);
  return TRACK_PADDING_PERCENT + ratio * (100 - TRACK_PADDING_PERCENT * 2);
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue);
}

/** Same two-pass technique as SpeedLine's spreadPositions — nudges positions apart just enough to clear minGap from their neighbor, then pulls back any excess push, so a long run of close entries spreads evenly instead of piling onto one spot. */
function spreadPositions(positions: number[], minGap: number, low: number, high: number): number[] {
  const spread = [...positions];
  for (let i = 1; i < spread.length; i++) {
    spread[i] = Math.max(spread[i], spread[i - 1] + minGap);
  }
  for (let i = spread.length - 2; i >= 0; i--) {
    spread[i] = Math.min(spread[i], spread[i + 1] - minGap);
  }
  const availableSpan = high - low;
  const requiredSpan = spread.length ? spread[spread.length - 1] - spread[0] : 0;
  if (requiredSpan > availableSpan) {
    const scale = availableSpan / requiredSpan;
    const origin = spread[0];
    for (let i = 0; i < spread.length; i++) {
      spread[i] = origin + (spread[i] - origin) * scale;
    }
  }
  return spread.map((value) => clamp(value, low, high));
}

interface PlacedEntry extends LineEntry {
  percent: number;
}

/** Places one side's markers along the line, independently of the other side — mirrors SpeedLine's placeEntries. */
function placeEntries(entries: LineEntry[], min: number, max: number): PlacedEntry[] {
  const sorted = [...entries]
    .map((entry) => ({ entry, raw: percentForSpeed(entry.speed, min, max) }))
    .sort((a, b) => a.raw - b.raw);
  const positions = spreadPositions(
    sorted.map((item) => item.raw),
    MIN_GAP_PERCENT,
    TRACK_PADDING_PERCENT,
    100 - TRACK_PADDING_PERCENT,
  );
  return sorted.map((item, index) => ({ ...item.entry, percent: positions[index] }));
}

interface BadgeItem {
  id: string;
  entry: PlacedEntry;
  raw: number;
}

interface BadgeGroup {
  members: { id: string; entry: PlacedEntry }[];
  centerPercent: number;
}

/** Merges badges whose raw axis position is within `threshold` of each other into one touching, no-gap pill — mirrors SpeedLine's groupBadges. */
function groupBadges(
  items: BadgeItem[],
  threshold: number,
  low: number,
  high: number,
): BadgeGroup[] {
  const sorted = [...items].sort((a, b) => a.raw - b.raw);
  const groups: BadgeGroup[] = [];
  let current: BadgeItem[] = [];
  for (const item of sorted) {
    if (current.length > 0 && item.raw - current[current.length - 1].raw >= threshold) {
      groups.push(finalizeGroup(current, low, high));
      current = [];
    }
    current.push(item);
  }
  if (current.length > 0) groups.push(finalizeGroup(current, low, high));
  return groups;
}

function finalizeGroup(members: BadgeItem[], low: number, high: number): BadgeGroup {
  const center = (members[0].raw + members[members.length - 1].raw) / 2;
  return {
    members: members.map(({ id, entry }) => ({ id, entry })),
    centerPercent: clamp(center, low, high),
  };
}

function buildMyEntries(myTeam: ParsedPokemon[]): LineEntry[] {
  return myTeam
    .map((mon, index): LineEntry | null => {
      const stats = calculateFinalStats(mon);
      if (!stats) return null;
      return {
        id: `mine-${index}`,
        side: "mine",
        pokemon: mon,
        speed: stats.spe,
        label: String(stats.spe),
        speedAffectingItem: Boolean(stats.speedBoostedByChoiceScarf || stats.speedHalvedByIronBall),
      };
    })
    .filter((entry): entry is LineEntry => entry !== null);
}

function buildOpponentEntries(opponentTeam: ParsedPokemon[]): LineEntry[] {
  return opponentTeam.map((mon, index) => {
    const range = estimateOpponentSpeedRange(mon);
    return {
      id: `opponent-${index}`,
      side: "opponent",
      pokemon: mon,
      speed: (range.min + range.max) / 2,
      label: range.min === range.max ? String(range.min) : `${range.min}–${range.max}`,
      speedAffectingItem: isSpeedAffectingItem(mon.item),
    };
  });
}

function MarkerIcon({ entry, highlighted }: { entry: LineEntry; highlighted: boolean }) {
  return (
    <div
      className={cn(
        "relative h-9 w-9 shrink-0 rounded-lg transition-shadow",
        highlighted ? `ring-2 ring-offset-2 ${HIGHLIGHT_RING_CLASS_BY_SIDE[entry.side]}` : "",
      )}
    >
      <div
        className={cn(
          "h-full w-full overflow-hidden rounded-lg border-2 bg-zinc-50",
          RING_CLASS_BY_SIDE[entry.side],
        )}
      >
        <PokemonSprite species={entry.pokemon.species} item={entry.pokemon.item} fill />
      </div>
      {entry.pokemon.item && entry.speedAffectingItem && (
        <span className="absolute -right-1 -bottom-1">
          <ItemIcon item={entry.pokemon.item} size={16} />
        </span>
      )}
    </div>
  );
}

function BadgeGroupPill({
  group,
  hoveredId,
  onHoverChange,
}: {
  group: BadgeGroup;
  hoveredId: string | null;
  onHoverChange: (id: string | null) => void;
}) {
  return (
    <div className="flex items-stretch divide-x divide-zinc-200 overflow-hidden rounded-full border border-zinc-200 bg-zinc-50">
      {group.members.map(({ id, entry }) => (
        <span
          key={id}
          onMouseEnter={() => onHoverChange(id)}
          onMouseLeave={() => onHoverChange(null)}
          style={{ minWidth: `${estimatedBadgeWidth(entry.label)}px` }}
          className={cn(
            "px-1.5 py-0.5 text-center text-xs leading-none font-semibold whitespace-nowrap transition-colors",
            hoveredId === id ? HIGHLIGHT_BG_CLASS_BY_SIDE[entry.side] : "",
            entry.speedAffectingItem ? "text-amber-600" : "text-zinc-700",
          )}
        >
          {entry.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Compares your team's real Speed (calculateFinalStats, same as SpeedLine)
 * against the opponent's roster — an opponent's Stat Points are essentially
 * never revealed on a real team sheet, so its Speed is estimated instead
 * (see estimateOpponentSpeedRange): a known Speed-affecting nature is
 * treated as a signal of full investment in that direction and collapses to
 * a single assumed number; anything else (unknown or neutral nature) stays
 * a "min–max" range.
 *
 * Deliberately mirrors the standalone Speed Tiers page's SpeedLine
 * (src/components/SpeedLine) — same fixed-height single row, same
 * horizontal collision-avoidance/badge-grouping (spreadPositions/
 * groupBadges) — so this reads as a quick glance rather than a tall
 * breakdown. Not reusing SpeedLine directly since its placement engine is
 * built only for single point values, not ranges — see that component's own
 * doc comment for its side of the reasoning. Tailwind/Trick Room toggles and
 * the Speed-stage stepper are out of scope here.
 */
export function RoundSpeedLine({ myTeam, opponentTeam }: RoundSpeedLineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const myEntries = buildMyEntries(myTeam);
  const opponentEntries = buildOpponentEntries(opponentTeam);

  if (myEntries.length === 0 && opponentEntries.length === 0) return null;

  const allValues = [...myEntries, ...opponentEntries].map((entry) => entry.speed);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const axisMin = rawMin - AXIS_PADDING;
  const axisMax = rawMax + AXIS_PADDING;

  const placedMine = placeEntries(myEntries, axisMin, axisMax);
  const placedOpponent = placeEntries(opponentEntries, axisMin, axisMax);

  const badges: BadgeItem[] = [...placedMine, ...placedOpponent].map((entry) => ({
    id: entry.id,
    entry,
    raw: entry.percent,
  }));
  const badgeGroups = groupBadges(
    badges,
    BADGE_GROUP_THRESHOLD_PERCENT,
    TRACK_PADDING_PERCENT,
    100 - TRACK_PADDING_PERCENT,
  );
  // A sprite's on-line position always follows its own badge segment — once
  // several entries are close enough to share one grouped pill (see
  // groupBadges), their sprites follow suit (offset left/right of the
  // group's shared center via offsetPx) rather than sitting at their own
  // independently-placed percent, so a sprite and its number always read as
  // a pair. Mirrors SpeedLine's resolvePosition.
  const positionById = new Map<string, { percent: number; offsetPx: number }>();
  for (const group of badgeGroups) {
    const offsets = badgeMemberOffsets(group.members.map(({ entry }) => entry.label));
    group.members.forEach((member, index) => {
      positionById.set(member.id, { percent: group.centerPercent, offsetPx: offsets[index] });
    });
  }

  function resolvePosition(
    id: string,
    fallbackPercent: number,
  ): { percent: number; offsetPx: number } {
    return positionById.get(id) ?? { percent: fallbackPercent, offsetPx: 0 };
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-zinc-900">Speed line</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            My team
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            Opponent (estimated)
          </span>
        </div>

        <div className="relative min-w-[560px]" style={{ height: `${LINE_HEIGHT_PX}px` }}>
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-200" />
          <span className="absolute top-1/2 left-0 -translate-y-1/2 rounded-full bg-zinc-50 pr-1.5 text-[11px] font-medium whitespace-nowrap text-zinc-400">
            {axisMin}
          </span>
          <span className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full bg-zinc-50 pl-1.5 text-[11px] font-medium whitespace-nowrap text-zinc-400">
            {axisMax}
          </span>

          {placedMine.map((entry) => {
            const pos = resolvePosition(entry.id, entry.percent);
            return (
              <div
                key={entry.id}
                className="absolute flex -translate-x-1/2 flex-col items-center"
                style={{
                  left: `calc(${pos.percent}% + ${pos.offsetPx}px)`,
                  bottom: `calc(50% + ${BADGE_CLEARANCE_PX}px)`,
                }}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <MarkerIcon entry={entry} highlighted={hoveredId === entry.id} />
              </div>
            );
          })}

          {placedOpponent.map((entry) => {
            const pos = resolvePosition(entry.id, entry.percent);
            return (
              <div
                key={entry.id}
                className="absolute flex -translate-x-1/2 flex-col items-center"
                style={{
                  left: `calc(${pos.percent}% + ${pos.offsetPx}px)`,
                  top: `calc(50% + ${BADGE_CLEARANCE_PX}px)`,
                }}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <MarkerIcon entry={entry} highlighted={hoveredId === entry.id} />
              </div>
            );
          })}

          {badgeGroups.map((group) => (
            <span
              key={group.members.map((member) => member.id).join("|")}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${group.centerPercent}%` }}
            >
              <BadgeGroupPill group={group} hoveredId={hoveredId} onHoverChange={setHoveredId} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
