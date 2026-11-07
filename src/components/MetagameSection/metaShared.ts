/** The Metagame page's shared numbers, types and formatting (see MetagameSection). */

import movesData from "@/data/moves.json";
import typeChart from "@/data/typeChart.json";
import { type MetaFinalist, type MetaTournament } from "@/lib/meta/metaDocument";
import type { MoveData } from "@/types/damage";

export const MOVES = movesData as unknown as Record<string, MoveData>;

export function percent(share: number, digits = 0): string {
  return `${(share * 100).toFixed(digits)}%`;
}

/** At least this much more (or less) common in the top 32 than overall gets an arrow. */
export const TOP_DIFFERENCE = 0.05;
/** Fewer rounds than this and a win rate is mostly noise — shown faded. */
export const MIN_ROUNDS = 100;
/** How many Pokémon, and how many of each core size, the overview shows. */
export const OVERVIEW_POKEMON = 20;
export const OVERVIEW_CORES = 10;
export const TYPES = Object.keys(typeChart);
/** A searched Pokémon's sprite in a core or team. */
export const HIGHLIGHT_SPRITE = "bg-zinc-200 ring-2 ring-chrome-600";
export const CORE_SIZES = { pairs: 2, trios: 3, quads: 4 } as const;
/** A change of at least this much at the latest event gets an arrow. */
export const TREND_DIFFERENCE = 0.02;
/** The overview cards show a change from a point (rounded) up. */
export const CARD_TREND_DIFFERENCE = 0.005;

/** The newest events, the whole regulation, or one tournament (its id). */
export type Scope = "recent" | "all" | (string & {});
export type Tab = "overview" | "pokemon" | "megas" | "cores" | "teams";
export type Sort = "usage" | "top" | "winRate" | "rising" | "falling";
export type CoreSize = "pairs" | "trios" | "quads";
/** A card's change in usage between two events, and the line saying so. */
export interface CardTrend {
  delta: number;
  hint: string;
}

/** Usage at the newest event, and at the one before it (null with only one event). */
export interface Trend {
  latest: number;
  previous: number | null;
}

/** Green for a good win rate, red for a poor one, faded when there are too few rounds to tell. */
export function winRateTone(winRate: number | null, rounds: number): string {
  if (rounds < MIN_ROUNDS) return "text-zinc-400";
  if (winRate !== null && winRate >= 0.53) return "text-green-700 dark:text-green-300";
  if (winRate !== null && winRate <= 0.47) return "text-red-600 dark:text-red-300";
  return "text-zinc-700";
}

/** Green when it rose at the latest event, red when it fell. */
export function trendTone(delta: number | null, threshold = TREND_DIFFERENCE): string {
  if (delta !== null && delta >= threshold) return "text-green-700 dark:text-green-300";
  if (delta !== null && delta <= -threshold) return "text-red-600 dark:text-red-300";
  return "text-zinc-600";
}

export const STATS_GRID = "grid shrink-0 grid-cols-2 gap-2 pb-4 sm:grid-cols-4";

export const DETAIL_TITLE = "text-xs font-semibold tracking-wide text-zinc-500 uppercase";

/** "13–2", or "12–2–1" with ties. */
export function formatRecord({ wins, losses, ties }: MetaFinalist["record"]): string {
  return ties ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;
}

/** An event's date, read in UTC (the ISO date is UTC midnight). */
export function eventDate(event: MetaTournament, language: string): string {
  return new Date(event.startDate).toLocaleDateString(language, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Rank · sprite · name · usage · top 32 (from sm) · latest · win rate. */
export const ROW_GRID =
  "grid grid-cols-[1.25rem_2.5rem_minmax(0,1fr)_3.5rem_3.75rem_3rem] items-center gap-x-2 px-3 sm:grid-cols-[2rem_3rem_minmax(0,1fr)_8rem_5rem_5rem_5rem] sm:gap-x-3";
