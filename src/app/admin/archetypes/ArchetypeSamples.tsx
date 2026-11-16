"use client";

import { useState } from "react";
import { Button, TextAction } from "@/components/Button";
import { Modal, ModalActions, ModalDescription, ModalTitle } from "@/components/Modal";
import { PokemonSprite } from "@/components/PokemonSprite";
import { Textarea } from "@/components/Textarea";
import { toast } from "@/components/Toast";
import {
  DEFAULT_ARCHETYPE_SET,
  checkSample,
  describeCondition,
  labelForKey,
  type ArchetypeDefinition,
  type ArchetypeSample,
  type SampleCheck,
  type SampleStatus,
} from "@/lib/archetypes";
import { generateId } from "@/lib/id";
import { parseTeam } from "@/lib/parseTeam";
import { fetchPokepaste, isPokepasteUrl } from "@/lib/pokepaste/fetchPokepaste";
import { cn } from "@/lib/utils";

const STATUS: Record<SampleStatus, { mark: string; text: string; className: string }> = {
  primary: { mark: "✓", text: "Main archetype", className: "text-green-700 dark:text-green-400" },
  variant: { mark: "✓", text: "As a variant", className: "text-green-700 dark:text-green-400" },
  tag: { mark: "≈", text: "Only as a tag", className: "text-amber-700 dark:text-amber-400" },
  miss: { mark: "✗", text: "Doesn't match", className: "text-red-700 dark:text-red-400" },
};

export const samplePasses = (status: SampleStatus) => status === "primary" || status === "variant";

const FIELD_CLASSES =
  "w-full rounded-lg border border-zinc-300 bg-field px-3 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none";

/** Why a sample got its result: each needed condition, the excludes it hit, what it became. */
function Explanation({ check }: { check: SampleCheck }) {
  const set = DEFAULT_ARCHETYPE_SET;
  const name = (id: string) => set.archetypes.find((a) => a.id === id)?.name ?? id;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <p className="text-zinc-600">
        Classified as{" "}
        <span className="font-medium text-zinc-900">{labelForKey(check.key, set)}</span>
      </p>
      <ul className="flex flex-col">
        {check.requires.map((entry, index) => (
          <li
            key={index}
            className={entry.passed ? "text-zinc-600" : "text-red-700 dark:text-red-400"}
          >
            {entry.passed ? "✓" : "✗"} {describeCondition(entry.condition, set)}
            {entry.from && <span className="text-zinc-400"> (from {name(entry.from)})</span>}
          </li>
        ))}
        {check.excludedBy.map((condition, index) => (
          <li key={`x${index}`} className="text-red-700 dark:text-red-400">
            ✗ has {describeCondition(condition, set)}, which rules it out
          </li>
        ))}
      </ul>
    </div>
  );
}

function SampleRow({
  sample,
  regulationId,
  onRemove,
}: {
  sample: ArchetypeSample;
  regulationId: string;
  onRemove: () => Promise<void>;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const team = parseTeam(sample.paste);
  const check = checkSample(team, sample.archetypeId, DEFAULT_ARCHETYPE_SET, regulationId);
  const status = STATUS[check.status];

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-zinc-200 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-xs font-semibold", status.className)}>
          {status.mark} {status.text}
        </span>
        <span className="text-sm font-medium text-zinc-900">{sample.name}</span>
        <span className="ml-auto flex items-center gap-2">
          {isConfirming ? (
            <>
              <span className="text-xs text-zinc-600">Remove this sample?</span>
              <TextAction
                className="text-red-700 hover:text-red-800 dark:text-red-400"
                onClick={() => onRemove().catch(() => setIsConfirming(false))}
              >
                Remove
              </TextAction>
              <TextAction onClick={() => setIsConfirming(false)}>Cancel</TextAction>
            </>
          ) : (
            <TextAction onClick={() => setIsConfirming(true)}>Remove</TextAction>
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-0.5">
        {team.map((mon, index) => (
          <PokemonSprite key={index} species={mon.species} item={mon.item} size={36} />
        ))}
      </div>
      {sample.note && <p className="text-xs text-zinc-600">{sample.note}</p>}
      {check.status === "primary" ? (
        <p className="text-xs text-zinc-500">
          Classified as {labelForKey(check.key, DEFAULT_ARCHETYPE_SET)}
        </p>
      ) : (
        <Explanation check={check} />
      )}
    </li>
  );
}

/** One archetype's sample teams on its /admin/archetypes card, with Add and Remove. */
export function ArchetypeSamples({
  archetype,
  samples,
  regulationId,
  addedBy,
  onAdd,
  onRemove,
}: {
  archetype: ArchetypeDefinition;
  samples: ArchetypeSample[];
  regulationId: string;
  addedBy?: string;
  onAdd: (sample: ArchetypeSample) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [isAdding, setIsAdding] = useState(false);

  async function remove(id: string) {
    try {
      await onRemove(id);
    } catch (error) {
      console.error("[admin/archetypes] remove failed:", error);
      toast.error("Couldn't remove that sample.");
      throw error;
    }
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-zinc-500">
          Sample teams{samples.length > 0 && ` (${samples.length})`}
        </p>
        <TextAction className="ml-auto" onClick={() => setIsAdding(true)}>
          + Add sample
        </TextAction>
      </div>
      {samples.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {samples.map((sample) => (
            <SampleRow
              key={sample.id}
              sample={sample}
              regulationId={regulationId}
              onRemove={() => remove(sample.id)}
            />
          ))}
        </ul>
      )}
      {isAdding && (
        <AddSampleDialog
          archetype={archetype}
          regulationId={regulationId}
          addedBy={addedBy}
          onAdd={onAdd}
          onClose={() => setIsAdding(false)}
        />
      )}
    </div>
  );
}

function AddSampleDialog({
  archetype,
  regulationId,
  addedBy,
  onAdd,
  onClose,
}: {
  archetype: ArchetypeDefinition;
  regulationId: string;
  addedBy?: string;
  onAdd: (sample: ArchetypeSample) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isLink = isPokepasteUrl(paste);
  const team = isLink ? [] : parseTeam(paste);
  const check =
    team.length > 0 ? checkSample(team, archetype.id, DEFAULT_ARCHETYPE_SET, regulationId) : null;

  async function save() {
    setIsSaving(true);
    try {
      let text = paste.trim();
      let title = "";
      if (isLink) {
        const fetched = await fetchPokepaste(text);
        text = fetched.paste.trim();
        title = fetched.title;
      }
      if (parseTeam(text).length === 0) {
        toast.error("That paste has no Pokémon.");
        return;
      }
      await onAdd({
        id: generateId(),
        archetypeId: archetype.id,
        name: name.trim() || title || "Sample team",
        paste: text,
        note: note.trim() || undefined,
        addedBy,
        addedAt: new Date().toISOString(),
      });
      toast.success("Sample added.");
      onClose();
    } catch (error) {
      console.error("[admin/archetypes] add failed:", error);
      toast.error(error instanceof Error ? error.message : "Couldn't add that sample.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="add-sample-title" size="wide">
      <ModalTitle id="add-sample-title">Add a sample to {archetype.name}</ModalTitle>
      <ModalDescription>
        A team you know is {archetype.name}. It&apos;s classified live with the current definitions,
        so you can see whether the rules agree.
      </ModalDescription>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Ychutte balance"
            maxLength={100}
            className={FIELD_CLASSES}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Showdown paste or PokéPaste link
          <Textarea
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            rows={10}
            placeholder="Paste a team…"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Note (optional)
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why it's a good example"
            maxLength={300}
            className={FIELD_CLASSES}
          />
        </label>
        {isLink ? (
          <p className="text-xs text-zinc-500">
            The team is fetched from PokéPaste when you add it.
          </p>
        ) : (
          check && (
            <div className="rounded-md border border-zinc-200 p-2">
              <p className={cn("text-xs font-semibold", STATUS[check.status].className)}>
                {STATUS[check.status].mark} {STATUS[check.status].text}
              </p>
              <Explanation check={check} />
            </div>
          )
        )}
      </div>
      <ModalActions className="justify-end">
        <Button variant="outline" onClick={onClose} className="px-4 py-2 text-sm">
          Cancel
        </Button>
        <Button
          onClick={save}
          disabled={isSaving || (!isLink && team.length === 0)}
          className="px-4 py-2 text-sm"
        >
          {isSaving ? "Adding…" : "Add sample"}
        </Button>
      </ModalActions>
    </Modal>
  );
}
