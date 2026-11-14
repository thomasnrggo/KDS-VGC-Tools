"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { RegulationSelect } from "@/components/Select";
import { toast } from "@/components/Toast";
import { REGULATIONS } from "@/data/regulations";
import {
  joinIsGood,
  metaImportId,
  parseStandingsDate,
  type MetaImport,
} from "@/lib/meta/metaImport";
import {
  parseOfficialEvent,
  type OfficialEvent,
  type PokedataRosterEntry,
  type PokedataStandings,
} from "@/lib/meta/officialTournament";
import { regulationForDate } from "@/lib/meta/pokedataIndex";

const fieldClass =
  "rounded-md border border-zinc-300 bg-field px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none";

async function readJson<T>(file: File): Promise<T> {
  return JSON.parse(await file.text()) as T;
}

/**
 * Add an official event by hand (src/lib/meta/metaImport.ts): the two
 * pokedata.ovh files are parsed right here — players' names never leave the
 * browser — and the anonymous result waits for the metagame job.
 */
export function MetaEventUpload({
  uploadedBy,
  onUpload,
}: {
  uploadedBy: string;
  /** Saves it (metaImports/{id}); throws on failure. */
  onUpload: (entry: MetaImport) => Promise<void>;
}) {
  const [roster, setRoster] = useState<PokedataRosterEntry[] | null>(null);
  const [standings, setStandings] = useState<PokedataStandings | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pokedataId, setPokedataId] = useState("");
  const [regulationId, setRegulationId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Remounts the file inputs empty after an upload.
  const [formKey, setFormKey] = useState(0);

  let parsed: OfficialEvent | null = null;
  let parseError: string | null = null;
  if (roster && standings) {
    try {
      parsed = parseOfficialEvent(roster, standings);
    } catch (error) {
      parseError = `Couldn't read these files: ${(error as Error).message}`;
    }
  }
  const good = !!parsed && joinIsGood(parsed.join);
  // By date, as the job files a fetched event — unless picked by hand.
  const dateRegulation = startDate ? regulationForDate(startDate) : null;
  const regulation = regulationId ?? dateRegulation ?? REGULATIONS[0].id;
  const ready = good && !!title.trim() && !!startDate && !!endDate && endDate >= startDate;

  async function pickRoster(file: File | undefined) {
    if (!file) return;
    try {
      const data = await readJson<PokedataRosterEntry[]>(file);
      if (!Array.isArray(data)) throw new Error("not a roster (expected a list of players)");
      setRoster(data);
      setFileError(null);
    } catch (error) {
      setFileError(`Roster: ${(error as Error).message}`);
    }
  }

  async function pickStandings(file: File | undefined) {
    if (!file) return;
    try {
      const data = await readJson<PokedataStandings>(file);
      if (!data.standings?.players) throw new Error("not a standings file");
      setStandings(data);
      setFileError(null);
      // Fill in what the file says, unless already typed.
      if (!title && data.tournament?.title) setTitle(data.tournament.title.trim());
      const dates = data.tournament?.date ? parseStandingsDate(data.tournament.date) : null;
      if (dates && !startDate) {
        setStartDate(dates.startDate);
        setEndDate(dates.endDate);
      }
    } catch (error) {
      setFileError(`Standings: ${(error as Error).message}`);
    }
  }

  async function upload() {
    if (!parsed) return;
    setIsSaving(true);
    try {
      await onUpload({
        id: metaImportId(pokedataId, title.trim(), startDate),
        title: title.trim(),
        regulationId: regulation,
        startDate,
        endDate,
        division: parsed.division,
        players: parsed.players,
        join: parsed.join,
        uploadedAt: new Date().toISOString(),
        uploadedBy,
      });
      toast.success(`${title.trim()} uploaded — it joins the metagame on the job's next run.`);
      setRoster(null);
      setStandings(null);
      setTitle("");
      setStartDate("");
      setEndDate("");
      setPokedataId("");
      setRegulationId(null);
      setFormKey((value) => value + 1);
    } catch (error) {
      console.error("[metaImports] upload failed:", error);
      toast.error(
        "Couldn't upload. Check your connection — or that the latest firestore.rules are deployed.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      key={formKey}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-raised px-4 py-3"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-zinc-900">Add an event by hand</h2>
        <p className="text-xs text-zinc-500">
          From pokedata.ovh: the roster (<code>RosterData/&lt;id&gt;.json</code>) and the Masters
          standings (<code>standings/&lt;id&gt;_Masters.json</code>). They&apos;re read here — only
          anonymous teams and results are uploaded, never a player&apos;s name.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Roster JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => pickRoster(event.target.files?.[0])}
            className="text-sm text-zinc-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Masters standings JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => pickStandings(event.target.files?.[0])}
            className="text-sm text-zinc-700"
          />
        </label>
      </div>

      {(fileError || parseError) && (
        <p className="text-sm text-red-700">{fileError ?? parseError}</p>
      )}
      {parsed && (
        <p className={good ? "text-sm text-green-700" : "text-sm text-red-700"}>
          {parsed.join.matched} of {parsed.join.standings} players matched {parsed.join.sheets} team
          sheets
          {good
            ? " — good to go."
            : " — under 90%, so the files don't belong together or one is incomplete."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 lg:col-span-2">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          End date
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          pokedata.ovh id (optional)
          <input
            value={pokedataId}
            onChange={(event) => setPokedataId(event.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="e.g. 1000078"
            className={fieldClass}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-zinc-600">Regulation</span>
        <RegulationSelect value={regulation} onChange={setRegulationId} />
        {!regulationId && startDate && !dateRegulation && (
          <span className="text-xs text-amber-700">
            No regulation was in play on that date — pick one.
          </span>
        )}
        <Button onClick={upload} disabled={!ready || isSaving} className="ml-auto py-1.5 text-sm">
          {isSaving ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </section>
  );
}
