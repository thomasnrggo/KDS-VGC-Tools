import {
  duplicateSlots,
  effectiveMegas,
  groupToLeadBack,
  BACK_2,
  canMegaEvolve,
  leadBackToGroup,
  normalizeBackAlt,
  pickIntoSlot,
  toggleSlotMega,
  usedInOtherSlots,
  withBackAlt,
  type LeadBackPicks,
  type SlotTag,
} from "@/lib/slotPicks";
import type { Messages } from "@/lib/i18n/messages";
import type { ParsedPokemon, PokemonSlot } from "@/types";

/** The four lead/back slots in order: Lead 1, Lead 2, Back 1, Back 2. */
export const LEAD_BACK_SLOTS = [0, 1, 2, 3] as const;

/**
 * Everything a lead/back PokemonSlotPicker needs, for slot 0–3 (Lead 1,
 * Lead 2, Back 1, Back 2) of a matchup plan or team combination. The four
 * slots are one group: picking a Pokémon that's in another slot swaps the
 * two, and only one of them can have its Mega on (see src/lib/slotPicks.ts).
 */
export function leadBackSlotProps<T extends LeadBackPicks>(
  plan: T,
  roster: ParsedPokemon[],
  update: (updater: (plan: T) => T) => void,
  t: Messages,
  /** Back 2 can be "A or B" (`backAlt`) — your own picks, not the opponent's. */
  { flexBack = false }: { flexBack?: boolean } = {},
) {
  const group = leadBackToGroup(plan);
  const megas = effectiveMegas(group, roster);
  const duplicates = duplicateSlots(group.picks);
  const tags: SlotTag[] = [
    { label: t.combination.lead(1), tag: t.combination.leadTag(1) },
    { label: t.combination.lead(2), tag: t.combination.leadTag(2) },
    { label: t.combination.backSlot(1), tag: t.combination.backTag(1) },
    { label: t.combination.backSlot(2), tag: t.combination.backTag(2) },
  ];

  const alt = flexBack ? (plan.backAlt ?? null) : null;
  // Another slot's Mega already on: the alternative shows in its base form.
  const otherMega = megas.some(
    (mega, slot) => slot !== BACK_2 && mega && canMegaEvolve(roster[group.picks[slot] ?? -1]),
  );

  return (slot: number) => ({
    label: tags[slot].label,
    myTeamPokemon: roster,
    value: group.picks[slot],
    onChange: (index: PokemonSlot) =>
      update((p) =>
        normalizeBackAlt(groupToLeadBack(p, pickIntoSlot(leadBackToGroup(p), slot, index, roster))),
      ),
    megaEnabled: megas[slot],
    // Toggles from the flags as shown, so older data with two Megas on
    // settles to the one-Mega rule on the first toggle.
    onMegaToggle: () =>
      update((p) => {
        const current = leadBackToGroup(p);
        const shown = { ...current, megas: effectiveMegas(current, roster) };
        return groupToLeadBack(p, toggleSlotMega(shown, slot));
      }),
    usedIn: {
      ...(alt !== null && slot !== BACK_2 ? { [alt]: tags[BACK_2] } : {}),
      ...usedInOtherSlots(group.picks, slot, tags),
    },
    isDuplicate: duplicates.has(slot),
    ...(flexBack && slot === BACK_2
      ? {
          flex: {
            alternative: alt,
            alternativeMega: !otherMega && megas[BACK_2],
            onChange: (back2: PokemonSlot, alternative: PokemonSlot) =>
              update((p) => withBackAlt(p, back2, alternative, roster)),
          },
          // The other three are set and this one isn't: any of the rest fits.
          anyWhenEmpty: group.picks.slice(0, BACK_2).every((pick) => pick !== null),
        }
      : {}),
  });
}
