"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMeta } from "@/hooks/useMeta";
import { useMetaSpreads } from "@/hooks/useMetaSpreads";
import { useCalcSets } from "@/hooks/useCalcSets";
import { AuthMenu } from "@/components/AuthMenu";
import { Button, TextAction, TogglePill } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ItemIcon } from "@/components/ItemIcon";
import { PokemonEditor } from "@/components/PokemonEditor";
import { PokemonSprite } from "@/components/PokemonSprite";
import { RegulationSelect } from "@/components/Select";
import { toast } from "@/components/Toast";
import { IconName } from "@/enums";
import { REGULATIONS } from "@/data/regulations";
import type { MetaPokemon } from "@/lib/meta/aggregateMeta";
import {
  findMetaSpread,
  metaSpreadKey,
  withMetaSpread,
  type MetaSpreads,
} from "@/lib/meta/metaSpreads";
import { foldForSearch } from "@/lib/pokemonMatchesQuery";
import { findSameNameSet } from "@/lib/calcSets";
import { hasStatPoints } from "@/lib/hasStatPoints";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { applyStatOverrides, type StatOverrides } from "@/lib/stats/applyStatOverrides";
import { MAX_TOTAL_STAT_POINTS } from "@/lib/stats/calculateFinalStats";
import { META_THREAT_LIMIT, metaBaseSet, metaSetItems } from "@/lib/threats/metaSets";
import type { ParsedPokemon } from "@/types";
import { cn } from "@/lib/utils";

const NO_STAT_OVERRIDES: StatOverrides = {};

const percent = (share: number) => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;

/** How many of a Pokémon's sets have their own spread or share its "All sets" one. */
function spreadCount(spreads: MetaSpreads, entry: MetaPokemon): number {
  return [
    entry.species,
    ...metaSetItems(entry).map((item) => metaSpreadKey(entry.species, item.name)),
  ].filter((key) => spreads[key]).length;
}

/**
 * Sets the common spreads of the metagame's sets: open team sheets list the
 * nature but never Stat Points, so the Threats analysis estimates them from
 * the nature and item — here the admin replaces an estimate with the spread
 * players actually run (Garchomp: Adamant, 32 Atk / 32 Spe). A spread is for
 * all of a Pokémon's sets, or one item's set (which wins over it); saved per
 * regulation to appConfig/metaSpreads_{regulationId} (see
 * src/lib/meta/metaSpreads.ts). Admin-only, so English-only like the other
 * admin pages.
 */
export default function AdminMetaSetsPage() {
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [regulationId, setRegulationId] = useState(REGULATIONS[0].id);
  const { meta, isLoading: metaLoading } = useMeta(regulationId);
  const { spreads, isLoading: spreadsLoading, save } = useMetaSpreads(regulationId);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  /** The set being edited: undefined is "All sets". */
  const [target, setTarget] = useState<string | undefined>(undefined);
  /** Unsaved edits, for the Pokémon and target they were made on — and the calc set they came from, if one was picked. */
  const [draft, setDraft] = useState<{
    key: string;
    pokemon: ParsedPokemon;
    publicSetId?: string;
  } | null>(null);
  /** Share a new spread as a Damage Calculator set, under this name (empty: the item's). */
  const [share, setShare] = useState(true);
  const [shareName, setShareName] = useState("");
  const { publicSets, saveSet } = useCalcSets();
  const [isSaving, setIsSaving] = useState(false);

  if (isAuthLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-zinc-700">Sign in to continue.</p>
        <Button onClick={signInWithGoogle}>Sign in with Google</Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-zinc-900">Not authorized</p>
        <p className="text-sm text-zinc-600">This page is only available to the site admin.</p>
        <Link href="/matchup-planner" className="text-sm font-medium text-zinc-600 hover:underline">
          ← Back to Matchup Planner
        </Link>
      </div>
    );
  }

  // The metagame as the analysis sees it: the recent events, the Pokémon it calcs against.
  const metaPokemon = meta
    ? (meta.official.recent?.pokemon ?? meta.official.pokemon).slice(0, META_THREAT_LIMIT)
    : [];
  const folded = foldForSearch(query.trim());
  const listed = metaPokemon.filter(
    (entry) => !folded || foldForSearch(entry.species).includes(folded),
  );
  const setCount = Object.keys(spreads).length;

  const entry = metaPokemon.find((candidate) => candidate.species === selected);
  const items = entry ? metaSetItems(entry) : [];
  // "All sets" edits on the most common item's set.
  const baseItem = target ?? items[0]?.name ?? entry?.items[0]?.name;
  const key = entry ? metaSpreadKey(entry.species, target) : "";
  const own = spreads[key];
  // What the set uses now: its own spread, else the Pokémon's (for an item's set), else the estimate.
  const inherited =
    entry && target && !own ? findMetaSpread(spreads, entry.species, target) : undefined;
  const current = entry
    ? withMetaSpread(metaBaseSet(entry, baseItem), entry.species, spreads)
    : null;
  const draftKey = `${regulationId}:${key}`;
  const ownDraft = draft?.key === draftKey ? draft : null;
  const editing = ownDraft?.pokemon ?? current?.pokemon;
  // The Damage Calculator's public sets of this species — a Mega's under its base species.
  const calcSets = editing
    ? publicSets.filter(
        (set) => normalizeSpeciesKey(set.pokemon.species) === normalizeSpeciesKey(editing.species),
      )
    : [];
  // The calc set this spread is shared as: the one just picked, else the saved one (if it still exists).
  const linkedId = ownDraft?.publicSetId ?? own?.publicSetId;
  const linked = calcSets.find((set) => set.id === linkedId);
  const defaultShareName = baseItem ?? "Meta";
  const sharedName = shareName.trim() || defaultShareName;
  const replaces =
    editing && !linked ? findSameNameSet(publicSets, editing, sharedName) : undefined;
  const isDirty =
    !!editing &&
    !!current &&
    (editing.nature !== current.pokemon.nature ||
      editing.evs !== current.pokemon.evs ||
      (!!ownDraft?.publicSetId && ownDraft.publicSetId !== own?.publicSetId));

  function pick(species: string) {
    setSelected(species);
    setTarget(undefined);
    setDraft(null);
    setShareName("");
  }

  function chooseTarget(item: string | undefined) {
    setTarget(item);
    setShareName("");
  }

  function changeRegulation(id: string) {
    setRegulationId(id);
    setSelected(null);
    setTarget(undefined);
    setDraft(null);
    setShareName("");
  }

  async function saveSpread() {
    if (!entry || !editing?.nature || !editing.evs) return;
    const { nature, evs } = editing;
    setIsSaving(true);
    try {
      // The calc set first, so the spread can point at it: the linked one
      // keeps its own moves and item and takes the spread; a new one is the
      // whole meta set.
      const shared = linked
        ? await saveSet("public", { ...linked.pokemon, nature, evs }, linked.name)
        : share
          ? await saveSet("public", editing, sharedName)
          : undefined;
      await save(key, {
        nature,
        evs,
        updatedAt: new Date().toISOString(),
        ...(shared && { publicSetId: shared.id }),
      });
      setDraft(null);
      setShareName("");
      toast.success(
        `Saved ${entry.species}${target ? ` @ ${target}` : ""}${shared ? ` and its calc set "${shared.name}"` : ""}`,
      );
    } catch (error) {
      console.error("[admin/meta-sets] save failed:", error);
      toast.error("Couldn't save that change.");
    } finally {
      setIsSaving(false);
    }
  }

  async function reset() {
    if (!entry) return;
    setIsSaving(true);
    try {
      await save(key, null);
      setDraft(null);
      toast.success(`${entry.species}${target ? ` @ ${target}` : ""} is back to the estimate`);
    } catch (error) {
      console.error("[admin/meta-sets] reset failed:", error);
      toast.error("Couldn't save that change.");
    } finally {
      setIsSaving(false);
    }
  }

  const status = own
    ? `Your spread · saved ${new Date(own.updatedAt).toLocaleDateString()}`
    : inherited
      ? "Uses this Pokémon's All sets spread"
      : "Estimated from its nature and item";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-chrome-600 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/matchup-planner"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            ← Matchup Planner
          </Link>
          <h1 className="text-lg font-semibold text-white">Admin: Meta sets</h1>
          <Link
            href="/admin/features"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            Features →
          </Link>
        </div>
        <AuthMenu
          user={user}
          isLoading={isAuthLoading}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
        />
      </header>

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <RegulationSelect value={regulationId} onChange={changeRegulation} />
          <p className="max-w-3xl text-sm text-zinc-600">
            Team sheets list the nature but never Stat Points, so the team analysis estimates each
            meta set&apos;s spread from its nature and item. Set the spread players actually run —
            for all of a Pokémon&apos;s sets, or one item&apos;s set (which wins). It applies to
            everyone right away.
          </p>
        </div>

        {(metaLoading && !meta) || spreadsLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : metaPokemon.length === 0 ? (
          <p className="text-sm text-zinc-500">No metagame data for this regulation yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
            {/* The meta's Pokémon, most used first. */}
            <section className="flex min-w-0 flex-col gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Pokémon…"
                aria-label="Search Pokémon"
                className="w-full rounded-md border border-zinc-300 bg-field px-2.5 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">
                The {metaPokemon.length} most used, as the analysis calcs them · {setCount}{" "}
                {setCount === 1 ? "spread" : "spreads"} set
              </p>
              <ul className="flex max-h-[70vh] flex-col overflow-y-auto rounded-lg border border-zinc-200 p-1">
                {listed.map((candidate) => {
                  const count = spreadCount(spreads, candidate);
                  return (
                    <li key={candidate.species}>
                      <button
                        type="button"
                        onClick={() => pick(candidate.species)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-zinc-900 hover:bg-zinc-100",
                          selected === candidate.species && "bg-zinc-200",
                        )}
                      >
                        <span className="w-5 shrink-0 text-right text-[11px] text-zinc-500 tabular-nums">
                          {metaPokemon.indexOf(candidate) + 1}
                        </span>
                        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded">
                          <PokemonSprite species={candidate.species} fill />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{candidate.species}</span>
                        {count > 0 && (
                          <span className="shrink-0 rounded-full bg-green-100 px-1.5 text-[10px] font-semibold text-green-800">
                            {count} set
                          </span>
                        )}
                        <span className="w-10 shrink-0 text-right text-[11px] text-zinc-500 tabular-nums">
                          {percent(candidate.usage)}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {listed.length === 0 && (
                  <li className="p-2 text-xs text-zinc-500">No Pokémon match.</li>
                )}
              </ul>
            </section>

            {/* Its spread. */}
            {entry && current && editing ? (
              <section className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-500/20">
                    <PokemonSprite species={entry.species} fill />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <h2 className="text-lg font-semibold text-zinc-900">{entry.species}</h2>
                    <p className="text-xs text-zinc-500">
                      {percent(entry.usage)} of teams · {entry.teams} teams
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Applies to
                  </h3>
                  <div role="group" aria-label="Applies to" className="flex flex-wrap gap-1.5">
                    {[undefined, ...items.map((item) => item.name)].map((item) => {
                      const share = items.find((candidate) => candidate.name === item)?.share;
                      const hasOwn = !!spreads[metaSpreadKey(entry.species, item)];
                      return (
                        <TogglePill
                          key={item ?? "all"}
                          active={target === item}
                          onClick={() => chooseTarget(item)}
                          className="flex items-center gap-1.5"
                        >
                          {item && <ItemIcon item={item} size={16} />}
                          {item ? `${item} · ${percent(share ?? 0)}` : "All sets"}
                          {hasOwn && (
                            <span
                              aria-label="has its own spread"
                              className="h-1.5 w-1.5 rounded-full bg-green-600"
                            />
                          )}
                        </TogglePill>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 text-sm">
                  <p className="text-zinc-900">
                    <span className="font-semibold">{editing.item ?? "No item"}</span>
                    {editing.ability && ` · ${editing.ability}`}
                  </p>
                  <p className="text-zinc-600">{(editing.moves ?? []).join(" · ")}</p>
                  <p className="text-xs text-zinc-500">
                    Team sheets:{" "}
                    {entry.natures
                      .slice(0, 4)
                      .map((nature) => `${nature.name} ${percent(nature.share)}`)
                      .join(", ")}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Damage Calculator sets
                  </h3>
                  {calcSets.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      None for {editing.species} yet — saving can share this one.
                    </p>
                  ) : (
                    <ul className="flex flex-col rounded-lg border border-zinc-200 p-1">
                      {calcSets.map((set) => {
                        const isLinked = set.id === linked?.id;
                        const usable = hasStatPoints(set.pokemon);
                        return (
                          <li
                            key={set.id}
                            className={cn(
                              "flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-2 py-1 text-sm",
                              isLinked && "bg-zinc-100",
                            )}
                          >
                            {set.pokemon.item && <ItemIcon item={set.pokemon.item} size={18} />}
                            <span className="font-medium text-zinc-900">{set.name}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">
                              {[set.pokemon.nature, set.pokemon.evs || "no Stat Points"]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {isLinked ? (
                              <span className="text-xs font-medium text-green-700">In use</span>
                            ) : (
                              <TextAction
                                disabled={isSaving || !usable}
                                title={usable ? undefined : "This set has no Stat Points"}
                                onClick={() =>
                                  setDraft({
                                    key: draftKey,
                                    pokemon: {
                                      ...editing,
                                      nature: set.pokemon.nature ?? editing.nature,
                                      evs: set.pokemon.evs,
                                    },
                                    publicSetId: set.id,
                                  })
                                }
                              >
                                Use
                              </TextAction>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {linked ? (
                    <p className="text-xs text-zinc-500">
                      Shared as &ldquo;{linked.name}&rdquo; — saving updates its nature and Stat
                      Points too.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={share}
                          onChange={(event) => setShare(event.target.checked)}
                        />
                        Share in the Damage Calculator as
                      </label>
                      <input
                        value={shareName}
                        onChange={(event) => setShareName(event.target.value)}
                        placeholder={defaultShareName}
                        aria-label="Damage Calculator set name"
                        disabled={!share}
                        className="w-44 rounded-md border border-zinc-300 bg-field px-2 py-1 text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none disabled:opacity-50"
                      />
                      {share && replaces && (
                        <span className="text-amber-700">
                          Replaces the existing &ldquo;{replaces.name}&rdquo; set
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <p
                    className={cn("text-xs font-medium", own ? "text-green-700" : "text-zinc-500")}
                  >
                    {status}
                  </p>
                  <div className="ml-auto flex items-center gap-3">
                    {isDirty && (
                      <TextAction onClick={() => setDraft(null)} disabled={isSaving}>
                        Discard
                      </TextAction>
                    )}
                    {own && (
                      <TextAction onClick={reset} disabled={isSaving}>
                        <Icon name={IconName.Close} size={14} />
                        {target ? "Use All sets / estimate" : "Reset to estimate"}
                      </TextAction>
                    )}
                    <Button
                      onClick={saveSpread}
                      disabled={isSaving || (!isDirty && !!own && (!!linked || !share))}
                    >
                      Save spread
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-raised p-3">
                  <PokemonEditor
                    title={entry.species}
                    pokemon={editing}
                    statOverrides={NO_STAT_OVERRIDES}
                    onStatOverridesChange={(overrides) =>
                      setDraft({
                        key: draftKey,
                        pokemon: applyStatOverrides(editing, overrides),
                        publicSetId: ownDraft?.publicSetId,
                      })
                    }
                    maxTotalStatPoints={MAX_TOTAL_STAT_POINTS}
                    regulationId={regulationId}
                    layout="stats"
                  />
                </div>
              </section>
            ) : (
              <p className="text-sm text-zinc-500">
                Pick a Pokémon to see and set its common spread.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
