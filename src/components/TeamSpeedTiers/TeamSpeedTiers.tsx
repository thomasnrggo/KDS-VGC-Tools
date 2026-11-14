"use client";

import { Fragment, useState } from "react";
import { PokemonSprite } from "../PokemonSprite";
import { SearchableSelect } from "../SearchableSelect";
import { Select } from "../Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Popover } from "@base-ui/react/popover";
import { Icon } from "../Icon";
import { PageTips, PageTipsButton } from "../PageTips";
import { IconName } from "@/enums";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { useMeta } from "@/hooks/useMeta";
import { computeSpeedTierRows, type SpeedTierRow } from "@/lib/stats/computeSpeedTiers";
import {
  fieldFormKey,
  metaByRow,
  teamSpeedBands,
  visibleOthers,
  type TeamSpeedMember,
  type TeamSpeedOther,
  type TeamSpeedBand,
} from "@/lib/stats/teamSpeedTiers";
import { cn } from "@/lib/utils";
import type { Team } from "@/types";

/** What the table needs of a team — a shared team's public copy has it too. */
export type SpeedTiersTeam = Pick<Team, "id" | "name" | "pokemon" | "speedPins">;

interface TeamSpeedTiersProps {
  /** Your teams in the selected regulation. */
  teams: SpeedTiersTeam[];
  defaultTeamId?: string;
  regulationId: string;
  regulationLabel: string;
  speciesKeys: string[];
  megaStoneItemsForSpecies: (speciesKey: string) => string[];
  /** On the team's own page: just that team, no picker. */
  hideTeamPicker?: boolean;
  /**
   * Saves the team's added Pokémon (Team.speedPins). Without it the table is
   * read only (a shared team): no Add a Pokémon, no ×.
   */
  updateTeam?: (id: string, updater: (team: Team) => Team) => void;
}

/**
 * Speed Tiers' "My team" view (docs/team-speed-tiers.md): base Speed bands of
 * 10, fastest first — your Pokémon (badged with their actual Speed) among
 * the others in each band, a divider between base Speeds; the most used shown
 * ("+N" opens the rest). Pokémon added by hand are saved with the team.
 */
export function TeamSpeedTiers({
  teams,
  defaultTeamId,
  regulationId,
  regulationLabel,
  speciesKeys,
  megaStoneItemsForSpecies,
  hideTeamPicker = false,
  updateTeam,
}: TeamSpeedTiersProps) {
  const t = useMessages();
  const text = usePokemonText();
  const [pickedTeamId, setPickedTeamId] = useState<string | null>(null);
  // Rows opened with "+N", by key (reset with the team).
  const [expanded, setExpanded] = useState<{ teamId: string; keys: string[] } | null>(null);
  const { meta } = useMeta(regulationId);

  const team =
    teams.find((candidate) => candidate.id === pickedTeamId) ??
    teams.find((candidate) => candidate.id === defaultTeamId) ??
    teams[0];
  const rows = computeSpeedTierRows(speciesKeys, megaStoneItemsForSpecies);

  if (!team) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
        {t.speedTiers.noTeams(regulationLabel)}
      </div>
    );
  }

  const metaPokemon = meta?.official.pokemon ?? [];
  const hasMeta = metaPokemon.length > 0;
  const pinned = team.speedPins ?? [];
  const readOnly = !updateTeam;
  const bands = teamSpeedBands({
    team: team.pokemon,
    rows,
    meta: metaByRow(rows, metaPokemon),
    pinned,
  });
  const openKeys = expanded?.teamId === team.id ? expanded.keys : [];

  function bandKey(band: TeamSpeedBand): string {
    return `band-${band.top}`;
  }

  /** What a band shows: everything once opened, otherwise the most used (visibleOthers). */
  function shownOthers(band: TeamSpeedBand): TeamSpeedOther[] {
    return openKeys.includes(bandKey(band)) ? band.others : visibleOthers(band.others, hasMeta);
  }

  // A band with none of yours and nothing to show (only unseen Pokémon) is left out.
  const shownBands = bands.filter(
    (band) => band.members.length > 0 || shownOthers(band).length > 0,
  );
  const shownIds = new Set(shownBands.flatMap((band) => shownOthers(band).map((o) => o.row.id)));

  function rowName(row: SpeedTierRow): string {
    if (!row.item) return text.species(row.speciesName);
    const suffix = row.name.match(/ (X|Y)$/)?.[1];
    return `Mega ${text.species(row.speciesName)}${suffix ? ` ${suffix}` : ""}`;
  }

  function setPins(next: string[]) {
    updateTeam?.(team.id, (current) => ({ ...current, speedPins: next }));
  }

  // Add a Pokémon: any not already showing — it then always shows in its row.
  const addOptions = rows
    .filter((row) => !shownIds.has(row.id) && !pinned.includes(row.id))
    .map((row) => ({
      id: row.id,
      label: rowName(row),
      searchText: row.name,
      sprite: row.item ? undefined : row.speciesName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  /** A member's name as it's on the field: "Mega Gardevoir" when it holds its stone. */
  function memberName(member: TeamSpeedMember): string {
    const { species, item } = member.pokemon;
    const form = fieldFormKey(species, item);
    if (!item || !form.includes("-mega") || /mega/i.test(species)) return text.species(species);
    const suffix = form.match(/-mega-(x|y)$/)?.[1]?.toUpperCase();
    return `Mega ${text.species(species)}${suffix ? ` ${suffix}` : ""}`;
  }

  function renderMember(member: TeamSpeedMember) {
    return (
      <Tooltip key={`member-${member.index}`}>
        <TooltipTrigger
          render={
            <span className="relative h-14 w-14 shrink-0 rounded-lg bg-amber-100 ring-2 ring-amber-500 dark:bg-amber-950" />
          }
        >
          <PokemonSprite species={member.pokemon.species} item={member.pokemon.item} fill />
          {member.speed !== null && (
            <span className="absolute -right-1.5 -bottom-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] leading-4 font-semibold text-white">
              {member.speed}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <span className="block font-medium">{memberName(member)}</span>
          <span className="block">
            {t.speedTiers.baseSpeedValue(member.baseSpe)}
            {member.speed !== null && ` · ${t.speedTiers.yourSpeed(member.speed)}`}
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }

  function renderOther(other: TeamSpeedOther) {
    const name = rowName(other.row);
    return (
      <Tooltip key={other.row.id}>
        <TooltipTrigger
          render={
            <span
              className={cn(
                "group relative h-14 w-14 shrink-0 rounded-lg",
                other.pinned && "border border-dashed border-zinc-400",
              )}
            />
          }
        >
          <PokemonSprite species={other.row.speciesName} item={other.row.item} fill />
          {other.pinned && !readOnly && (
            <button
              type="button"
              onClick={() => setPins(pinned.filter((id) => id !== other.row.id))}
              aria-label={t.speedTiers.unpin(name)}
              className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-600 text-white group-hover:flex focus:flex"
            >
              <Icon name={IconName.Close} size={12} />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <span className="block font-medium">
            {name}
            {other.pinned && ` · ${t.speedTiers.pinnedHint}`}
          </span>
          <span className="block">
            {t.speedTiers.baseSpeedValue(other.row.baseSpe)} ·{" "}
            {t.speedTiers.speedRange(other.row.minSpeed, other.row.maxSpeed)}
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }

  /**
   * A band's Pokémon, fastest first — yours first among those sharing their
   * base Speed, set apart by dividers.
   */
  function renderBand(band: TeamSpeedBand) {
    const shown = shownOthers(band);
    const hidden = band.others.length - shown.length;
    const speeds = [
      ...new Set([...band.members.map((m) => m.baseSpe), ...shown.map((o) => o.baseSpe)]),
    ].sort((a, b) => b - a);
    const hasMember = (speed: number) => band.members.some((m) => m.baseSpe === speed);
    return (
      <>
        {speeds.map((speed, index) => (
          <Fragment key={speed}>
            {/* Dividers only around your Pokémon's base Speed (and those tying it). */}
            {index > 0 && (hasMember(speed) || hasMember(speeds[index - 1])) && (
              <span aria-hidden="true" className="mx-1.5 h-10 w-px bg-zinc-300" />
            )}
            {band.members.filter((m) => m.baseSpe === speed).map(renderMember)}
            {shown.filter((o) => o.baseSpe === speed).map(renderOther)}
          </Fragment>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded({ teamId: team.id, keys: [...openKeys, bandKey(band)] })}
            title={t.speedTiers.showMoreHint}
            className="flex h-8 shrink-0 items-center rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
          >
            +{hidden}
          </button>
        )}
        {/* Opened, and there was more than the cap: fold it back. */}
        {openKeys.includes(bandKey(band)) &&
          visibleOthers(band.others, hasMeta).length < band.others.length && (
            <button
              type="button"
              onClick={() =>
                setExpanded({
                  teamId: team.id,
                  keys: openKeys.filter((key) => key !== bandKey(band)),
                })
              }
              className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
            >
              <Icon name={IconName.ExpandMore} size={14} className="rotate-180" />
              {t.speedTiers.showLess}
            </button>
          )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* What the table is, for someone new to Speed — closed for good with its ✕,
          back with the "?" beside the team picker. */}
      <PageTips
        id="speed-team"
        accent="sky"
        title={t.speedTiers.tipsTitle}
        body={`${t.speedTiers.summary}${hasMeta ? "" : ` ${t.speedTiers.noMeta}`}`}
        // The last tip is about adding Pokémon — not something a shared copy's reader can do.
        tips={readOnly ? t.speedTiers.teamTips.slice(0, -1) : t.speedTiers.teamTips}
      />
      <div className="flex flex-wrap items-center gap-3">
        {!hideTeamPicker && (
          <Select
            value={team.id}
            onChange={setPickedTeamId}
            ariaLabel={t.speedTiers.teamPicker}
            options={teams.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            className="w-full justify-between py-2 text-sm sm:w-auto"
          />
        )}
        {!readOnly && (
          <div className="w-full sm:w-64">
            <SearchableSelect
              // Remounts empty after each pick.
              key={pinned.length}
              options={addOptions}
              placeholder={t.speedTiers.addPokemon}
              ariaLabel={t.speedTiers.addPokemonLabel}
              onSelect={(option) => setPins([...pinned, option.id])}
              variant="search"
            />
          </div>
        )}
        <PageTipsButton id="speed-team" />
      </div>
      {/* A table-like card, fastest first: a row per base Speed band of 10,
          then the Pokémon — yours highlighted, faster on the left, a divider
          between base Speeds. */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
        <div className="flex items-center border-b border-zinc-200 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          <span className="flex w-24 shrink-0 items-center gap-0.5 px-3 py-2">
            <Icon name={IconName.ArrowDownward} size={14} />
            {t.speedTiers.baseSpeed}
          </span>
          <span className="px-3 py-2">{t.speedTiers.pokemon}</span>
          {/* The legend, behind an info icon (click or tap — hover doesn't reach phones). */}
          <Popover.Root>
            <Popover.Trigger
              aria-label={t.speedTiers.legend}
              title={t.speedTiers.legend}
              className="mr-2 ml-auto flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 normal-case hover:bg-zinc-200 hover:text-zinc-900"
            >
              <Icon name={IconName.Info} size={18} />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner side="bottom" align="end" sideOffset={6} className="isolate z-50">
                <Popover.Popup className="flex max-w-xs flex-col gap-2.5 rounded-lg border border-zinc-200 bg-raised p-3 text-xs text-zinc-700 shadow-md">
                  <span className="flex items-center gap-2.5">
                    <span className="relative h-5 w-5 shrink-0 rounded bg-amber-100 ring-2 ring-amber-500 dark:bg-amber-950">
                      <span className="absolute -right-1.5 -bottom-1.5 h-2.5 w-3 rounded-full bg-amber-500" />
                    </span>
                    {t.speedTiers.legendYours}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="mx-2 h-4 w-px shrink-0 bg-zinc-400" />
                    {t.speedTiers.legendTies}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span className="h-5 w-5 shrink-0 rounded border border-dashed border-zinc-400" />
                    {t.speedTiers.legendPinned}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-5 shrink-0 items-center rounded-full bg-zinc-200 px-1.5 text-[10px] font-medium text-zinc-600">
                      +N
                    </span>
                    {t.speedTiers.legendMore}
                  </span>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
        <ol className="flex flex-col">
          {shownBands.map((band) => (
            <li
              key={bandKey(band)}
              aria-label={t.speedTiers.bandLabel(band.top, band.bottom)}
              className="flex items-center border-b border-zinc-100 last:border-b-0"
            >
              <span className="w-24 shrink-0 px-3 py-2.5 font-semibold whitespace-nowrap text-zinc-900">
                {band.top}–{band.bottom}
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-3 py-2.5">
                {renderBand(band)}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
