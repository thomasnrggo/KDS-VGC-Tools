// The metagame job (see PLANNING.md's "Metagame data"): fetches finished
// official VGC events from pokedata.ovh, keeps an anonymized copy of each in
// Firestore (metaEvents/{id}, private), and rewrites meta/{regulationId} — the
// public summary the app reads — for every regulation that got a new event.
// Run by .github/workflows/update-meta.yml weekly, or by hand:
//
//   npm run update:meta -- --dry-run            fetch and report, write nothing
//   npm run update:meta -- --fixtures --dry-run  offline, from src/lib/meta/__fixtures__
//   npm run update:meta                          for real (needs FIREBASE_SERVICE_ACCOUNT)
//
// Options: --max-events N (default 4) caps how many new events one run fetches.
//
// pokedata.ovh is one person's site with no API terms, so this is deliberately
// gentle: finished events only, each fetched once (a finished event never
// changes), seconds apart, with a user agent saying who's asking. Only our own
// aggregates are published, never their files or any player's name.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseOfficialEvent } from "../src/lib/meta/officialTournament.ts";
import { aggregateCombinations, aggregateOfficialMeta } from "../src/lib/meta/aggregateMeta.ts";
import { RECENT_EVENTS } from "../src/lib/meta/metaDocument.ts";
import {
  isFinished,
  isVgcEvent,
  parseEventIndex,
  regulationForDate,
} from "../src/lib/meta/pokedataIndex.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "../src/lib/meta/__fixtures__");

const BASE_URL = "https://www.pokedata.ovh/standings2";
const USER_AGENT =
  "VGCBox-meta-job/1.0 (weekly, finished events only; https://github.com/thomasnrggo/KDS-VGC-Tools)";
const DELAY_MS = 4000;
const REQUEST_TIMEOUT_MS = 60_000;
const DIVISION = "Masters";
/** The share of players that must match a team sheet for an event to count. */
const MIN_JOIN = 0.9;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const useFixtures = args.includes("--fixtures");
const maxEvents = Number(args[args.indexOf("--max-events") + 1]) || 4;
// Recompute every regulation's summary from the events already stored, even
// with nothing new to fetch — after a change to what the summary holds.
const rebuild = args.includes("--rebuild");
const today = new Date().toISOString().slice(0, 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequest = 0;
/** One request at a time, DELAY_MS apart. */
async function fetchText(url) {
  const wait = lastRequest + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  // A hung request fails after REQUEST_TIMEOUT_MS (body included) instead of
  // stalling the run until the workflow's own timeout; that event is retried
  // next run.
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.text();
}

const source = useFixtures
  ? {
      index: () => readFile(path.join(FIXTURES, "pokedata-index.html"), "utf8"),
      roster: async (id) =>
        id === "1000078"
          ? JSON.parse(await readFile(path.join(FIXTURES, "puebla-2026-roster.json"), "utf8"))
          : null,
      standings: async (id) =>
        id === "1000078"
          ? JSON.parse(
              await readFile(path.join(FIXTURES, "puebla-2026-masters-standings.json"), "utf8"),
            )
          : null,
    }
  : {
      index: () => fetchText(`${BASE_URL}/`),
      roster: async (id) => JSON.parse(await fetchText(`${BASE_URL}/RosterData/${id}.json`)),
      standings: async (id) =>
        JSON.parse(await fetchText(`${BASE_URL}/standings/${id}_${DIVISION}.json`)),
    };

/** Firestore through the job's service account, or an in-memory stand-in for a dry run. */
async function openStore() {
  if (dryRun) {
    const written = new Map();
    return {
      async processedIds() {
        return new Set();
      },
      async saveEvent(id, data) {
        written.set(`metaEvents/${id}`, data);
      },
      async eventsFor(regulationId) {
        return [...written.values()].filter((event) => event.regulationId === regulationId);
      },
      async regulationIds() {
        return new Set([...written.values()].map((event) => event.regulationId).filter(Boolean));
      },
      async saveMeta(regulationId, data) {
        written.set(`meta/${regulationId}`, data);
      },
      async saveTournamentMeta(regulationId, id, data) {
        written.set(`meta/${regulationId}/tournaments/${id}`, data);
      },
      written,
    };
  }
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!credentials) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: cert(JSON.parse(credentials)) });
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  return {
    async processedIds() {
      const snap = await db.collection("metaEvents").select().get();
      return new Set(snap.docs.map((doc) => doc.id));
    },
    async saveEvent(id, data) {
      await db.collection("metaEvents").doc(id).set(data);
    },
    async eventsFor(regulationId) {
      const snap = await db
        .collection("metaEvents")
        .where("regulationId", "==", regulationId)
        .get();
      return snap.docs.map((doc) => doc.data());
    },
    async regulationIds() {
      const snap = await db.collection("metaEvents").select("regulationId").get();
      return new Set(snap.docs.map((doc) => doc.get("regulationId")).filter(Boolean));
    },
    async saveMeta(regulationId, data) {
      await db.collection("meta").doc(regulationId).set(data);
    },
    async saveTournamentMeta(regulationId, id, data) {
      await db.collection("meta").doc(regulationId).collection("tournaments").doc(id).set(data);
    },
  };
}

async function main() {
  const store = await openStore();

  const indexHtml = await source.index();
  const listed = parseEventIndex(indexHtml);
  // Nothing parsed means the page changed shape: stop rather than publish nothing,
  // and say enough about what came back to fix the parser.
  if (listed.length === 0) {
    const text = indexHtml
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    console.error(
      `Index page: ${indexHtml.length} characters, ` +
        `${(indexHtml.match(/name="id"/g) ?? []).length} id fields. Starts: ${text.slice(0, 300)}`,
    );
    throw new Error("No events found in the pokedata.ovh index");
  }
  const processed = await store.processedIds();
  const pending = listed
    .filter((event) => isVgcEvent(event) && isFinished(event, today))
    .filter((event) => regulationForDate(event.startDate) && !processed.has(event.id))
    // Newest first, so the current regulation fills in before older ones backfill.
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, maxEvents);
  console.log(
    `Index: ${listed.length} events, ${pending.length} new finished VGC event(s) to fetch` +
      (pending.length ? `: ${pending.map((event) => event.title).join("; ")}` : ""),
  );

  const changedRegulations = new Set();
  for (const event of pending) {
    try {
      const roster = await source.roster(event.id);
      const standings = await source.standings(event.id);
      if (!roster || !standings) {
        console.warn(`  ${event.title}: no data, skipped`);
        continue;
      }
      // The index pairs titles and ids by position: make sure this is the event we meant.
      if (standings.tournament?.title?.trim() !== event.title) {
        console.warn(
          `  ${event.title}: the standings say "${standings.tournament?.title}", skipped`,
        );
        continue;
      }
      const parsed = parseOfficialEvent(roster, standings);
      const { sheets, standings: ranked, matched } = parsed.join;
      // Only a good join counts as done: anything less is left for the next run,
      // with counts (never names) saying what the files held.
      if (matched === 0 || matched < MIN_JOIN * Math.min(sheets, ranked)) {
        const divisions = {};
        for (const entry of roster) divisions[entry.d] = (divisions[entry.d] ?? 0) + 1;
        const withSheets = roster.filter((entry) => entry.tl?.length > 0).length;
        console.warn(
          `  ${event.title}: only ${matched} of ${ranked} standings players matched ` +
            `${sheets} team sheets — skipped. Roster: ${roster.length} entries ` +
            `${JSON.stringify(divisions)}, ${withSheets} with a team; standings division ` +
            `"${standings.standings?.division}", ${ranked} players.`,
        );
        continue;
      }
      const regulationId = regulationForDate(event.startDate);
      await store.saveEvent(event.id, {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        regulationId,
        division: parsed.division,
        players: parsed.players,
        fetchedAt: new Date().toISOString(),
      });
      changedRegulations.add(regulationId);
      console.log(
        `  ${event.title}: ${matched} ${parsed.division} teams (${ranked} in the standings)`,
      );
    } catch (error) {
      // Left unprocessed, so the next run tries it again.
      console.error(`  ${event.title}: failed — ${error.message}`);
    }
  }

  if (rebuild)
    for (const regulationId of await store.regulationIds()) changedRegulations.add(regulationId);

  for (const regulationId of changedRegulations) {
    // Oldest first: each Pokémon's per-event history follows this order.
    const events = (await store.eventsFor(regulationId)).sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    const summary = aggregateOfficialMeta(events);
    if (summary.teams === 0) {
      console.warn(`meta/${regulationId}: no teams — left as it was`);
      continue;
    }
    // The newest few events: the metagame as it is now, not as it was at the
    // start of the regulation.
    const recentEvents = events.slice(-RECENT_EVENTS);
    const recent = aggregateOfficialMeta(recentEvents);
    await store.saveMeta(regulationId, {
      regulationId,
      updatedAt: new Date().toISOString(),
      official: {
        source: "pokedata.ovh (RK9 team lists)",
        division: DIVISION,
        // Named apart from the summary's own fields: an `events` list here would
        // be overwritten by the summary's `events` count.
        tournaments: events.map(({ id, title, startDate, endDate, players }) => ({
          id,
          title,
          startDate,
          endDate,
          teams: players.length,
        })),
        teams: summary.teams,
        topTeams: summary.topTeams,
        pokemon: summary.pokemon,
        combos: aggregateCombinations(events),
        recent: {
          tournamentIds: recentEvents.map((event) => event.id),
          teams: recent.teams,
          topTeams: recent.topTeams,
          combos: aggregateCombinations(recentEvents),
          // Histories come from the whole regulation's list; leave them off here.
          pokemon: recent.pokemon.map((mon) => {
            const copy = { ...mon };
            delete copy.history;
            return copy;
          }),
        },
      },
    });
    // Each event on its own, for the page's tournament chips — separate documents,
    // since all of them in the summary would outgrow Firestore's 1MB limit.
    for (const event of events) {
      const single = aggregateOfficialMeta([event], { limit: 60 });
      await store.saveTournamentMeta(regulationId, event.id, {
        regulationId,
        updatedAt: new Date().toISOString(),
        tournament: {
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          teams: event.players.length,
        },
        teams: single.teams,
        topTeams: single.topTeams,
        pokemon: single.pokemon.map((mon) => {
          const copy = { ...mon };
          delete copy.history;
          return copy;
        }),
        combos: aggregateCombinations([event]),
      });
    }
    const top = recent.pokemon
      .slice(0, 5)
      .map((mon) => `${mon.species} ${(mon.usage * 100).toFixed(1)}%`)
      .join(", ");
    console.log(
      `meta/${regulationId}: ${summary.events} event(s), ${summary.teams} teams; ` +
        `recent ${recent.events}: ${top}`,
    );
  }

  if (dryRun && store.written) {
    const meta = [...store.written.entries()].filter(([key]) => key.startsWith("meta/"));
    for (const [key, value] of meta) {
      if (key.includes("/tournaments/")) {
        console.log(
          `(dry run) ${key}: ${(JSON.stringify(value).length / 1024).toFixed(0)} KB — ` +
            `${value.teams} teams, ${value.pokemon.length} Pokémon`,
        );
        continue;
      }
      const { official } = value;
      console.log(
        `(dry run) ${key}: ${(JSON.stringify(value).length / 1024).toFixed(0)} KB — ` +
          `${official.tournaments.length} tournament(s), ${official.teams} teams ` +
          `(${official.topTeams} in the top 32), ${official.pokemon.length} Pokémon; ` +
          `recent: ${official.recent.tournamentIds.length} tournament(s), ${official.recent.teams} teams; ` +
          `top team: ${official.combos.teams[0]?.species.join("/")} (${official.combos.teams[0]?.teams})`,
      );
    }
  }
}

// Exit explicitly, so nothing left open (sockets, the Firestore client) keeps the run alive.
main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
