import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { speciesNamesMegaForm } from "@/lib/species/megaForm";
import type { ParsedPokemon, PokemonSlot } from "@/types";

/**
 * A group of pick slots that must hold different Pokémon — the 2 leads + 2
 * backs of a matchup plan or team combination, or one side's 4 picks in a
 * tournament game — each with a Mega flag ("show/use the Mega form").
 */
export interface SlotPicks {
  picks: PokemonSlot[];
  megas: boolean[];
}

/** True if this Pokémon can Mega Evolve in a game: it holds its Mega Stone, or was pasted as its Mega form. */
export function canMegaEvolve(mon: ParsedPokemon | undefined): boolean {
  if (!mon) return false;
  return speciesNamesMegaForm(mon.species) || candidateFormKeys(mon.species, mon.item).length > 1;
}

function isActiveMega(group: SlotPicks, slot: number, roster: ParsedPokemon[]): boolean {
  const index = group.picks[slot];
  return index !== null && group.megas[slot] && canMegaEvolve(roster[index]);
}

/**
 * Puts roster `index` (or nothing) into `slot`. A Pokémon can only be in one
 * slot, so picking one that's already elsewhere swaps: it moves here, and
 * this slot's previous Pokémon (if any) moves to where it was. A Mega flag
 * travels with its Pokémon. Only one Pokémon per group may Mega Evolve, so a
 * newly picked Mega-capable Pokémon starts in its base form when another
 * slot already has its Mega on. `megaByDefault` is a new pick's Mega flag
 * otherwise — on for plans, off for tournament games, where using the Mega
 * is always an explicit choice.
 */
export function pickIntoSlot(
  group: SlotPicks,
  slot: number,
  index: PokemonSlot,
  roster: ParsedPokemon[],
  megaByDefault = true,
): SlotPicks {
  const picks = [...group.picks];
  const megas = [...group.megas];

  if (index === null) {
    picks[slot] = null;
    megas[slot] = megaByDefault;
    return { picks, megas };
  }

  const from = picks.findIndex((pick, other) => pick === index && other !== slot);
  if (from !== -1) {
    picks[from] = picks[slot];
    picks[slot] = index;
    [megas[from], megas[slot]] = [megas[slot], megas[from]];
    if (picks[from] === null) megas[from] = megaByDefault;
    return { picks, megas };
  }

  picks[slot] = index;
  megas[slot] = megaByDefault;
  const next = { picks, megas };
  const otherMega = picks.some((_, other) => other !== slot && isActiveMega(next, other, roster));
  if (otherMega) megas[slot] = false;
  return next;
}

/** Flips `slot`'s Mega flag; turning it on turns every other slot's off — one Mega per game. */
export function toggleSlotMega(group: SlotPicks, slot: number): SlotPicks {
  const turningOn = !group.megas[slot];
  return {
    picks: group.picks,
    megas: group.megas.map((mega, other) =>
      other === slot ? turningOn : turningOn ? false : mega,
    ),
  };
}

/**
 * The Mega flags as they should show: if saved data has more than one Mega
 * on (from before the one-Mega rule), only the first counts. Doesn't change
 * what's stored until the user edits the group.
 */
export function effectiveMegas(group: SlotPicks, roster: ParsedPokemon[]): boolean[] {
  let seen = false;
  return group.megas.map((mega, slot) => {
    if (!isActiveMega(group, slot, roster)) return mega;
    if (seen) return false;
    seen = true;
    return true;
  });
}

/** A slot's full label ("Lead 1") and the short tag shown on a picker tile ("L1"). */
export interface SlotTag {
  label: string;
  tag: string;
}

/** For `slot`'s picker: each roster index held by one of the group's other slots, with that slot's tag. */
export function usedInOtherSlots(
  picks: PokemonSlot[],
  slot: number,
  tags: SlotTag[],
): Record<number, SlotTag> {
  const used: Record<number, SlotTag> = {};
  picks.forEach((pick, other) => {
    if (pick !== null && other !== slot && !(pick in used)) used[pick] = tags[other];
  });
  return used;
}

/** Slots whose Pokémon also appears in an earlier slot — only possible in data saved before picks were kept unique. */
export function duplicateSlots(picks: PokemonSlot[]): Set<number> {
  const duplicates = new Set<number>();
  picks.forEach((pick, slot) => {
    if (pick !== null && picks.indexOf(pick) !== slot) duplicates.add(slot);
  });
  return duplicates;
}

/** The 2 leads + 2 backs of a plan/combination as one 4-slot group: Lead 1, Lead 2, Back 1, Back 2. */
export interface LeadBackPicks {
  leadPair: [PokemonSlot, PokemonSlot];
  backPair: [PokemonSlot, PokemonSlot];
  leadMega: [boolean, boolean];
  backMega: [boolean, boolean];
  /** Back 2's alternative ("A or B") — see withBackAlt. */
  backAlt?: PokemonSlot;
}

/** Back 2's slot in the 4-slot group. */
export const BACK_2 = 3;

/**
 * Keeps Back 2's alternative valid after the picks change: it goes when
 * Back 2 is empty (it's promoted to Back 2 instead) or when it's now picked
 * in a slot of its own.
 */
export function normalizeBackAlt<T extends LeadBackPicks>(plan: T): T {
  const alt = plan.backAlt ?? null;
  if (alt === null) return plan;
  const picks = [...plan.leadPair, ...plan.backPair];
  if (picks.includes(alt)) return { ...plan, backAlt: null };
  if (plan.backPair[1] === null) {
    return { ...plan, backPair: [plan.backPair[0], alt], backAlt: null };
  }
  return plan;
}

/**
 * Sets Back 2 and its alternative together (the flexible slot's picker
 * edits both at once). The alternative is dropped when it's missing, the
 * same as Back 2, or picked in another slot; an empty Back 2 takes it.
 */
export function withBackAlt<T extends LeadBackPicks>(
  plan: T,
  back2: PokemonSlot,
  alt: PokemonSlot,
  roster: ParsedPokemon[],
): T {
  const group = pickIntoSlot(leadBackToGroup(plan), BACK_2, back2, roster);
  const next = groupToLeadBack(plan, group);
  return normalizeBackAlt({ ...next, backAlt: alt === back2 ? null : alt });
}

export function leadBackToGroup(plan: LeadBackPicks): SlotPicks {
  return {
    picks: [...plan.leadPair, ...plan.backPair],
    megas: [...plan.leadMega, ...plan.backMega],
  };
}

export function groupToLeadBack<T extends LeadBackPicks>(plan: T, group: SlotPicks): T {
  const [lead1, lead2, back1, back2] = group.picks;
  const [leadMega1, leadMega2, backMega1, backMega2] = group.megas;
  return {
    ...plan,
    leadPair: [lead1, lead2],
    backPair: [back1, back2],
    leadMega: [leadMega1, leadMega2],
    backMega: [backMega1, backMega2],
  };
}
