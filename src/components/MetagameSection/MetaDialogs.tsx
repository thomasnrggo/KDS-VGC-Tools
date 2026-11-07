"use client";

/** The Metagame's dialogs: a Pokémon, a core, and a finalist's team sheet. */

import Link from "next/link";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import type { MetaCombo, MetaPokemon } from "@/lib/meta/aggregateMeta";
import { stripMegaSuffix } from "@/lib/species/megaForm";
import { speciesLabel } from "@/lib/species/speciesLabel";
import {
  shortTournamentName,
  type MetaFinalist,
  type MetaTournament,
} from "@/lib/meta/metaDocument";
import { formatTeamPaste } from "@/lib/formatPokemonPaste";
import { createTeam, validateTeamSize } from "@/lib/team";
import { type MetaSpreads } from "@/lib/meta/metaSpreads";
import type { Team } from "@/types";
import { IconName } from "@/enums";
import { Icon } from "../Icon";
import { PokemonSprite } from "../PokemonSprite";
import { Modal } from "../Modal";
import { Button } from "../Button";
import { TeamSheetPreview } from "../TeamSheetPreview";
import { toast } from "../Toast";
import {
  DETAIL_TITLE,
  STATS_GRID,
  TREND_DIFFERENCE,
  Trend,
  eventDate,
  formatRecord,
  percent,
  trendTone,
  winRateTone,
} from "./metaShared";
import { DetailHeader, Stat } from "./MetaParts";
import { MetaDetails } from "./MetaTable";

/** Everything about one Pokémon: its numbers, history, sets, items, moves and teammates. */
export function PokemonDetailModal({
  mon,
  rank,
  trend,
  history,
  tournaments,
  recentIds,
  scopeShort,
  spreads,
  libraryOpen,
  onOpenPokemon,
  onClose,
}: {
  mon: MetaPokemon;
  rank: number;
  trend: Trend | null;
  history: MetaPokemon["history"];
  tournaments: MetaTournament[];
  recentIds: Set<string>;
  /** What the usage covers: "last 4 events"… */
  scopeShort: string;
  spreads: MetaSpreads;
  /** Whether to link the Team Library (its section is on). */
  libraryOpen: boolean;
  /** Opens a teammate's details. */
  onOpenPokemon: (species: string) => void;
  onClose: () => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const delta = trend && trend.previous !== null ? trend.latest - trend.previous : null;
  const latestEvent = tournaments.at(-1);
  const previousEvent = tournaments.at(-2);
  const baseName = text.species(stripMegaSuffix(mon.species));

  return (
    <Modal onClose={onClose} labelledBy="meta-pokemon-title" size="wide" fullScreenOnPhone>
      <DetailHeader
        id="meta-pokemon-title"
        species={[mon.species]}
        title={speciesLabel(text, mon.species)}
        subtitle={`${t.metagame.rank(rank)} · ${t.metagame.teamsCount(mon.teams)}`}
        onClose={onClose}
      />
      <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 sm:mx-0 sm:px-0">
        <div className={STATS_GRID}>
          <Stat
            label={t.metagame.usage}
            value={percent(mon.usage, 1)}
            caption={scopeShort}
            hint={t.metagame.usageHint}
          />
          <Stat
            label={t.metagame.top}
            value={percent(mon.topUsage)}
            caption={t.metagame.ofTopTeams}
            hint={t.metagame.topHint}
          />
          <Stat
            label={
              latestEvent
                ? t.metagame.atEvent(shortTournamentName(latestEvent.title))
                : t.metagame.latest
            }
            caption={
              trend?.previous != null && previousEvent
                ? t.metagame.vsPrevious(
                    shortTournamentName(previousEvent.title),
                    percent(trend.previous),
                  )
                : undefined
            }
            value={
              trend ? (
                <>
                  {percent(trend.latest)}
                  {delta !== null && Math.abs(delta) >= TREND_DIFFERENCE && (
                    <span className="ml-1 text-xs">
                      {delta > 0 ? "▲" : "▼"}
                      {Math.round(Math.abs(delta) * 100)}
                    </span>
                  )}
                </>
              ) : (
                "—"
              )
            }
            className={trendTone(delta)}
          />
          <Stat
            label={t.metagame.winRate}
            value={mon.winRate === null ? "—" : percent(mon.winRate)}
            caption={t.metagame.roundsCount(mon.rounds)}
            hint={t.metagame.winRateHint(mon.rounds)}
            className={winRateTone(mon.winRate, mon.rounds)}
          />
        </div>
        {libraryOpen && (
          <Link
            href={`/team-library?q=${encodeURIComponent(stripMegaSuffix(mon.species))}`}
            className="mb-4 flex w-fit items-center gap-1 text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
          >
            {t.metagame.findInLibrary(baseName)}
            <Icon name={IconName.ChevronRight} size={16} />
          </Link>
        )}
        <MetaDetails
          mon={mon}
          history={history}
          tournaments={tournaments}
          recentIds={recentIds}
          inset={false}
          spreads={spreads}
          onOpenPokemon={onOpenPokemon}
        />
      </div>
    </Modal>
  );
}

/** A core's numbers and its Pokémon — each opens its own details. */
export function CoreDetailModal({
  core,
  pokemon,
  onOpenPokemon,
  onClose,
}: {
  core: MetaCombo;
  pokemon: MetaPokemon[];
  onOpenPokemon: (species: string) => void;
  onClose: () => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  // Cores count plain species; the list keeps Megas apart, so a member opens
  // its most-used form (Raichu → Mega Raichu Y when nearly every one is).
  const formOf = (species: string) =>
    pokemon.find((mon) => stripMegaSuffix(mon.species) === species);

  return (
    <Modal onClose={onClose} labelledBy="meta-core-title" size="wide">
      <DetailHeader
        id="meta-core-title"
        species={core.species}
        title={core.species.map((species) => text.species(species)).join(" / ")}
        subtitle={t.metagame.coresOf(core.species.length)}
        onClose={onClose}
      />
      <div className={STATS_GRID}>
        <Stat label={t.metagame.teams} value={core.teams.toLocaleString()} />
        <Stat label={t.metagame.usage} value={percent(core.usage, 1)} hint={t.metagame.usageHint} />
        <Stat label={t.metagame.top} value={percent(core.topUsage)} hint={t.metagame.topHint} />
        <Stat
          label={t.metagame.winRate}
          value={core.winRate === null ? "—" : percent(core.winRate)}
          hint={t.metagame.winRateHint(core.rounds)}
          className={winRateTone(core.winRate, core.rounds)}
        />
      </div>
      <h3 className={cn(DETAIL_TITLE, "pb-2")}>{t.metagame.members}</h3>
      <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-raised">
        {core.species.map((species) => {
          const mon = formOf(species);
          const name = mon ? speciesLabel(text, mon.species) : text.species(species);
          return (
            <li key={species}>
              <button
                type="button"
                disabled={!mon}
                onClick={() => mon && onOpenPokemon(mon.species)}
                aria-label={t.metagame.openDetails(name)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm enabled:hover:bg-zinc-100"
              >
                <span className="relative h-10 w-10 shrink-0">
                  <PokemonSprite species={mon?.species ?? species} fill />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">{name}</span>
                {mon && (
                  <>
                    <span className="text-zinc-600 tabular-nums">{percent(mon.usage, 1)}</span>
                    <Icon name={IconName.ChevronRight} size={18} className="text-zinc-400" />
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/** A finalist's team sheet, with a copy of it as a paste. */
export function FinalistModal({
  event,
  finalist,
  regulationId,
  myTeams,
  onAddTeam,
  onClose,
}: {
  event: MetaTournament;
  finalist: MetaFinalist;
  regulationId: string;
  myTeams: Team[];
  onAddTeam: (team: Team) => void;
  onClose: () => void;
}) {
  const t = useMessages();
  const { appLanguage } = useLanguageSettings();
  const placing = t.metagame.finalistPlacing(finalist.placing);
  const teamName = `${shortTournamentName(event.title)} ${placing}`;
  const paste = formatTeamPaste(finalist.team);

  /** Saves the team sheet as a new team of mine — once. */
  function addToMyTeams() {
    const existing = myTeams.find((mine) => mine.rawPaste === paste);
    if (existing) {
      toast.info(t.metagame.alreadyInMyTeams(existing.name));
      return;
    }
    const team = createTeam(paste, teamName, regulationId);
    const sizeError = validateTeamSize(team.pokemon);
    if (sizeError) {
      toast.error(sizeError);
      return;
    }
    onAddTeam(team);
    toast.success(t.metagame.addedToMyTeams(teamName));
  }

  async function copyTeam() {
    try {
      await navigator.clipboard.writeText(paste);
      toast.success(t.metagame.teamCopied);
    } catch {
      toast.error(t.opponentCard.copyFailed);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="meta-finalist-title" size="wide" fullScreenOnPhone>
      <DetailHeader
        id="meta-finalist-title"
        species={[]}
        title={`${placing} · ${shortTournamentName(event.title)}`}
        subtitle={`${event.title} · ${eventDate(event, appLanguage)} · ${formatRecord(finalist.record)}`}
        onClose={onClose}
      />
      <TeamSheetPreview pokemon={finalist.team} />
      <div className="flex flex-wrap justify-end gap-2 pt-3">
        <Button variant="outline" onClick={copyTeam} className="flex items-center gap-1.5">
          <Icon name={IconName.ContentCopy} size={16} />
          {t.metagame.copyTeam}
        </Button>
        <Button onClick={addToMyTeams} className="flex items-center gap-1.5">
          <Icon name={IconName.Add} size={16} />
          {t.metagame.addToMyTeams}
        </Button>
      </div>
    </Modal>
  );
}
