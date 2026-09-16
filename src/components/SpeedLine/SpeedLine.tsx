"use client";

import { useMemo, useState } from "react";
import { useOpponents } from "@/hooks/useOpponents";
import { calculateFinalStats } from "@/lib/stats/calculateFinalStats";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import type { ParsedPokemon, Team } from "@/types";

interface SpeedLineProps {
  /** The user's own teams (src/hooks/useMyTeams' activeTeams) — which one is compared is chosen locally in this view, independent of the app-wide "active team". */
  myTeams: Team[];
  /** Preselects this team if it's present in `myTeams` — the app-wide active team, so the view opens on something relevant instead of always defaulting to the first team in the list. */
  defaultTeamId?: string;
  /** Only opponents/teams saved under this regulation are offered, matching how the rest of the Speed Tiers page scopes to one regulation at a time. */
  regulationId: string;
}

type Side = "mine" | "opponent";

interface SpeedLineEntry {
  id: string;
  pokemon: ParsedPokemon;
  side: Side;
  speed: number;
  /** The Speed stat stage (-6 to +6) currently applied to this Pokémon, e.g. from a Swords Dance-style boost or an Icy Wind drop — folded into `speed` already, kept here so the stepper control can display and adjust it. */
  stage: number;
  scarfed: boolean;
  /** Whether the held item actually changes this Speed number (Choice Scarf, Iron Ball) — an item badge is only useful here when it explains the number next to it, unlike the full roster view where every held item is worth showing. */
  speedAffectingItem: boolean;
}

/** In-battle Speed stat stage range — the standard -6 to +6 stage system every stat uses. */
const SPEED_STAGE_MIN = -6;
const SPEED_STAGE_MAX = 6;

/** The standard stat-stage multiplier table: each positive stage adds half the base again, each negative stage divides by an extra half-step. */
function speedStageMultiplier(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

/** Keeps a marker's own circle from clipping past the line's edge — the line only ever positions markers within [PADDING, 100 - PADDING]. */
const TRACK_PADDING_PERCENT = 6;

/** Speed points of headroom added beyond the slowest/fastest entry on each end of the line, so the extreme markers aren't jammed right at the edge — the edge labels show exactly these padded boundary values. */
const AXIS_PADDING = 10;

const RING_CLASS_BY_SIDE: Record<Side, string> = {
  mine: "border-sky-500",
  opponent: "border-rose-500",
};

/** Tailwind (the move) doubles its side's Speed for the duration — a field condition, not a held item, so it's applied on top of calculateFinalStats' result rather than inside it. */
const TAILWIND_SPEED_MULTIPLIER = 2;

/** Real Speed (Level 50, that Pokémon's actual pasted item/nature/Stat Points) for every roster member that resolves — reuses the same stat formula as the rest of the app (calculateFinalStats) rather than the hypothetical every-spread table Speed Tiers' other views show. `tailwind` folds in the +Speed field condition for this side, if toggled on; `stages` folds in each Pokémon's own Speed stat stage (keyed by the same id this function assigns), same as Tailwind — a field/battle-state adjustment on top of the real stat, not part of it. */
function buildEntries(
  pokemon: ParsedPokemon[],
  side: Side,
  tailwind: boolean,
  stages: Record<string, number>,
): SpeedLineEntry[] {
  const entries: SpeedLineEntry[] = [];
  pokemon.forEach((mon, index) => {
    const stats = calculateFinalStats(mon);
    if (!stats) return;
    const scarfed = stats.speedBoostedByChoiceScarf ?? false;
    const ironBalled = stats.speedHalvedByIronBall ?? false;
    const id = `${side}-${index}-${mon.species}`;
    const stage = clamp(stages[id] ?? 0, SPEED_STAGE_MIN, SPEED_STAGE_MAX);
    const baseSpeed = tailwind ? stats.spe * TAILWIND_SPEED_MULTIPLIER : stats.spe;
    entries.push({
      id,
      pokemon: mon,
      side,
      speed: Math.round(baseSpeed * speedStageMultiplier(stage)),
      stage,
      scarfed,
      speedAffectingItem: scarfed || ironBalled,
    });
  });
  return entries;
}

/**
 * Slower sits to the left, faster to the right by default — read the way the
 * user asked to see it, low to high. Under Trick Room that turn order
 * inverts (the slowest Pokémon acts first), so `reversed` flips which end of
 * the line reads first without changing the Speed numbers themselves.
 */
function percentForSpeed(speed: number, min: number, max: number, reversed: boolean): number {
  if (max === min) return 50;
  const ratio = (speed - min) / (max - min);
  const positionRatio = reversed ? 1 - ratio : ratio;
  return TRACK_PADDING_PERCENT + positionRatio * (100 - TRACK_PADDING_PERCENT * 2);
}

/**
 * Minimum gap (in line-width percent) between two markers' centers — just
 * enough that two 48px circles never overlap, and deliberately no bigger
 * than that. Setting this any higher forces genuinely well-separated
 * Pokémon apart too, since the two-pass placement below can't tell "these
 * two are 60 Speed points apart" from "these two are tied" once it's
 * enforcing a gap wider than most of the real differences in a typical
 * 12-Pokémon roster — which is exactly what made every marker look evenly
 * spaced regardless of actual Speed. Keeping it tight means placement only
 * ever nudges a marker when it would truly overlap a neighbor; everywhere
 * else, position reflects real Speed.
 */
const MIN_GAP_PERCENT = 4;

/**
 * Distance (in line-width percent) below which two badges are considered to
 * be "colliding" and get merged into one grouped chip — see groupBadges and
 * SpeedLineBadgeGroup. Mine's and the opponent's badges are placed
 * independently by side (same as the sprites, via placeEntries), so two
 * *different* Speed values that are merely close — not an exact tie, which
 * already collapses to one shared badge — can still land within a hair of
 * each other on the line (e.g. mine's 70 and the opponent's 71). Rather than
 * push those apart with a gap, they're grouped into a single pill split into
 * touching segments, one per value, with no gap between them at all.
 */
const BADGE_GROUP_THRESHOLD_PERCENT = 3;

/**
 * Approximate rendered width of one Speed badge segment, in px — used to
 * offset a grouped badge's own sprite (and the badge segment itself within
 * its group's pill) left/right of the group's center so each stays roughly
 * under/over its own number instead of all sharing one x. It's an
 * approximation (a 3-digit Speed number renders a little wider than a
 * 2-digit one) rather than a measured value, since Speed numbers in this
 * range are close enough in width that the difference isn't visually
 * significant.
 */
const BADGE_SLOT_WIDTH_PX = 28;

interface PlacedEntry extends SpeedLineEntry {
  percent: number;
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue);
}

/**
 * Standard two-pass technique for 1D label placement, generic over whatever
 * `positions` (already sorted ascending, in line-width percent) represent —
 * used both for one side's sprite markers (placeEntries below) and for the
 * combined Speed badge layer (see SpeedLineTrack), which needs its own pass
 * since mine's and the opponent's badges now share one line and can land
 * close enough to collide even when their sprites don't (see badgeMinGap's
 * doc comment).
 *
 * A forward pass pushes each position right just enough to clear `minGap`
 * from its (already-resolved) left neighbor, then a backward pass pulls
 * positions back left wherever the forward pass pushed more than necessary —
 * without ever violating the minimum gap it just established. Unlike
 * averaging a whole chain of near neighbors at once, this only ever moves a
 * position relative to its immediate neighbors, so a long run of close
 * entries can't collapse onto the same spot the way a naive "cluster and
 * center" pass would. If even that isn't enough room (e.g. most of a
 * 6-Pokémon roster all within a few Speed points of each other), every gap
 * is proportionally tightened so the whole run still fits within
 * [low, high] — spacing gets denser than `minGap` under that crowding, but
 * two positions still never land on the exact same spot the way
 * independently clamping each one would (several piling up on the edge).
 */
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

interface BadgeItem {
  id: string;
  entry: SpeedLineEntry;
  raw: number;
}

interface BadgeGroup {
  members: { id: string; entry: SpeedLineEntry }[];
  centerPercent: number;
}

/**
 * Clusters badges (already computed from each side's own placement — see
 * SpeedLineTrack) into groups wherever consecutive raw positions are closer
 * than `threshold`, chaining transitively so a run of 3+ close values all
 * land in one group rather than only pairing up neighbors. Each group is
 * rendered as a single merged pill (SpeedLineBadgeGroup) centered on the
 * midpoint of its first and last member, instead of nudging every badge
 * apart by a minimum gap the way the sprite layer does — the user asked for
 * literally touching, no-gap segments instead of spaced-out badges.
 */
function groupBadges(items: BadgeItem[], threshold: number, low: number, high: number): BadgeGroup[] {
  const sorted = [...items].sort((a, b) => a.raw - b.raw);
  const groups: BadgeGroup[] = [];
  let current: BadgeItem[] = [];

  for (const item of sorted) {
    if (current.length > 0 && item.raw - current[current.length - 1].raw >= threshold) {
      groups.push(finalizeBadgeGroup(current, low, high));
      current = [];
    }
    current.push(item);
  }
  if (current.length > 0) groups.push(finalizeBadgeGroup(current, low, high));

  return groups;
}

function finalizeBadgeGroup(members: BadgeItem[], low: number, high: number): BadgeGroup {
  const center = (members[0].raw + members[members.length - 1].raw) / 2;
  return {
    members: members.map(({ id, entry }) => ({ id, entry })),
    centerPercent: clamp(center, low, high),
  };
}

/**
 * Places one side's markers along the line — no vertical stacking within a
 * side, so overlap is resolved horizontally instead (see spreadPositions).
 * My team and the opponent's are placed independently (each against the
 * same shared min/max/reversed axis) since they no longer share a line —
 * see SpeedLineTrack — so a mine marker never nudges an opponent marker
 * aside or vice versa.
 */
function placeEntries(
  entries: SpeedLineEntry[],
  min: number,
  max: number,
  reversed: boolean,
): PlacedEntry[] {
  const sorted = [...entries]
    .map((entry) => ({ entry, raw: percentForSpeed(entry.speed, min, max, reversed) }))
    .sort((a, b) => a.raw - b.raw);

  const positions = spreadPositions(
    sorted.map((item) => item.raw),
    MIN_GAP_PERCENT,
    TRACK_PADDING_PERCENT,
    100 - TRACK_PADDING_PERCENT,
  );

  return sorted.map((item, index) => ({
    ...item.entry,
    percent: positions[index],
  }));
}

function LegendDot({ colorClassName, label }: { colorClassName: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${colorClassName}`} />
      {label}
    </span>
  );
}

/** Icon-free text toggle for a field condition (Tailwind on one side, Trick Room globally) — `activeClassName` lets each one carry its own on-color (a side's ring color for Tailwind, a neutral accent for the field-wide Trick Room). */
function ModifierToggle({
  label,
  active,
  activeClassName,
  onClick,
}: {
  label: string;
  active: boolean;
  activeClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? activeClassName : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

const HIGHLIGHT_RING_CLASS_BY_SIDE: Record<Side, string> = {
  mine: "ring-sky-400",
  opponent: "ring-rose-400",
};

/**
 * A marker's sprite tile + item badge — identical on both orientations, just
 * repositioned by the parent. `highlighted` lights up a ring around the tile
 * when this entry's Speed badge (or the tile itself) is hovered — see
 * SpeedLineTrack's hoveredId — so it's obvious which Pokémon a given number
 * belongs to even inside a crowded merged badge group.
 */
function SpeedLineMarkerIcon({
  entry,
  highlighted,
}: {
  entry: SpeedLineEntry;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`relative h-12 w-12 shrink-0 rounded-lg transition-shadow ${
        highlighted ? `ring-2 ring-offset-2 ${HIGHLIGHT_RING_CLASS_BY_SIDE[entry.side]}` : ""
      }`}
    >
      <div
        className={`h-full w-full overflow-hidden rounded-lg border-2 bg-zinc-50 ${RING_CLASS_BY_SIDE[entry.side]}`}
      >
        <PokemonSprite species={entry.pokemon.species} item={entry.pokemon.item} fill />
      </div>
      {entry.pokemon.item && entry.speedAffectingItem && (
        <span className="absolute -bottom-1 -right-1">
          <ItemIcon item={entry.pokemon.item} size={18} />
        </span>
      )}
    </div>
  );
}

const HIGHLIGHT_BG_CLASS_BY_SIDE: Record<Side, string> = {
  mine: "bg-sky-100 dark:bg-sky-950",
  opponent: "bg-rose-100 dark:bg-rose-950",
};

/**
 * One badge group's pill on the line (see groupBadges) — a single
 * rounded/bordered container split into touching, no-gap segments (one per
 * member, divided by a hairline) rather than several independently-pilled
 * badges spaced apart. A group of one member renders as a single plain pill.
 *
 * Hovering a segment (or its matching sprite — see SpeedLineTrack's
 * hoveredId) tints just that segment, since a crowded group like "113 120
 * 124 144" otherwise gives no clue which number is which Pokémon's.
 */
/**
 * `orientation` picks which way touching segments stack — "horizontal" (the
 * desktop line's left-to-right groups) or "vertical" (the small-screen
 * line's top-to-bottom groups, see SpeedLineTrack's mobile block). Either
 * way `members` is expected in ascending-Speed-axis-position order (the
 * order groupBadges produces); for "vertical" that's rendered top-to-bottom
 * reversed, since the mobile line reads faster-at-top while `members`'
 * order follows the shared horizontal axis (ascending = toward "faster" on
 * the right).
 */
function SpeedLineBadgeGroup({
  members,
  hoveredId,
  onHoverChange,
  orientation = "horizontal",
}: {
  members: { id: string; entry: SpeedLineEntry }[];
  hoveredId: string | null;
  onHoverChange: (id: string | null) => void;
  orientation?: "horizontal" | "vertical";
}) {
  const ordered = orientation === "vertical" ? [...members].reverse() : members;
  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-full border border-zinc-200 bg-zinc-50 ${
        orientation === "vertical"
          ? "flex-col divide-y divide-zinc-200"
          : "divide-x divide-zinc-200"
      }`}
    >
      {ordered.map(({ id, entry }) => (
        <span
          key={id}
          onMouseEnter={() => onHoverChange(id)}
          onMouseLeave={() => onHoverChange(null)}
          className={`whitespace-nowrap px-1.5 py-0.5 text-center text-xs font-semibold leading-none transition-colors ${
            hoveredId === id ? HIGHLIGHT_BG_CLASS_BY_SIDE[entry.side] : ""
          } ${entry.scarfed ? "text-amber-600" : "text-zinc-700"}`}
        >
          {entry.speed}
        </span>
      ))}
    </div>
  );
}

/** Per-Pokémon Speed stat stage control — a compact −/value/+ stepper rather than a dropdown, so adjusting a boost or drop is a single click like the rest of this view's toggles. */
function StageStepper({
  stage,
  label,
  onDecrease,
  onIncrease,
}: {
  stage: number;
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={`${label} Speed stage`}
      className="flex items-center gap-0.5 rounded-full bg-zinc-100 px-1 py-0.5"
    >
      <button
        type="button"
        aria-label="Decrease Speed stage"
        disabled={stage <= SPEED_STAGE_MIN}
        onClick={onDecrease}
        className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        −
      </button>
      <span
        className={`w-4 text-center text-[10px] font-semibold tabular-nums ${
          stage > 0 ? "text-emerald-600" : stage < 0 ? "text-rose-600" : "text-zinc-400"
        }`}
      >
        {stage > 0 ? `+${stage}` : stage}
      </span>
      <button
        type="button"
        aria-label="Increase Speed stage"
        disabled={stage >= SPEED_STAGE_MAX}
        onClick={onIncrease}
        className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        +
      </button>
    </div>
  );
}

/** Rough pixels a marker (48px tile + label + stage stepper, plus breathing room) needs along the vertical track, so MIN_GAP_PERCENT of the track's total height comfortably clears that — used by the small-screen stacked fallback below. */
const VERTICAL_ROW_PX = 68;

/**
 * Desktop line's total height: one side's stack (stepper ~22px + gap +
 * sprite 48px) plus BADGE_CLEARANCE_PX of clearance from the line for the
 * centered Speed badge, mirrored above and below the line, plus room for the
 * line itself and the edge labels that sit on it.
 */
const LINE_HEIGHT_PX = 232;

/**
 * Vertical gap between the line and each side's sprite/stepper stack — sized
 * to roughly clear half the Speed badge's own height (it's centered exactly
 * on the line, see the badge layer in SpeedLineTrack) plus a couple of
 * pixels of breathing room, so the badge doesn't visually touch the sprite
 * above/below it.
 */
const BADGE_CLEARANCE_PX = 14;

/**
 * The small-screen line's equivalent of BADGE_CLEARANCE_PX, but larger — on
 * mobile the sprite/stepper row sits beside the badge horizontally rather
 * than above/below it, so clearance has to clear roughly half the badge's
 * *width* (a 2-3 digit chip, ~30-40px) rather than half its height, plus a
 * visible gap so the two don't read as touching.
 */
const MOBILE_BADGE_CLEARANCE_PX = 34;

function SpeedLineTrack({
  myEntries,
  opponentEntries,
  min,
  max,
  reversed,
  onStageChange,
}: {
  myEntries: SpeedLineEntry[];
  opponentEntries: SpeedLineEntry[];
  min: number;
  max: number;
  reversed: boolean;
  /** Adjusts a Pokémon's stage by ±1 relative to whatever it currently is, rather than taking an absolute value — so two clicks in quick succession (before this component re-renders with the first click's result) still both apply instead of collapsing into one. */
  onStageChange: (id: string, delta: number) => void;
}) {
  // Which badge/sprite pair is currently moused over, keyed by the same
  // "mine-<id>"/"opponent-<id>" scheme badges uses — shared between the
  // sprite stacks and the badge layer below so hovering either half
  // highlights both, which is the whole point when a crowded group (e.g.
  // "113 120 124 144") otherwise gives no clue which number is which
  // Pokémon's.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allEntries = [...myEntries, ...opponentEntries];
  const placedMine = placeEntries(myEntries, min, max, reversed);
  const placedOpponent = placeEntries(opponentEntries, min, max, reversed);
  const verticalHeight = Math.max(allEntries.length * VERTICAL_ROW_PX, VERTICAL_ROW_PX * 4);
  const edgeLow = reversed ? max : min;
  const edgeHigh = reversed ? min : max;
  // A Speed value shared by at least one Pokémon on each side gets only one
  // number badge instead of two identical ones stacked on the line — kept on
  // mine's (top) side, skipped on the opponent's (bottom) side below, since
  // showing the same number twice right next to each other added nothing.
  const tiedSpeeds = new Set(
    myEntries
      .map((entry) => entry.speed)
      .filter((speed) => opponentEntries.some((entry) => entry.speed === speed)),
  );

  // The badge layer's own grouping pass — mine's badge for every entry, plus
  // the opponent's for every entry that isn't tied (see tiedSpeeds).
  // placedMine and placedOpponent already avoid overlap *within* their own
  // side, but they're placed independently of each other, so two close-but-
  // different values on opposite sides (mine's 70 next to the opponent's 71)
  // can still land within a hair of each other since neither side's pass
  // knows about the other's badges. groupBadges merges those into one
  // touching, no-gap pill instead of just spacing them apart — see
  // BADGE_GROUP_THRESHOLD_PERCENT.
  const badges: BadgeItem[] = [
    ...placedMine.map((entry) => ({ id: `mine-${entry.id}`, entry, raw: entry.percent })),
    ...placedOpponent
      .filter((entry) => !tiedSpeeds.has(entry.speed))
      .map((entry) => ({ id: `opponent-${entry.id}`, entry, raw: entry.percent })),
  ];
  const badgeGroups = groupBadges(
    badges,
    BADGE_GROUP_THRESHOLD_PERCENT,
    TRACK_PADDING_PERCENT,
    100 - TRACK_PADDING_PERCENT,
  );

  // Every badge's final on-line position — a lone badge sits at its group's
  // (its own) center with no offset; a grouped one gets a small px offset
  // left/right of the group's shared center so its segment, and its own
  // sprite (see below), land roughly under/over each other instead of every
  // member of the group sharing one x.
  const positionById = new Map<string, { percent: number; offsetPx: number }>();
  for (const group of badgeGroups) {
    const count = group.members.length;
    group.members.forEach((member, index) => {
      const offsetPx = count === 1 ? 0 : (index - (count - 1) / 2) * BADGE_SLOT_WIDTH_PX;
      positionById.set(member.id, { percent: group.centerPercent, offsetPx });
    });
  }

  /**
   * A sprite's position always follows its own badge/group segment — see
   * positionById — so "the Pokémon lines up with its own number" holds even
   * once badges have been grouped and shifted. A tied entry's opponent
   * sprite has no badge of its own (its Speed is shown once, on mine's
   * side — see tiedSpeeds), so it falls back to whichever badge is showing
   * that same Speed value instead.
   */
  function resolvePosition(id: string, speed: number): { percent: number; offsetPx: number } {
    const direct = positionById.get(id);
    if (direct) return direct;
    const sharedId = badges.find((badge) => badge.entry.speed === speed)?.id;
    const shared = sharedId ? positionById.get(sharedId) : undefined;
    return shared ?? { percent: percentForSpeed(speed, min, max, reversed), offsetPx: 0 };
  }

  /**
   * The badge id that actually represents `id`/`speed` on the line — itself,
   * unless it's a tied entry with no badge of its own (see resolvePosition),
   * in which case it's whichever badge *is* showing that Speed. Hovering a
   * tied opponent's sprite should still highlight the one shared badge (and
   * vice versa), so both this and the sprite's `highlighted` check go
   * through here rather than comparing `id` to `hoveredId` directly.
   */
  function resolveBadgeId(id: string, speed: number): string {
    if (positionById.has(id)) return id;
    return badges.find((badge) => badge.entry.speed === speed)?.id ?? id;
  }

  return (
    <>
      {/* Small screens: the same md+ concept (my team on one side, the
          opponent's on the other, Speed badges on the shared line) turned
          90° — a horizontal line doesn't fit a narrow viewport. Mine sits to
          the line's left, the opponent's to its right, and the line itself
          reads faster-at-top/slower-at-bottom (independent of the md+ line's
          slower-left/faster-right — a vertical list reads top-to-bottom like
          a tier list, "faster" naturally belongs at the top). Reuses the
          exact same placedMine/placedOpponent/badgeGroups/positionById the
          md+ line computed above — just flips which axis (top instead of
          left) and which sign (mine's offset negated) each position maps
          to, and grouped badges stack vertically (SpeedLineBadgeGroup's
          "vertical" orientation) instead of side by side. */}
      <div className="flex flex-col gap-2 md:hidden">
        <span className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {reversed ? "Slower" : "Faster"}
        </span>
        <div className="relative w-full" style={{ height: `${verticalHeight}px` }}>
          <div className="absolute inset-y-0 left-1/2 w-1 -ml-0.5 rounded-full bg-zinc-200" />

          {placedMine.map((entry) => {
            const pos = resolvePosition(`mine-${entry.id}`, entry.speed);
            const badgeId = resolveBadgeId(`mine-${entry.id}`, entry.speed);
            return (
              <div
                key={entry.id}
                className="absolute flex -translate-y-1/2 flex-row-reverse items-center gap-1"
                style={{
                  top: `calc(${100 - pos.percent}% - ${pos.offsetPx}px)`,
                  right: `calc(50% + ${MOBILE_BADGE_CLEARANCE_PX}px)`,
                }}
                onMouseEnter={() => setHoveredId(badgeId)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <SpeedLineMarkerIcon entry={entry} highlighted={hoveredId === badgeId} />
                <StageStepper
                  stage={entry.stage}
                  label={entry.pokemon.species}
                  onDecrease={() => onStageChange(entry.id, -1)}
                  onIncrease={() => onStageChange(entry.id, 1)}
                />
              </div>
            );
          })}

          {placedOpponent.map((entry) => {
            const pos = resolvePosition(`opponent-${entry.id}`, entry.speed);
            const badgeId = resolveBadgeId(`opponent-${entry.id}`, entry.speed);
            return (
              <div
                key={entry.id}
                className="absolute flex -translate-y-1/2 items-center gap-1"
                style={{
                  top: `calc(${100 - pos.percent}% - ${pos.offsetPx}px)`,
                  left: `calc(50% + ${MOBILE_BADGE_CLEARANCE_PX}px)`,
                }}
                onMouseEnter={() => setHoveredId(badgeId)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <SpeedLineMarkerIcon entry={entry} highlighted={hoveredId === badgeId} />
                <StageStepper
                  stage={entry.stage}
                  label={entry.pokemon.species}
                  onDecrease={() => onStageChange(entry.id, -1)}
                  onIncrease={() => onStageChange(entry.id, 1)}
                />
              </div>
            );
          })}

          {badgeGroups.map((group) => (
            <span
              key={group.members.map((member) => member.id).join("|")}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ top: `${100 - group.centerPercent}%` }}
            >
              <SpeedLineBadgeGroup
                members={group.members}
                hoveredId={hoveredId}
                onHoverChange={setHoveredId}
                orientation="vertical"
              />
            </span>
          ))}

          {allEntries.length === 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
              No Pokémon to show
            </span>
          )}
        </div>
        <span className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {reversed ? "Faster" : "Slower"}
        </span>
      </div>

      {/* Medium+ screens: my team's markers hang above the line, the
          opponent's sit below it — each stepper (this Pokémon's individual
          Speed stage modifier) sits at the outer end of its stack, sprite
          innermost. The Speed number badge isn't part of either stack — it's
          rendered separately, centered exactly on the line itself (see the
          badge layer below) rather than hugging above/below it, so the line
          visibly passes through the badge's middle instead of just grazing
          its near edge. Both rows share the same x-axis, placed
          independently (see placeEntries) so a mine marker never has to make
          room for an opponent one directly below/above it. */}
      <div className="relative hidden md:block" style={{ height: `${LINE_HEIGHT_PX}px` }}>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-200" />

        {allEntries.length > 0 && (
          <>
            {/* True edges (0%/100%) rather than TRACK_PADDING_PERCENT — a
                marker can be clamped as close as TRACK_PADDING_PERCENT to
                the edge, so anchoring the label there too risked the two
                colliding right at the boundary. Markers never reach the true
                0%/100% edge, so the label stays clear of them there. */}
            <span className="absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-zinc-50 pr-1.5 text-[11px] font-medium text-zinc-400">
              {edgeLow}
            </span>
            <span className="absolute right-0 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-zinc-50 pl-1.5 text-[11px] font-medium text-zinc-400">
              {edgeHigh}
            </span>
          </>
        )}

        {placedMine.map((entry) => {
          const pos = resolvePosition(`mine-${entry.id}`, entry.speed);
          const badgeId = resolveBadgeId(`mine-${entry.id}`, entry.speed);
          return (
            <div
              key={entry.id}
              className="absolute flex -translate-x-1/2 flex-col items-center gap-1"
              style={{
                left: `calc(${pos.percent}% + ${pos.offsetPx}px)`,
                bottom: `calc(50% + ${BADGE_CLEARANCE_PX}px)`,
              }}
              onMouseEnter={() => setHoveredId(badgeId)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <StageStepper
                stage={entry.stage}
                label={entry.pokemon.species}
                onDecrease={() => onStageChange(entry.id, -1)}
                onIncrease={() => onStageChange(entry.id, 1)}
              />
              <SpeedLineMarkerIcon entry={entry} highlighted={hoveredId === badgeId} />
            </div>
          );
        })}

        {placedOpponent.map((entry) => {
          const pos = resolvePosition(`opponent-${entry.id}`, entry.speed);
          const badgeId = resolveBadgeId(`opponent-${entry.id}`, entry.speed);
          return (
            <div
              key={entry.id}
              className="absolute flex -translate-x-1/2 flex-col items-center gap-1"
              style={{
                left: `calc(${pos.percent}% + ${pos.offsetPx}px)`,
                top: `calc(50% + ${BADGE_CLEARANCE_PX}px)`,
              }}
              onMouseEnter={() => setHoveredId(badgeId)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <SpeedLineMarkerIcon entry={entry} highlighted={hoveredId === badgeId} />
              <StageStepper
                stage={entry.stage}
                label={entry.pokemon.species}
                onDecrease={() => onStageChange(entry.id, -1)}
                onIncrease={() => onStageChange(entry.id, 1)}
              />
            </div>
          );
        })}

        {/* Badge layer, on top of both stacks — mine's badge always shows;
            the opponent's only shows when it isn't tied with a mine entry at
            the same Speed (see tiedSpeeds), so a tie still gets just the one
            badge, centered on the line like every other one instead of
            sitting flush above it. Each group renders as one merged pill
            (see groupBadges/SpeedLineBadgeGroup) so close-but-different
            values from opposite sides sit touching, side by side, instead of
            overlapping or needing a gap between them. Hovering a sprite or a
            segment highlights the other half of the same pair — see
            hoveredId. */}
        {badgeGroups.map((group) => (
          <span
            key={group.members.map((member) => member.id).join("|")}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${group.centerPercent}%` }}
          >
            <SpeedLineBadgeGroup
              members={group.members}
              hoveredId={hoveredId}
              onHoverChange={setHoveredId}
            />
          </span>
        ))}

        {allEntries.length === 0 && (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
            No Pokémon to show
          </span>
        )}
      </div>
    </>
  );
}

/**
 * Compares one of your own teams' real Speed (each Pokémon's actual pasted
 * item/nature/Stat Points, not a hypothetical spread) against a chosen
 * opponent's, on one shared horizontal line — slower to the left, faster to
 * the right — so you can read at a glance who outspeeds whom just from
 * x-position. My team's markers hang above the line, the opponent's sit
 * below it, so the two are never confused despite sharing one axis. A
 * marker's held item only shows as a badge when it actually changes the
 * Speed number next to it (Choice Scarf, Iron Ball) — every other held item
 * is real but irrelevant to this view.
 *
 * Two field-condition toggles adjust the numbers themselves rather than
 * just relabeling them: Tailwind doubles whichever side(s) have it on, and
 * Trick Room flips the line's left/right meaning (slowest goes first)
 * without touching the underlying Speed values.
 */
export function SpeedLine({ myTeams, defaultTeamId, regulationId }: SpeedLineProps) {
  const { opponents, isLoading } = useOpponents();

  const regulationTeams = useMemo(
    () => myTeams.filter((team) => team.regulationIds.includes(regulationId)),
    [myTeams, regulationId],
  );
  const regulationOpponents = useMemo(
    () => opponents.filter((opponent) => opponent.regulationId === regulationId),
    [opponents, regulationId],
  );

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedOpponentId, setSelectedOpponentId] = useState("");
  const [myTailwind, setMyTailwind] = useState(false);
  const [opponentTailwind, setOpponentTailwind] = useState(false);
  const [trickRoom, setTrickRoom] = useState(false);
  /** Per-Pokémon Speed stat stage (-6 to +6), keyed by the same id buildEntries assigns. Lives here rather than on the Pokémon data itself since it's a scratch battle-state adjustment for this view, not part of the saved team/opponent. */
  const [stageById, setStageById] = useState<Record<string, number>>({});
  const handleStageChange = (id: string, delta: number) => {
    setStageById((current) => ({
      ...current,
      [id]: clamp((current[id] ?? 0) + delta, SPEED_STAGE_MIN, SPEED_STAGE_MAX),
    }));
  };

  // Both fall back — team to the app-wide active team (if it's under this
  // regulation) else the first team, opponent to the first one under this
  // regulation — whenever the explicit choice isn't in the current list
  // (nothing picked yet, the regulation changed, or that team/opponent was
  // removed). Derived at render time rather than synced via an effect, so
  // there's no extra render pass.
  const effectiveTeamId = regulationTeams.some((team) => team.id === selectedTeamId)
    ? selectedTeamId
    : (regulationTeams.find((team) => team.id === defaultTeamId)?.id ??
      regulationTeams[0]?.id ??
      "");
  const effectiveOpponentId = regulationOpponents.some(
    (opponent) => opponent.id === selectedOpponentId,
  )
    ? selectedOpponentId
    : (regulationOpponents[0]?.id ?? "");

  const selectedTeam = regulationTeams.find((team) => team.id === effectiveTeamId) ?? null;
  const selectedOpponent =
    regulationOpponents.find((opponent) => opponent.id === effectiveOpponentId) ?? null;

  const myEntries = useMemo(
    () => buildEntries(selectedTeam?.pokemon ?? [], "mine", myTailwind, stageById),
    [selectedTeam, myTailwind, stageById],
  );
  const opponentEntries = useMemo(
    () =>
      selectedOpponent
        ? buildEntries(selectedOpponent.team.pokemon, "opponent", opponentTailwind, stageById)
        : [],
    [selectedOpponent, opponentTailwind, stageById],
  );

  const allSpeeds = [...myEntries, ...opponentEntries].map((entry) => entry.speed);
  const rawMin = allSpeeds.length ? Math.min(...allSpeeds) : 0;
  const rawMax = allSpeeds.length ? Math.max(...allSpeeds) : 0;
  // Padded 10 Speed points beyond the real min/max on each end, so the
  // slowest/fastest marker isn't jammed against the line's edge — the same
  // padded values are what the edge labels display.
  const minSpeed = allSpeeds.length ? rawMin - AXIS_PADDING : 0;
  const maxSpeed = allSpeeds.length ? rawMax + AXIS_PADDING : 0;

  if (isLoading) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }

  if (regulationTeams.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
        Add one of your teams for this regulation first, then come back to compare its Speed.
      </div>
    );
  }

  if (regulationOpponents.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
        No opponents saved yet for this regulation — add one from the Matchup Planner first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative shrink-0">
          <select
            value={effectiveTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
            aria-label="Your team"
            className="appearance-none rounded-full border border-zinc-300 bg-zinc-50 py-2 pl-3 pr-8 text-sm font-medium text-zinc-700"
          >
            {regulationTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <Icon
            name={IconName.ExpandMore}
            size={16}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={effectiveOpponentId}
            onChange={(event) => setSelectedOpponentId(event.target.value)}
            aria-label="Opponent team"
            className="appearance-none rounded-full border border-zinc-300 bg-zinc-50 py-2 pl-3 pr-8 text-sm font-medium text-zinc-700"
          >
            {regulationOpponents.map((opponent) => (
              <option key={opponent.id} value={opponent.id}>
                {opponent.label}
              </option>
            ))}
          </select>
          <Icon
            name={IconName.ExpandMore}
            size={16}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <ModifierToggle
            label="Tailwind: My Team"
            active={myTailwind}
            activeClassName="bg-sky-600 text-white"
            onClick={() => setMyTailwind((value) => !value)}
          />
          <ModifierToggle
            label={`Tailwind: ${selectedOpponent?.label ?? "Opponent"}`}
            active={opponentTailwind}
            activeClassName="bg-rose-600 text-white"
            onClick={() => setOpponentTailwind((value) => !value)}
          />
          <ModifierToggle
            label="Trick Room"
            active={trickRoom}
            activeClassName="bg-violet-600 text-white"
            onClick={() => setTrickRoom((value) => !value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-600">
            <LegendDot colorClassName="bg-sky-500" label="My Team" />
            <LegendDot colorClassName="bg-rose-500" label={selectedOpponent?.label ?? "Opponent"} />
          </div>
          <div className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 md:flex">
            <span>{trickRoom ? "Faster" : "Slower"}</span>
            <span>—</span>
            <span>{trickRoom ? "Slower" : "Faster"}</span>
          </div>
        </div>
        <SpeedLineTrack
          myEntries={myEntries}
          opponentEntries={opponentEntries}
          min={minSpeed}
          max={maxSpeed}
          reversed={trickRoom}
          onStageChange={handleStageChange}
        />
      </div>
    </div>
  );
}
