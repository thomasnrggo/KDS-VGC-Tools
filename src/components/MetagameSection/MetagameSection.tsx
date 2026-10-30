"use client";

import { useState } from "react";
import movesData from "@/data/moves.json";
import { REGULATIONS } from "@/data/regulations";
import { useMeta } from "@/hooks/useMeta";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { cn } from "@/lib/utils";
import type { MetaPokemon, Share } from "@/lib/meta/aggregateMeta";
import type { MoveData } from "@/types/damage";
import { IconName } from "@/enums";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import { LoadingState } from "../LoadingState";
import { PokemonSprite } from "../PokemonSprite";
import { SearchField } from "../SearchField";
import { RegulationSelect } from "../Select";
import { TypeIcon } from "../TypeIcon";

const MOVES = movesData as unknown as Record<string, MoveData>;

function percent(share: number, digits = 0): string {
  return `${(share * 100).toFixed(digits)}%`;
}

/** At least this much more (or less) common in the top 32 than overall gets an arrow. */
const TOP_DIFFERENCE = 0.05;
/** Fewer rounds than this and a win rate is mostly noise — shown faded. */
const MIN_ROUNDS = 100;

/**
 * The Metagame page: what official tournaments are bringing in a
 * regulation, from the metagame job's summary (useMeta). One row per
 * Pokémon — usage, usage in the top 32, win rate — opening to its common
 * sets, items, abilities, moves and teammates.
 */
export function MetagameSection() {
  const t = useMessages();
  const text = usePokemonText();
  const { appLanguage } = useLanguageSettings();
  const [regulationId, setRegulationId] = useState(REGULATIONS[0]?.id ?? "");
  const { meta, isLoading } = useMeta(regulationId);
  const [query, setQuery] = useState("");
  const [openSpecies, setOpenSpecies] = useState<string | null>(null);

  const official = meta?.official;
  const ranked = (official?.pokemon ?? []).map((mon, index) => ({ mon, rank: index + 1 }));
  const folded = foldForSearch(query.trim());
  const visible = folded
    ? ranked.filter(
        ({ mon }) =>
          foldForSearch(mon.species).includes(folded) ||
          foldForSearch(text.species(mon.species)).includes(folded),
      )
    : ranked;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-900">{t.metagame.title}</h2>
        {REGULATIONS.length > 1 && (
          <RegulationSelect
            value={regulationId}
            onChange={(id) => {
              setRegulationId(id);
              setOpenSpecies(null);
            }}
          />
        )}
      </div>

      {isLoading && !official ? (
        <LoadingState />
      ) : !official ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-600">
          {t.metagame.noData}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1 text-sm text-zinc-600">
            <p>
              <span className="font-medium text-zinc-800">
                {t.metagame.basedOn(official.tournaments.length, official.teams)}
              </span>
              {" · "}
              {t.metagame.updated(
                new Date(meta.updatedAt).toLocaleDateString(appLanguage, {
                  month: "short",
                  day: "numeric",
                }),
              )}
            </p>
            <details className="group text-xs text-zinc-500">
              <summary className="cursor-pointer list-none hover:text-zinc-700">
                {t.metagame.source} <span className="underline">{t.metagame.tournaments}</span>
              </summary>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {[...official.tournaments]
                  .sort((a, b) => b.startDate.localeCompare(a.startDate))
                  .map((tournament) => (
                    <li key={tournament.id}>
                      {tournament.title} · {tournament.teams.toLocaleString(appLanguage)}
                    </li>
                  ))}
              </ul>
            </details>
          </div>

          <SearchField
            query={query}
            onQueryChange={setQuery}
            placeholder={t.metagame.searchPlaceholder}
            ariaLabel={t.metagame.searchLabel}
            className="w-full sm:max-w-sm"
          />

          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              {t.metagame.noMatches(query.trim())}
            </p>
          ) : (
            <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200">
              <div
                className={cn(
                  ROW_GRID,
                  "bg-zinc-100 py-2 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase",
                )}
              >
                <span className="text-right">#</span>
                <span className="col-span-2">{t.metagame.pokemon}</span>
                <span title={t.metagame.usageHint} className="text-right">
                  {t.metagame.usage}
                </span>
                <span title={t.metagame.topHint} className="text-right">
                  {t.metagame.top}
                </span>
                <span className="text-right">{t.metagame.winRate}</span>
              </div>
              <ul className="flex flex-col divide-y divide-zinc-200">
                {visible.map(({ mon, rank }) => (
                  <MetaRow
                    key={mon.species}
                    mon={mon}
                    rank={rank}
                    maxUsage={ranked[0]?.mon.usage ?? 1}
                    isOpen={openSpecies === mon.species}
                    onToggle={() =>
                      setOpenSpecies((current) => (current === mon.species ? null : mon.species))
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Rank · sprite · name · usage · top 32 · win rate. */
const ROW_GRID =
  "grid grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_4rem_3.5rem_3.5rem] items-center gap-x-2 px-3 sm:grid-cols-[2rem_3rem_minmax(0,1fr)_8rem_5rem_5rem] sm:gap-x-3";

function MetaRow({
  mon,
  rank,
  maxUsage,
  isOpen,
  onToggle,
}: {
  mon: MetaPokemon;
  rank: number;
  maxUsage: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const name = text.species(mon.species);
  const difference = mon.topUsage - mon.usage;

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
              style={{ width: `${(mon.usage / maxUsage) * 100}%` }}
            />
          </span>
        </span>
        <span
          className={cn(
            "flex items-center justify-end gap-0.5 tabular-nums",
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
          title={t.metagame.winRateHint(mon.rounds)}
          className={cn(
            "text-right tabular-nums",
            mon.rounds < MIN_ROUNDS
              ? "text-zinc-400"
              : mon.winRate !== null && mon.winRate >= 0.53
                ? "text-green-700 dark:text-green-300"
                : mon.winRate !== null && mon.winRate <= 0.47
                  ? "text-red-600 dark:text-red-300"
                  : "text-zinc-700",
          )}
        >
          {mon.winRate === null ? "—" : percent(mon.winRate)}
        </span>
      </button>
      {isOpen && <MetaDetails mon={mon} />}
    </li>
  );
}

function MetaDetails({ mon }: { mon: MetaPokemon }) {
  const t = useMessages();
  const text = usePokemonText();

  return (
    <div className="grid grid-cols-1 gap-4 px-3 pt-1 pb-4 sm:pl-[5.75rem] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
                {set.ability && <span className="text-zinc-700">{text.ability(set.ability)}</span>}
                {set.nature && <span className="text-zinc-500">{text.nature(set.nature)}</span>}
                <span className="ml-auto text-xs text-zinc-500">
                  {t.metagame.setShare(percent(set.share))}
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
          render={(name) => (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="relative h-7 w-7 shrink-0">
                <PokemonSprite species={name} fill />
              </span>
              <span className="truncate">{text.species(name)}</span>
            </span>
          )}
        />
      </div>
    </div>
  );
}

const DETAIL_TITLE = "text-xs font-semibold tracking-wide text-zinc-500 uppercase";

/** A titled list of names with the share of this Pokémon's teams that have each. */
function ShareList({
  title,
  shares,
  render,
}: {
  title: string;
  shares: Share[];
  render: (name: string) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={DETAIL_TITLE}>{title}</h3>
      <ul className="flex flex-col gap-1">
        {shares.map(({ name, share }) => (
          <li key={name} className="flex flex-col gap-0.5 text-sm text-zinc-800">
            <span className="flex items-center justify-between gap-2">
              {render(name)}
              <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{percent(share)}</span>
            </span>
            <span className="h-1 overflow-hidden rounded-full bg-zinc-200">
              <span
                className="block h-full rounded-full bg-zinc-400"
                style={{ width: percent(share) }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoveName({ move }: { move: string }) {
  const text = usePokemonText();
  const type = MOVES[normalizeSpeciesKey(move)]?.type;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {type && (
        <span className="shrink-0 overflow-hidden rounded">
          <TypeIcon type={type} size={16} />
        </span>
      )}
      <span className="truncate">{text.move(move)}</span>
    </span>
  );
}

/** A move as the Pokémon cards show it: a light pill with its type icon. */
function MovePill({ move }: { move: string }) {
  return (
    <li className="flex h-7 min-w-0 items-center rounded bg-zinc-100 px-1.5 text-[13px] text-zinc-800">
      <MoveName move={move} />
    </li>
  );
}
