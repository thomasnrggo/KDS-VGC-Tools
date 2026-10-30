"use client";

import { useEffect, useRef, useState } from "react";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { TypeIcon } from "../TypeIcon";
import { Icon } from "../Icon";
import { TextAction } from "../Button";
import { IconName } from "@/enums";
import { NATURE_MODIFIERS } from "@/constants/natures";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import movesData from "@/data/moves.json";
import type { ParsedPokemon } from "@/types";
import type { MoveData } from "@/types/damage";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";

const MOVES = movesData as unknown as Record<string, MoveData>;

/**
 * A team at a glance, like an open team sheet — compact enough to sit beside
 * something else (the matchup page's plans): a 2×3 grid of tiles, each with
 * the sprite and held item, name, item · ability, nature, and the moves 2×2.
 * Pass `onNoteChange` for a note per Pokémon (keyed by its index in the team),
 * under its moves.
 * Without it the sheet is read-only.
 */
export function TeamSheetPreview({
  pokemon,
  notes,
  onNoteChange,
}: {
  pokemon: ParsedPokemon[];
  notes?: Record<number, string>;
  onNoteChange?: (index: number, note: string) => void;
}) {
  return (
    <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
      {pokemon.map((mon, index) => (
        <li key={`${mon.species}-${index}`} className="bg-zinc-50">
          <TeamSheetEntry
            pokemon={mon}
            note={notes?.[index] ?? ""}
            onNoteChange={onNoteChange && ((note) => onNoteChange(index, note))}
          />
        </li>
      ))}
    </ul>
  );
}

function TeamSheetEntry({
  pokemon,
  note,
  onNoteChange,
}: {
  pokemon: ParsedPokemon;
  note: string;
  onNoteChange?: (note: string) => void;
}) {
  const t = useMessages();
  const text = usePokemonText();
  const name = text.species(pokemon.species);
  // The sprite shows the Mega form when it holds its stone, so the ability does too.
  const ability = resolveEffectiveAbility(pokemon.species, pokemon.item, pokemon.ability);
  const details = [pokemon.item && text.item(pokemon.item), ability && text.ability(ability)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2.5">
        <PokemonTile pokemon={pokemon} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-zinc-900">{name}</span>
          {details && <span className="truncate text-xs text-zinc-500">{details}</span>}
          {pokemon.nature && (
            <span className="truncate text-xs text-zinc-500">
              <NatureText nature={pokemon.nature} />
            </span>
          )}
        </div>
      </div>
      {pokemon.moves && pokemon.moves.length > 0 && (
        <ul aria-label={t.opponentPokemon.moveset} className="grid grid-cols-2 gap-x-2 gap-y-1">
          {pokemon.moves.map((move, index) => {
            const type = MOVES[normalizeSpeciesKey(move)]?.type;
            return (
              <li
                key={`${move}-${index}`}
                className="flex min-w-0 items-center gap-2 text-xs text-zinc-800"
              >
                {type ? (
                  <TypeIcon type={type} size={16} />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded bg-zinc-300" />
                )}
                <span className="truncate">{text.move(move)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {onNoteChange && (
        <PokemonNote
          note={note}
          onChange={onNoteChange}
          label={t.opponentPokemon.notesLabel(name)}
          placeholder={t.opponentPokemon.notesPlaceholder}
          addLabel={t.opponentPokemon.addNote}
        />
      )}
    </div>
  );
}

/**
 * A Pokémon's note: collapsed to an "Add a note" link while empty, then three
 * lines to start, growing with the text. Clearing it and leaving the field
 * collapses it again.
 */
function PokemonNote({
  note,
  onChange,
  label,
  placeholder,
  addLabel,
}: {
  note: string;
  onChange: (note: string) => void;
  label: string;
  placeholder: string;
  addLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const isShown = isOpen || note.trim() !== "";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function fit() {
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
    fit();
    // Rendered while hidden (the matchup page's "Their team" chip not picked
    // yet), it measures 0 tall — refit once it's laid out.
    // Width only, so fit's own height change doesn't retrigger it.
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [note, isShown]);

  if (!isShown) {
    return (
      <TextAction onClick={() => setIsOpen(true)} className="mt-auto self-start py-1">
        <Icon name={IconName.Add} size={14} />
        {addLabel}
      </TextAction>
    );
  }

  return (
    <textarea
      ref={ref}
      value={note}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setIsOpen(false)}
      autoFocus={isOpen && note === ""}
      rows={3}
      placeholder={placeholder}
      aria-label={label}
      className="mt-auto max-h-80 w-full resize-none overflow-y-auto rounded-md border border-transparent bg-zinc-100 px-2 py-1.5 text-xs leading-relaxed text-zinc-800 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-300 focus:bg-raised focus:outline-none"
    />
  );
}

/** A Pokémon's sprite with its held item in the corner. */
function PokemonTile({ pokemon }: { pokemon: ParsedPokemon }) {
  return (
    <span className="relative h-12 w-12 shrink-0">
      <span className="absolute inset-0 overflow-hidden rounded-lg bg-zinc-200">
        <PokemonSprite species={pokemon.species} item={pokemon.item} fill />
      </span>
      {pokemon.item && (
        <span className="absolute -right-1 -bottom-1">
          <ItemIcon item={pokemon.item} size={18} />
        </span>
      )}
    </span>
  );
}

/** "Modest (+SpA -Atk)" — the nature with what it raises in red and lowers in blue. */
function NatureText({ nature }: { nature: string }) {
  const t = useMessages();
  const text = usePokemonText();
  const modifier = NATURE_MODIFIERS[nature.toLowerCase()];
  return (
    <>
      {text.nature(nature)}
      {modifier && (modifier.increased || modifier.decreased) && (
        <>
          {" ("}
          {modifier.increased && (
            <span className="font-medium text-red-500">+{t.stats.short[modifier.increased]}</span>
          )}
          {modifier.increased && modifier.decreased && " "}
          {modifier.decreased && (
            <span className="font-medium text-blue-500">-{t.stats.short[modifier.decreased]}</span>
          )}
          {")"}
        </>
      )}
    </>
  );
}
