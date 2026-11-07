"use client";

/** The Metagame's lists: every Pokémon as an expandable row (with its details), and the cores and full teams. */

import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import type { MetaCombo, MetaPokemon, MetaTeam } from "@/lib/meta/aggregateMeta";
import { stripMegaSuffix } from "@/lib/species/megaForm";
import { speciesLabel } from "@/lib/species/speciesLabel";
import { shortTournamentName, type MetaTournament } from "@/lib/meta/metaDocument";
import { formatPokemonPaste } from "@/lib/formatPokemonPaste";
import { findMetaSpread, type MetaSpreads } from "@/lib/meta/metaSpreads";
import { IconName } from "@/enums";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import { PokemonSprite } from "../PokemonSprite";
import { IconButton } from "../Button";
import { toast } from "../Toast";
import {
  DETAIL_TITLE,
  ROW_GRID,
  TOP_DIFFERENCE,
  TREND_DIFFERENCE,
  Trend,
  percent,
  trendTone,
  winRateTone,
} from "./metaShared";
import { MoveName, MovePill, ShareList } from "./MetaParts";

/** Rank · sprites (and names) · usage · top 32 · win rate — cores, and full teams with their best finish. */
export function ComboList({
  combos,
  hint,
  isTeams,
  matches,
  emptyLabel,
}: {
  combos: (MetaCombo | MetaTeam)[];
  hint: string;
  isTeams: boolean;
  matches: (combo: MetaCombo) => boolean;
  emptyLabel: string;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const visible = combos
    .map((combo, index) => ({ combo, rank: index + 1 }))
    .filter(({ combo }) => matches(combo));
  if (visible.length === 0) {
    return <p className="py-10 text-center text-sm text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-500">{hint}</p>
      <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200">
        {visible.map(({ combo, rank }) => {
          const best = "best" in combo ? combo.best : undefined;
          return (
            <li
              key={combo.species.join("|")}
              className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="w-5 shrink-0 text-right text-xs text-zinc-500 tabular-nums">
                  {rank}
                </span>
                <span className="flex shrink-0 gap-0.5">
                  {combo.species.map((species) => (
                    <span
                      key={species}
                      title={text.species(species)}
                      className="relative h-9 w-9 sm:h-10 sm:w-10"
                    >
                      <PokemonSprite species={species} fill />
                    </span>
                  ))}
                </span>
                {!isTeams && (
                  <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                    {combo.species.map((species) => text.species(species)).join(" + ")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-7 text-sm tabular-nums sm:pl-0">
                <span title={t.metagame.usageHint}>
                  <span className="font-semibold text-zinc-900">{percent(combo.usage, 1)}</span>
                  {isTeams && (
                    <span className="ml-1 text-xs text-zinc-500">
                      {t.metagame.teamsCount(combo.teams)}
                    </span>
                  )}
                </span>
                <span title={t.metagame.topHint} className="text-zinc-600">
                  <span className="text-[10px] text-zinc-400 uppercase">{t.metagame.top}</span>{" "}
                  {percent(combo.topUsage)}
                </span>
                <span title={t.metagame.winRateHint(combo.rounds)} className="text-zinc-600">
                  <span className="text-[10px] text-zinc-400 uppercase">{t.metagame.winRate}</span>{" "}
                  {combo.winRate === null ? "—" : percent(combo.winRate)}
                </span>
                {best && (
                  <span className="text-zinc-600">
                    <span className="text-[10px] text-zinc-400 uppercase">{t.metagame.best}</span>{" "}
                    {t.metagame.bestFinish(
                      t.metagame.placing(best.placing),
                      shortTournamentName(best.tournament),
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MetaRow({
  mon,
  rank,
  trend,
  latestEvent,
  previousEvent,
  history,
  tournaments,
  recentIds,
  spreads,
  onOpenPokemon,
  isOpen,
  onToggle,
}: {
  spreads: MetaSpreads;
  onOpenPokemon: (species: string) => void;
  mon: MetaPokemon;
  rank: number;
  trend: Trend | null;
  latestEvent: MetaTournament | undefined;
  previousEvent: MetaTournament | undefined;
  history: MetaPokemon["history"];
  tournaments: MetaTournament[];
  recentIds: Set<string>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const name = speciesLabel(text, mon.species);
  const difference = mon.topUsage - mon.usage;
  const delta = trend && trend.previous !== null ? trend.latest - trend.previous : null;

  return (
    <li className={cn(isOpen && "bg-zinc-50")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? t.metagame.hideDetails(name) : t.metagame.showDetails(name)}
        className={cn(ROW_GRID, "w-full py-1.5 text-left text-sm hover:bg-zinc-100")}
      >
        <span className="text-right text-xs text-zinc-500 tabular-nums">{rank}</span>
        <span className="relative h-10 w-10 sm:h-12 sm:w-12">
          <PokemonSprite species={mon.species} fill />
        </span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-medium text-zinc-900">{name}</span>
          <Icon
            name={IconName.ExpandMore}
            size={16}
            className={cn("shrink-0 text-zinc-400 transition-transform", isOpen && "rotate-180")}
          />
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="font-semibold text-zinc-900 tabular-nums">{percent(mon.usage, 1)}</span>
          <span className="hidden h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 sm:block">
            <span
              className="block h-full rounded-full bg-chrome-600"
              style={{ width: percent(mon.usage) }}
            />
          </span>
        </span>
        <span
          className={cn(
            "hidden items-center justify-end gap-0.5 tabular-nums sm:flex",
            difference >= TOP_DIFFERENCE
              ? "text-green-700 dark:text-green-300"
              : difference <= -TOP_DIFFERENCE
                ? "text-red-600 dark:text-red-300"
                : "text-zinc-600",
          )}
          title={
            difference >= TOP_DIFFERENCE
              ? t.metagame.moreAtTop
              : difference <= -TOP_DIFFERENCE
                ? t.metagame.lessAtTop
                : undefined
          }
        >
          {percent(mon.topUsage)}
          {Math.abs(difference) >= TOP_DIFFERENCE && (
            <span aria-hidden="true" className="text-[10px]">
              {difference > 0 ? "▲" : "▼"}
            </span>
          )}
        </span>
        <span
          title={
            trend && latestEvent
              ? t.metagame.latestHint(
                  shortTournamentName(latestEvent.title),
                  percent(trend.latest),
                  previousEvent ? shortTournamentName(previousEvent.title) : null,
                  trend.previous !== null ? percent(trend.previous) : null,
                )
              : undefined
          }
          className={cn("flex items-center justify-end gap-0.5 tabular-nums", trendTone(delta))}
        >
          {trend ? percent(trend.latest) : "—"}
          {delta !== null && Math.abs(delta) >= TREND_DIFFERENCE && (
            <span aria-hidden="true" className="text-[10px]">
              {delta > 0 ? "▲" : "▼"}
              {Math.round(Math.abs(delta) * 100)}
            </span>
          )}
        </span>
        <span
          title={t.metagame.winRateHint(mon.rounds)}
          className={cn("text-right tabular-nums", winRateTone(mon.winRate, mon.rounds))}
        >
          {mon.winRate === null ? "—" : percent(mon.winRate)}
        </span>
      </button>
      {isOpen && (
        <MetaDetails
          mon={mon}
          history={history}
          tournaments={tournaments}
          recentIds={recentIds}
          spreads={spreads}
          onOpenPokemon={onOpenPokemon}
        />
      )}
    </li>
  );
}

export function MetaDetails({
  mon,
  history,
  tournaments,
  recentIds,
  inset = true,
  spreads,
  onOpenPokemon,
}: {
  mon: MetaPokemon;
  history: MetaPokemon["history"];
  tournaments: MetaTournament[];
  recentIds: Set<string>;
  /** Lined up under a table row's name (true), or on its own in a dialog. */
  inset?: boolean;
  /** The admin's spreads — a copied set gets its Stat Points. */
  spreads?: MetaSpreads;
  /** Opens a teammate's details; without it, teammates are plain text. */
  onOpenPokemon?: (species: string) => void;
}) {
  const t = useMessages();
  const text = usePokemonText();

  /** The set as a paste: the admin's spread (and nature) for it when there is one. */
  async function copySet(set: MetaPokemon["sets"][number]) {
    const spread = findMetaSpread(spreads, mon.species, set.item);
    const paste = formatPokemonPaste({
      species: stripMegaSuffix(mon.species),
      item: set.item,
      ability: set.ability,
      nature: spread?.nature ?? set.nature,
      evs: spread?.evs,
      moves: set.moves,
    });
    try {
      await navigator.clipboard.writeText(paste);
      toast.success(t.metagame.setCopied);
    } catch {
      toast.error(t.opponentCard.copyFailed);
    }
  }
  const padding = inset && "px-3 sm:pl-[5.75rem]";
  const peak = Math.max(...history.map((point) => point.usage), 0.01);

  return (
    <>
      {/* Phones leave the Top 32 column out of the row. */}
      {inset && (
        <p className="px-3 pt-1 text-xs text-zinc-600 sm:hidden">
          {t.metagame.top}: <span className="font-medium">{percent(mon.topUsage)}</span>
        </p>
      )}
      {history.length > 1 && (
        <div className={cn("flex flex-col gap-2", inset && "pt-2", padding)}>
          <h3 className={DETAIL_TITLE}>{t.metagame.history}</h3>
          <ol className="flex items-end gap-1.5 overflow-x-auto pb-1">
            {history.map((point, index) => {
              const tournament = tournaments[index];
              if (!tournament) return null;
              const isRecent = recentIds.has(tournament.id);
              return (
                <li
                  key={tournament.id}
                  title={`${tournament.title} · ${percent(point.usage, 1)}`}
                  className="flex w-14 shrink-0 flex-col items-center gap-1"
                >
                  <span className="text-[11px] text-zinc-700 tabular-nums">
                    {percent(point.usage)}
                  </span>
                  <span className="flex h-16 w-6 items-end overflow-hidden rounded-t bg-zinc-100">
                    <span
                      className={cn(
                        "block w-full rounded-t",
                        isRecent ? "bg-chrome-600" : "bg-zinc-300",
                      )}
                      style={{ height: `${(point.usage / peak) * 100}%` }}
                    />
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-zinc-500">
                    {shortTournamentName(tournament.title)}
                  </span>
                  <span className="text-[10px] text-zinc-400 tabular-nums">{tournament.teams}</span>
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] text-zinc-400">{t.metagame.historyHint}</p>
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-1 gap-4 pt-1 pb-4",
          padding,
          inset && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
        <div className="flex flex-col gap-2">
          <h3 className={DETAIL_TITLE}>{t.metagame.sets}</h3>
          <ul className="flex flex-col gap-2">
            {mon.sets.slice(0, 3).map((set, index) => (
              <li
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-raised p-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {set.item && (
                    <span className="flex items-center gap-1.5 font-medium text-zinc-900">
                      <ItemIcon item={set.item} size={20} />
                      {text.item(set.item)}
                    </span>
                  )}
                  {set.ability && (
                    <span className="text-zinc-700">{text.ability(set.ability)}</span>
                  )}
                  {set.nature && <span className="text-zinc-500">{text.nature(set.nature)}</span>}
                  <span className="ml-auto flex items-center gap-1 text-xs text-zinc-500">
                    {t.metagame.setShare(percent(set.share))}
                    <IconButton
                      variant="ghost"
                      onClick={() => copySet(set)}
                      aria-label={t.metagame.copySet}
                      title={t.metagame.copySet}
                      className="h-7 w-7"
                    >
                      <Icon name={IconName.ContentCopy} size={14} />
                    </IconButton>
                  </span>
                </div>
                <ul className="grid grid-cols-2 gap-1.5">
                  {set.moves.map((move) => (
                    <MovePill key={move} move={move} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <ShareList
            title={t.metagame.items}
            shares={mon.items.slice(0, 5)}
            render={(name) => (
              <span className="flex min-w-0 items-center gap-1.5">
                <ItemIcon item={name} size={18} />
                <span className="truncate">{text.item(name)}</span>
              </span>
            )}
          />
          <ShareList
            title={t.metagame.abilities}
            shares={mon.abilities.slice(0, 3)}
            render={(name) => <span className="truncate">{text.ability(name)}</span>}
          />
          <ShareList
            title={t.metagame.moves}
            shares={mon.moves.slice(0, 8)}
            render={(name) => <MoveName move={name} />}
          />
          <ShareList
            title={t.metagame.teammates}
            shares={mon.teammates.slice(0, 6)}
            render={(name) => {
              const label = (
                <>
                  <span className="relative h-7 w-7 shrink-0">
                    <PokemonSprite species={name} fill />
                  </span>
                  <span className="truncate">{text.species(name)}</span>
                </>
              );
              return onOpenPokemon ? (
                <button
                  type="button"
                  onClick={() => onOpenPokemon(name)}
                  aria-label={t.metagame.openDetails(text.species(name))}
                  className="flex min-w-0 items-center gap-1.5 text-left hover:underline"
                >
                  {label}
                  <Icon name={IconName.ChevronRight} size={14} className="shrink-0 text-zinc-400" />
                </button>
              ) : (
                <span className="flex min-w-0 items-center gap-1.5">{label}</span>
              );
            }}
          />
        </div>
      </div>
    </>
  );
}
