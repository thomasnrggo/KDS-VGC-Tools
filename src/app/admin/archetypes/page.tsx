"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useArchetypeSamples } from "@/hooks/useArchetypeSamples";
import { useMetaArchetypes } from "@/hooks/useMetaArchetypes";
import { AuthMenu } from "@/components/AuthMenu";
import { Button, TogglePill } from "@/components/Button";
import { RegulationSelect } from "@/components/Select";
import { REGULATIONS } from "@/data/regulations";
import { parseTeam } from "@/lib/parseTeam";
import {
  DEFAULT_ARCHETYPE_SET,
  ancestorsOf,
  archetypeTempo,
  archetypeTotals,
  checkSample,
  conditionRoleIds,
  describeCheck,
  describeCondition,
  validateArchetypeSet,
  type ArchetypeDefinition,
  type ArchetypeFamily,
  type ArchetypeSample,
  type MetaArchetypes,
  type Tempo,
} from "@/lib/archetypes";
import { cn } from "@/lib/utils";
import { ArchetypeSamples, samplePasses } from "./ArchetypeSamples";

const FAMILIES: { id: ArchetypeFamily; name: string }[] = [
  { id: "weather", name: "Weather" },
  { id: "terrain", name: "Terrain" },
  { id: "speedControl", name: "Speed control" },
  { id: "setup", name: "Setup" },
  { id: "stall", name: "Stall" },
  { id: "screens", name: "Screens" },
  { id: "perishTrap", name: "Perish trap" },
];

const TEMPO: Record<Tempo, { name: string; dot: string }> = {
  offense: { name: "Offense", dot: "bg-red-500" },
  positioning: { name: "Positioning", dot: "bg-blue-500" },
  patient: { name: "Patient", dot: "bg-green-600" },
};

const percent = (value: number) => `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;

/**
 * The archetype definitions as they stand (src/lib/archetypes/defaultArchetypes.ts,
 * docs/archetypes.md), read-only: every archetype with what it needs, what
 * it can't have and what boosts it, in plain English, with the regulation's
 * tournament numbers from the metagame job; and every role with its checks
 * and who uses it. The first step towards editing archetypes here. Admin
 * pages are English-only.
 */
export default function AdminArchetypesPage() {
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const { isStaff, isLoading: roleLoading } = useIsAdmin();
  const [regulationId, setRegulationId] = useState(REGULATIONS[0].id);
  const [view, setView] = useState<"archetypes" | "roles">("archetypes");
  const { data, isLoading } = useMetaArchetypes(regulationId);
  const { samples, isLoading: samplesLoading, add, remove } = useArchetypeSamples(isStaff);

  if (isAuthLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-zinc-700">Sign in to continue.</p>
        <Button onClick={signInWithGoogle}>Sign in with Google</Button>
      </div>
    );
  }

  if (roleLoading) return null;

  if (!isStaff) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-zinc-900">Not authorized</p>
        <p className="text-sm text-zinc-600">
          This page is only available to moderators and admins.
        </p>
        <Link href="/matchup-planner" className="text-sm font-medium text-zinc-600 hover:underline">
          ← Back to Matchup Planner
        </Link>
      </div>
    );
  }

  const set = DEFAULT_ARCHETYPE_SET;
  const problems = validateArchetypeSet(set);
  const active = set.archetypes.filter((a) => a.status === "active").length;
  const failing = samples.filter(
    (sample) =>
      !samplePasses(
        checkSample(parseTeam(sample.paste), sample.archetypeId, set, regulationId).status,
      ),
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-chrome-600 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/matchup-planner"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            ← Matchup Planner
          </Link>
          <h1 className="text-lg font-semibold text-white">Admin: Archetypes</h1>
          <Link
            href="/admin/meta-events"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            Meta events →
          </Link>
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
        <div className="flex max-w-3xl flex-col gap-1 text-sm text-zinc-600">
          <p>
            Definitions <span className="font-medium text-zinc-900">v{set.version}</span> · {active}{" "}
            active archetypes
            {set.archetypes.length > active && `, ${set.archetypes.length - active} draft`} ·{" "}
            {set.roles.length} roles. The definitions are read-only for now: they live in{" "}
            <code className="text-xs">src/lib/archetypes/defaultArchetypes.ts</code>; see{" "}
            <code className="text-xs">docs/archetypes.md</code>. After a change, bump{" "}
            <code className="text-xs">version</code> so the metagame job reclassifies every event.
          </p>
          <p>
            Sample teams are optional: teams you know belong to an archetype, checked live against
            the definitions (✓ main archetype or a variant of it, ≈ only as a tag, ✗ no match).
            {!samplesLoading &&
              (samples.length === 0
                ? " None added yet."
                : failing.length === 0
                  ? ` All ${samples.length} pass.`
                  : ` ${failing.length} of ${samples.length} don't pass.`)}
          </p>
          {problems.length === 0 ? (
            <p className="text-green-700 dark:text-green-400">The definitions are valid.</p>
          ) : (
            <ul className="list-disc pl-5 text-red-700 dark:text-red-400">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RegulationSelect value={regulationId} onChange={setRegulationId} />
          <DataStatus data={data} isLoading={isLoading} version={set.version} />
        </div>

        <div className="flex gap-1.5">
          <TogglePill active={view === "archetypes"} onClick={() => setView("archetypes")}>
            Archetypes
          </TogglePill>
          <TogglePill active={view === "roles"} onClick={() => setView("roles")}>
            Roles
          </TogglePill>
        </div>

        {view === "archetypes" ? (
          <div className="flex flex-col gap-6">
            {FAMILIES.map((family) => {
              const members = set.archetypes.filter((a) => a.family === family.id);
              if (members.length === 0) return null;
              return (
                <section key={family.id} className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
                    {family.name}
                  </h2>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {members.map((archetype) => (
                      <ArchetypeCard
                        key={archetype.id}
                        archetype={archetype}
                        data={data}
                        regulationId={regulationId}
                        samples={samples.filter((sample) => sample.archetypeId === archetype.id)}
                        addedBy={user.displayName ?? undefined}
                        onAdd={add}
                        onRemove={remove}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
            <p className="text-xs text-zinc-500">
              No match is <span className="font-medium">Balance</span>. A team&apos;s label is its
              primary archetype (highest priority, then the most conditions, then boosts) plus its
              speed mode or next tag; matches of the same family fold into one.
            </p>
          </div>
        ) : (
          <RolesTable />
        )}
      </div>
    </div>
  );
}

function DataStatus({
  data,
  isLoading,
  version,
}: {
  data: MetaArchetypes | null;
  isLoading: boolean;
  version: number;
}) {
  if (isLoading) return <p className="text-sm text-zinc-500">Loading tournament data…</p>;
  if (!data) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        No tournament data for this regulation yet — the metagame job writes it on its next run.
      </p>
    );
  }
  return (
    <p className="text-sm text-zinc-600">
      Tournament data: {data.teams} teams from {data.eventTeams.length} events
      {data.version !== version && (
        <span className="text-amber-700 dark:text-amber-400">
          {" "}
          · built with v{data.version}, so it reflects older definitions until the job runs again
        </span>
      )}
    </p>
  );
}

function ArchetypeCard({
  archetype,
  data,
  regulationId,
  samples,
  addedBy,
  onAdd,
  onRemove,
}: {
  archetype: ArchetypeDefinition;
  data: MetaArchetypes | null;
  regulationId: string;
  samples: ArchetypeSample[];
  addedBy?: string;
  onAdd: (sample: ArchetypeSample) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const set = DEFAULT_ARCHETYPE_SET;
  const byId = new Map(set.archetypes.map((a) => [a.id, a]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const tempo = archetypeTempo(archetype.id, set);
  const inherited = ancestorsOf(archetype.id, byId).flatMap((id) =>
    (byId.get(id)?.requires ?? []).map((condition) => ({ from: id, condition })),
  );
  const totals = data ? archetypeTotals(data, archetype.id) : null;

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-zinc-200 bg-raised p-4 text-sm",
        archetype.status === "draft" && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className={cn("size-2.5 rounded-full", tempo ? TEMPO[tempo].dot : "bg-zinc-400")}
        />
        <h3 className="font-semibold text-zinc-900">{archetype.name}</h3>
        <code className="text-xs text-zinc-500">{archetype.id}</code>
        {archetype.status === "draft" && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
            Draft — never matched
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-500">
          {tempo ? TEMPO[tempo].name : "No fixed tempo"}
          {!archetype.tempo && tempo && " (inherited)"} · priority {archetype.priority}
        </span>
      </div>
      <p className="text-zinc-700">{archetype.description}</p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {!!archetype.parents?.length && (
          <>
            <dt className="font-medium text-zinc-500">Refines</dt>
            <dd className="text-zinc-800">{archetype.parents.map(name).join(", ")}</dd>
          </>
        )}
        <dt className="font-medium text-zinc-500">Needs</dt>
        <dd className="text-zinc-800">
          <ul className="flex flex-col">
            {inherited.map(({ from, condition }, index) => (
              <li key={`inherited-${index}`} className="text-zinc-500">
                {describeCondition(condition, set)}{" "}
                <span className="text-zinc-400">(from {name(from)})</span>
              </li>
            ))}
            {archetype.requires.map((condition, index) => (
              <li key={index}>{describeCondition(condition, set)}</li>
            ))}
          </ul>
        </dd>
        {!!archetype.excludes?.length && (
          <>
            <dt className="font-medium text-zinc-500">Never with</dt>
            <dd className="text-zinc-800">
              <ul className="flex flex-col">
                {archetype.excludes.map((condition, index) => (
                  <li key={index}>{describeCondition(condition, set)}</li>
                ))}
              </ul>
            </dd>
          </>
        )}
        {!!archetype.boosts?.length && (
          <>
            <dt className="font-medium text-zinc-500">Boosted by</dt>
            <dd className="text-zinc-800">
              <ul className="flex flex-col">
                {archetype.boosts.map((boost, index) => (
                  <li key={index}>
                    {describeCondition(boost.condition, set)}{" "}
                    <span className="text-zinc-400">(+{boost.weight})</span>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
        {!!archetype.regulations?.length && (
          <>
            <dt className="font-medium text-zinc-500">Only in</dt>
            <dd className="text-zinc-800">{archetype.regulations.join(", ")}</dd>
          </>
        )}
      </dl>

      {totals && archetype.status === "active" && (
        <p className="border-t border-zinc-200 pt-2 text-xs text-zinc-600">
          {totals.teams === 0 ? (
            "No tournament team has it as its main archetype."
          ) : (
            <>
              <span className="font-medium text-zinc-900">{totals.teams} teams</span> (
              {percent(totals.teams / (data?.teams || 1))}) ·{" "}
              {totals.winRate === null ? "—" : percent(totals.winRate)} win rate · {totals.topCut}{" "}
              top cuts · by event {totals.shareByEvent.map(percent).join(" → ")}
            </>
          )}
          {totals.asSecond > 0 && ` · second part of ${totals.asSecond} more teams' labels`}
        </p>
      )}

      <ArchetypeSamples
        archetype={archetype}
        samples={samples}
        regulationId={regulationId}
        addedBy={addedBy}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    </article>
  );
}

function RolesTable() {
  const set = DEFAULT_ARCHETYPE_SET;
  const usedBy = (roleId: string) =>
    set.archetypes
      .filter((a) =>
        [...a.requires, ...(a.excludes ?? []), ...(a.boosts ?? []).map((b) => b.condition)]
          .flatMap(conditionRoleIds)
          .includes(roleId),
      )
      .map((a) => a.name);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-raised">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">A Pokémon holds it when it…</th>
            <th className="px-3 py-2 font-medium">Used by</th>
          </tr>
        </thead>
        <tbody>
          {set.roles.map((role) => {
            const users = usedBy(role.id);
            return (
              <tr key={role.id} className="border-b border-zinc-100 align-top last:border-0">
                <td className="px-3 py-2">
                  <p className="font-medium text-zinc-900">{role.name}</p>
                  <code className="text-xs text-zinc-500">{role.id}</code>
                </td>
                <td className="px-3 py-2 text-zinc-700">
                  {describeCheck(role.match)}
                  {role.description && <p className="text-xs text-zinc-500">{role.description}</p>}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">
                  {users.length ? users.join(", ") : <span className="text-zinc-400">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
