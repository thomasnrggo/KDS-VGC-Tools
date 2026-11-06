"use client";

import { useState } from "react";
import { REGULATIONS } from "@/data/regulations";
import { IconName } from "@/enums";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { useLibraryFavorites } from "@/hooks/useLibraryFavorites";
import { useTeamLibrary } from "@/hooks/useTeamLibrary";
import { fetchPokepaste } from "@/lib/pokepaste/fetchPokepaste";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { groupTeams } from "@/lib/teamLibrary/groupTeams";
import type { LibraryTeam } from "@/lib/teamLibrary/parseTeamLibrary";
import { vgcPastesSheetUrl } from "@/lib/teamLibrary/sources";
import { createTeam, validateTeamSize } from "@/lib/team";
import { cn } from "@/lib/utils";
import type { Team } from "@/types";
import { Button, IconButton, TogglePill } from "../Button";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import { LoadingState } from "../LoadingState";
import { PokemonSprite } from "../PokemonSprite";
import { SearchField } from "../SearchField";
import { RegulationSelect } from "../Select";
import { toast } from "../Toast";

/** Teams shown at first, and added by each "Show more". */
const PAGE = 30;

// The row's columns on wide screens — shared by the titles and each row.
const OWNER_COLUMN = "shrink-0 md:w-32";
const RESULTS_COLUMN = "shrink-0 md:w-36";
const EVS_COLUMN = "shrink-0 md:w-24";
const PASTE_COLUMN = "shrink-0 md:w-24";
const LINKS_COLUMN = "shrink-0 md:w-48";
const ACTIONS_COLUMN = "shrink-0 md:w-14 md:justify-end";

type PokemonText = ReturnType<typeof usePokemonText>;
type Messages = ReturnType<typeof useMessages>;

type EvsSource = "owner" | "extracted" | "none";

/** Whose Stat Points a team's paste has: the owner's own, extracted by VGCPastes, or none at all. */
function evsSource(team: LibraryTeam): EvsSource {
  if (!team.hasStatPoints) return "none";
  return team.pasteSource ?? "extracted";
}

const EVS_LABELS: Record<
  EvsSource,
  { label: (t: Messages) => string; hint: (t: Messages) => string; className: string }
> = {
  owner: {
    label: (t) => t.teamLibrary.evsOwner,
    hint: (t) => t.teamLibrary.evsOwnerHint,
    className: "bg-green-100 text-green-800",
  },
  extracted: {
    label: (t) => t.teamLibrary.evsExtracted,
    hint: (t) => t.teamLibrary.evsExtractedHint,
    className: "bg-sky-100 text-sky-800",
  },
  none: {
    label: (t) => t.teamLibrary.evsNone,
    hint: (t) => t.teamLibrary.evsNoneHint,
    className: "bg-zinc-100 text-zinc-500",
  },
};

/** Everything a team can be found by, folded: its Pokémon and items (English and translated), creator, sharer, event, placing and ids. */
function searchText(team: LibraryTeam, text: PokemonText): string {
  return foldForSearch(
    [
      team.id,
      team.description,
      team.creator,
      team.owner,
      team.event,
      team.rank,
      team.replicaCode,
      ...team.pokemon,
      ...team.pokemon.map((species) => text.species(species)),
      ...team.items,
      ...team.items.filter(Boolean).map((item) => text.item(item)),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** "2026-11-02" in the app's language, e.g. "2 Nov 2026". */
function formatDate(date: string, language: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The Team Library: the VGCPastes Repository's shared teams for a
 * regulation, searchable by Pokémon, item, creator or event — every word
 * has to match ("incineroar sitrus"). Shown as the sheet has them: each
 * links to its Pokepaste, source and rental code. Credit goes to VGCPastes
 * and each team's creator. See src/lib/teamLibrary. A team can be starred
 * (see useLibraryFavorites) or added to My Teams from its Pokepaste.
 */
export function TeamLibrarySection({
  myTeams,
  onAddTeam,
}: {
  /** All of the user's teams, archived too — to spot one already added. */
  myTeams: Team[];
  /** Saves a new team (useMyTeams' addBuiltTeam). */
  onAddTeam: (team: Team) => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const { appLanguage } = useLanguageSettings();
  const [regulationId, setRegulationId] = useState(REGULATIONS[0].id);
  const { library, isLoading, failed } = useTeamLibrary(regulationId);
  const [query, setQuery] = useState("");
  const [withStatPoints, setWithStatPoints] = useState(false);
  const [withOwnersEvs, setWithOwnersEvs] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { favorites, isFavorite, toggle: toggleFavorite } = useLibraryFavorites();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const teams = library?.teams ?? [];
  const words = foldForSearch(query.trim()).split(/\s+/).filter(Boolean);
  const matching = teams.filter((team) => {
    if (withStatPoints && !team.hasStatPoints) return false;
    if (withOwnersEvs && evsSource(team) !== "owner") return false;
    if (onlyFavorites && !isFavorite(team.id)) return false;
    if (words.length === 0) return true;
    const haystack = searchText(team, text);
    return words.every((word) => haystack.includes(word));
  });
  // The same Pokémon and items: the newest shown, the rest folded under it.
  const groups = groupTeams(matching);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // Phones show each team as just its roster and star; a tap opens the rest.
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  function toggleOpen(id: string) {
    const next = new Set(openIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  }
  function toggleGroup(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  }

  /** Whether a word of the search names this Pokémon or its item — its sprite is ringed. */
  const highlights = (species: string, item: string) => {
    if (words.length === 0) return false;
    const names = foldForSearch(
      [species, text.species(species), item, item && text.item(item)].join(" "),
    );
    return words.some((word) => names.includes(word));
  };

  // A new search or filter starts from the first page again.
  const filterKey = `${regulationId}|${query}|${withStatPoints}|${withOwnersEvs}|${onlyFavorites}`;
  const [shownFor, setShownFor] = useState(filterKey);
  if (shownFor !== filterKey) {
    setShownFor(filterKey);
    setShown(PAGE);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t.teamLibrary.codeCopied);
    } catch (error) {
      console.error("[team-library] copy failed:", error);
    }
  }

  /** Whose Stat Points the paste has, as a badge. */
  function evsBadge(team: LibraryTeam) {
    const evs = EVS_LABELS[evsSource(team)];
    return (
      <span
        title={evs.hint(t)}
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          evs.className,
        )}
      >
        {evs.label(t)}
      </span>
    );
  }

  /** The row's star and "Add to my teams" buttons — on a closed phone row, just the star. */
  function actions(team: LibraryTeam, buttonClass = "h-7 w-7", withAdd = true) {
    return (
      <>
        <IconButton
          variant="ghost"
          className={buttonClass}
          onClick={() => toggleFavorite(team.id)}
          aria-pressed={isFavorite(team.id)}
          aria-label={
            isFavorite(team.id) ? t.teamLibrary.removeFavorite : t.teamLibrary.addFavorite
          }
          title={isFavorite(team.id) ? t.teamLibrary.removeFavorite : t.teamLibrary.addFavorite}
        >
          <Icon
            name={isFavorite(team.id) ? IconName.StarFilled : IconName.Star}
            size={18}
            className={cn(isFavorite(team.id) && "text-amber-500")}
          />
        </IconButton>
        {withAdd && team.pokepaste && (
          <IconButton
            variant="ghost"
            className={buttonClass}
            onClick={() => addToMyTeams(team)}
            disabled={addingId !== null}
            aria-label={addingId === team.id ? t.teamLibrary.adding : t.teamLibrary.addToMyTeams}
            title={addingId === team.id ? t.teamLibrary.adding : t.teamLibrary.addToMyTeams}
          >
            <Icon
              name={IconName.Add}
              size={18}
              className={cn(addingId === team.id && "animate-pulse")}
            />
          </IconButton>
        )}
      </>
    );
  }

  /** Saves the team's Pokepaste as a new team of mine, credited and linked back — once. */
  async function addToMyTeams(team: LibraryTeam) {
    if (!team.pokepaste || addingId) return;
    const existing = myTeams.find((mine) => mine.pokepasteUrl === team.pokepaste);
    if (existing) {
      toast.info(t.teamLibrary.alreadyAdded(existing.name));
      return;
    }
    setAddingId(team.id);
    try {
      const { paste } = await fetchPokepaste(team.pokepaste);
      const name = team.description || team.id;
      const created: Team = {
        ...createTeam(paste.trim(), name, regulationId),
        pokepasteUrl: team.pokepaste,
        ...(team.creator && { creator: team.creator }),
        ...(team.replicaCode && { replicaCode: team.replicaCode }),
      };
      const sizeError = validateTeamSize(created.pokemon);
      if (sizeError) throw new Error(sizeError);
      onAddTeam(created);
      toast.success(t.teamLibrary.added(name));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {/* The title and regulation, with the intro and credit beside them on the right. */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">{t.teamLibrary.title}</h1>
          <RegulationSelect value={regulationId} onChange={setRegulationId} />
        </div>
        <div className="flex flex-col gap-0.5 md:text-right">
          <p className="text-sm text-zinc-600">{t.teamLibrary.intro}</p>
          <p className="text-xs text-zinc-500">
            {t.teamLibrary.credit}{" "}
            <a
              href={vgcPastesSheetUrl(regulationId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-700 underline hover:text-zinc-900"
            >
              {t.teamLibrary.creditSheet}
            </a>{" "}
            {t.teamLibrary.creditRest}
            {library?.updatedAt &&
              ` · ${t.teamLibrary.updated(formatDate(library.updatedAt.slice(0, 10), appLanguage))}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          query={query}
          onQueryChange={setQuery}
          placeholder={t.teamLibrary.searchPlaceholder}
          ariaLabel={t.teamLibrary.searchLabel}
          className="w-full sm:w-96"
        />
        <TogglePill active={withStatPoints} onClick={() => setWithStatPoints(!withStatPoints)}>
          {t.teamLibrary.withStatPoints}
        </TogglePill>
        <TogglePill active={withOwnersEvs} onClick={() => setWithOwnersEvs(!withOwnersEvs)}>
          {t.teamLibrary.withOwnersEvs}
        </TogglePill>
        <TogglePill active={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}>
          <span className="flex items-center gap-1">
            <Icon name={IconName.StarFilled} size={14} className="text-amber-500" />
            {t.teamLibrary.favorites(favorites.length)}
          </span>
        </TogglePill>
        {library && teams.length > 0 && (
          <span className="text-xs text-zinc-500 tabular-nums sm:ml-auto">
            {t.teamLibrary.count(matching.length, teams.length)}
          </span>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : failed ? (
        <p className="text-sm text-zinc-500">{t.teamLibrary.unavailable}</p>
      ) : teams.length === 0 ? (
        <p className="text-sm text-zinc-500">{t.teamLibrary.noTab}</p>
      ) : matching.length === 0 ? (
        <p className="text-sm text-zinc-500">{t.teamLibrary.empty}</p>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-raised">
            {/* Column titles, where the rows are columns. */}
            <div
              aria-hidden
              className="hidden gap-4 px-3 py-2 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase md:flex"
            >
              <span className="min-w-0 flex-1">{t.teamLibrary.columns.team}</span>
              <span className={OWNER_COLUMN}>{t.teamLibrary.columns.owner}</span>
              <span className={RESULTS_COLUMN}>{t.teamLibrary.columns.results}</span>
              <span className={EVS_COLUMN}>{t.teamLibrary.columns.evs}</span>
              <span className={PASTE_COLUMN}>{t.teamLibrary.columns.paste}</span>
              <span className={LINKS_COLUMN}>{t.teamLibrary.columns.links}</span>
              <span className={ACTIONS_COLUMN} />
            </div>
            <ul className="flex flex-col divide-y divide-zinc-200">
              {groups.slice(0, shown).flatMap((group) =>
                (expanded.has(group.key) ? group.teams : group.teams.slice(0, 1)).map(
                  (team, index) => (
                    <li
                      key={team.id}
                      className={cn(
                        "relative flex flex-col gap-1.5 px-3 py-2.5 max-md:pr-12 md:flex-row md:items-center md:gap-4 md:py-3",
                        index > 0 && "border-l-4 border-l-zinc-300 bg-zinc-50 pl-2",
                      )}
                    >
                      {/* Phones: the whole row opens and closes the details. */}
                      <button
                        type="button"
                        onClick={() => toggleOpen(team.id)}
                        aria-expanded={openIds.has(team.id)}
                        aria-label={`${team.description || team.id}: ${
                          openIds.has(team.id)
                            ? t.pokemonCard.hideDetails
                            : t.pokemonCard.showDetails
                        }`}
                        className="absolute inset-0 z-0 active:bg-zinc-100/60 md:hidden"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5 max-md:pointer-events-none lg:flex-row lg:items-center lg:gap-4">
                        <span
                          className="flex shrink-0 gap-0.5"
                          title={team.pokemon.map((species) => text.species(species)).join(" / ")}
                        >
                          {team.pokemon.map((species, index) => {
                            const item = team.items[index] ?? "";
                            return (
                              <span
                                key={index}
                                className={cn(
                                  "relative h-11 w-11 shrink-0 rounded-full sm:h-14 sm:w-14",
                                  highlights(species, item) && "bg-zinc-200 ring-2 ring-chrome-600",
                                )}
                              >
                                <PokemonSprite species={species} fill />
                                {item && (
                                  <span
                                    className="absolute -right-0.5 -bottom-0.5"
                                    title={text.item(item)}
                                  >
                                    <ItemIcon item={item} size={18} />
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </span>

                        <div
                          className={cn(
                            "flex min-w-0 flex-1 flex-col",
                            !openIds.has(team.id) && "max-md:hidden",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-1">
                            <span
                              className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900"
                              title={team.description}
                            >
                              {team.description || team.id}
                            </span>
                          </div>
                          {team.date && (
                            <span className="truncate text-xs text-zinc-500 max-md:hidden">
                              {formatDate(team.date, appLanguage)}
                            </span>
                          )}
                          {/* Phones: owner · placing · event and the EVs, on one line. */}
                          <span className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500 md:hidden">
                            <span className="min-w-0 truncate">
                              {[team.owner || team.creator, team.rank, team.event]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {evsBadge(team)}
                          </span>
                          {index === 0 && group.teams.length > 1 && (
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.key)}
                              aria-expanded={expanded.has(group.key)}
                              className="pointer-events-auto relative z-10 mt-0.5 flex w-fit items-center gap-0.5 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                            >
                              <Icon
                                name={
                                  expanded.has(group.key)
                                    ? IconName.ExpandLess
                                    : IconName.ExpandMore
                                }
                                size={16}
                              />
                              {expanded.has(group.key)
                                ? t.teamLibrary.hideSameTeams
                                : t.teamLibrary.sameTeams(group.teams.length - 1)}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Owner — its own column on wide screens, a labelled line on phones. */}
                      {/* The creator's name under the handle, when the sheet gives one. */}
                      <div
                        className={cn(OWNER_COLUMN, "flex min-w-0 flex-col text-xs max-md:hidden")}
                      >
                        {(team.owner || team.creator) && (
                          <span className="flex min-w-0 gap-1">
                            <span className="text-zinc-500 md:hidden">{t.teamLibrary.owner}:</span>
                            <span
                              className="truncate font-medium text-zinc-800"
                              title={team.owner || team.creator}
                            >
                              {team.owner || team.creator}
                            </span>
                          </span>
                        )}
                        {team.owner && team.creator && team.creator !== team.owner && (
                          <span
                            className="truncate text-zinc-500 max-md:hidden"
                            title={team.creator}
                          >
                            {team.creator}
                          </span>
                        )}
                      </div>

                      {/* Results — the placing, and the event under it. */}
                      <div
                        className={cn(
                          RESULTS_COLUMN,
                          "flex min-w-0 flex-col text-xs max-md:hidden",
                        )}
                      >
                        {team.rank && (
                          <span className="truncate font-medium text-zinc-800">
                            <span className="font-normal text-zinc-500 md:hidden">
                              {t.teamLibrary.columns.results}:{" "}
                            </span>
                            {team.rank}
                          </span>
                        )}
                        {team.event && (
                          <span className="truncate text-zinc-500" title={team.event}>
                            {team.event}
                          </span>
                        )}
                      </div>

                      {/* EVs — whose Stat Points the paste has: the owner's, VGCPastes', or none. */}
                      <div className={cn(EVS_COLUMN, "flex items-center max-md:hidden")}>
                        {evsBadge(team)}
                      </div>

                      <div className={cn(PASTE_COLUMN, "max-md:hidden")}>
                        {team.pokepaste && (
                          <a
                            href={team.pokepaste}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-fit items-center gap-0.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
                          >
                            {t.teamLibrary.pokepaste}
                            <Icon name={IconName.OpenInNew} size={12} />
                          </a>
                        )}
                      </div>

                      <div
                        className={cn(
                          LINKS_COLUMN,
                          "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium max-md:relative max-md:z-10 max-md:w-fit",
                          !openIds.has(team.id) && "max-md:hidden",
                        )}
                      >
                        {team.replicaCode && (
                          <button
                            type="button"
                            onClick={() => copyCode(team.replicaCode!)}
                            aria-label={t.teamLibrary.copyCode(team.replicaCode)}
                            title={t.teamLibrary.copyCode(team.replicaCode)}
                            className="flex items-center gap-1 rounded-md border border-zinc-200 px-1.5 py-0.5 font-mono text-zinc-800 hover:bg-zinc-100"
                          >
                            {team.replicaCode}
                            <Icon name={IconName.ContentCopy} size={12} />
                          </button>
                        )}
                        {[
                          { href: team.pokepaste, label: t.teamLibrary.pokepaste, phoneOnly: true },
                          { href: team.source, label: t.teamLibrary.source },
                          { href: team.report, label: t.teamLibrary.report },
                        ].map(
                          ({ href, label, phoneOnly }) =>
                            href && (
                              <a
                                key={label}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-0.5 text-zinc-700 hover:text-zinc-900 hover:underline",
                                  phoneOnly && "md:hidden",
                                )}
                              >
                                {label}
                                <Icon name={IconName.OpenInNew} size={12} />
                              </a>
                            ),
                        )}
                      </div>

                      <div className={cn(ACTIONS_COLUMN, "flex items-center gap-1 max-md:hidden")}>
                        {actions(team)}
                      </div>
                      {/* Phones: stacked down the row's right edge, as in My Teams. */}
                      <div className="absolute inset-y-0 right-1.5 z-10 flex flex-col justify-center gap-0.5 md:hidden">
                        {actions(team, "h-10 w-10 text-zinc-500", openIds.has(team.id))}
                      </div>
                    </li>
                  ),
                ),
              )}
            </ul>
          </div>
          {groups.length > shown && (
            <Button
              variant="outline"
              onClick={() => setShown(shown + PAGE)}
              className="self-center"
            >
              {t.teamLibrary.showMore}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
