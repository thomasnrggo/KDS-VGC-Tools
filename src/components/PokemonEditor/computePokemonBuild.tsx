import type { ReactNode } from "react";
import { calculateStatBreakdown, type StatBreakdown } from "@/lib/stats/calculateFinalStats";
import { applyStatOverrides, type StatOverrides } from "@/lib/stats/applyStatOverrides";
import { candidateFormKeys } from "@/lib/species/candidateFormKeys";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { REGULATIONS } from "@/data/regulations";
import abilitiesData from "@/data/abilities.json";
import abilityDescriptionsData from "@/data/abilityDescriptions.json";
import itemsData from "@/data/items.json";
import speciesTypesData from "@/data/speciesTypes.json";
import type { AbilityData, ItemData, ParsedPokemon, SpeciesAbility } from "@/types";
import { ItemIcon } from "../ItemIcon";
import type { SearchableSelectOption } from "../SearchableSelect";
import { ENGLISH_POKEMON_TEXT, type PokemonText } from "@/lib/i18n/pokemonNames";

const ABILITIES = abilitiesData as unknown as Record<string, SpeciesAbility[]>;
const ABILITY_DESCRIPTIONS = abilityDescriptionsData as unknown as Record<string, AbilityData>;
const ITEMS = itemsData as unknown as Record<string, ItemData>;
const SPECIES_TYPES = speciesTypesData as unknown as Record<string, string[]>;

export interface PokemonBuild {
  /** Whether this species/item combo has a Mega form available — `mega` only matters when this is true. */
  hasMegaForm: boolean;
  /** The effective form's 1-2 types (mega-aware — Mega Charizard Y is Fire/Dragon, not base Charizard's Fire/Flying) — empty when there's no resolvable form. */
  types: string[];
  /** `pokemon` as actually built for stats/ability purposes — item stripped when `mega` is off despite holding a Mega Stone, so the base (non-Mega) form is what gets calculated/displayed. Null iff `pokemon` is null. */
  effectivePokemon: ParsedPokemon | null;
  /** Base/Stat-Points/Final breakdown for the stat table — null when the effective form has no resolvable base stats. */
  breakdown: StatBreakdown | null;
  /** The nature actually in effect after Stat Point overrides, lowercased Showdown key (e.g. "hardy") — defaults to "Hardy" when there's no Pokémon yet. */
  currentNature: string;
  /** Mega-aware — reflects the Mega form's ability while `mega` is on (e.g. Mega Blastoise's "Mega Launcher"), even though the base `pokemon.ability` field is what actually gets saved. */
  effectiveAbility: string | undefined;
  /** Every legal ability for the current form (regular abilities first, Hidden Ability last), for the ability picker — empty when there's no resolvable form. Each option's `content` is a Showdown-style name+description row (see abilityOptionContent). */
  abilitySelectOptions: SearchableSelectOption[];
  /** Every legal held item (this Pokémon's own Mega Stone(s) first, then the Regulation's other legal items), with the pasted item injected as its own option first if it's off both lists (an older/off-meta paste). Each option's `content` is a Showdown-style icon+name+description row (see itemOptionContent). */
  itemOptions: SearchableSelectOption[];
}

/** A Showdown-style "Name / description" row, shared by the ability and item pickers (see abilityOptionContent/itemOptionContent) — the only difference between the two is the leading icon. */
function nameAndDescriptionContent(icon: ReactNode, name: string, shortDesc: string | undefined) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {icon}
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{name}</span>
        {shortDesc && <span className="truncate text-[11px] text-zinc-500">{shortDesc}</span>}
      </div>
    </div>
  );
}

function abilityOptionContent(name: string, label: string) {
  const description = ABILITY_DESCRIPTIONS[normalizeSpeciesKey(name)]?.shortDesc;
  return nameAndDescriptionContent(null, label, description);
}

function itemOptionContent(name: string, label: string) {
  const description = ITEMS[normalizeSpeciesKey(name)]?.shortDesc;
  return nameAndDescriptionContent(
    <span className="shrink-0">
      <ItemIcon item={name} size={20} />
    </span>,
    label,
    description,
  );
}

/**
 * How option labels are shown — translated names (the Pokémon language) and
 * the "(Hidden Ability)"/"(Mega Stone)" notes (the app language). Option ids
 * stay the English names that get saved.
 */
export interface BuildLabels {
  text: PokemonText;
  hiddenAbility: string;
  megaStone: string;
}

const ENGLISH_LABELS: BuildLabels = {
  text: ENGLISH_POKEMON_TEXT,
  hiddenAbility: "Hidden Ability",
  megaStone: "Mega Stone",
};

/**
 * Derives everything PokemonEditor needs to render and calculate from a
 * Pokémon plus the Stat Points/nature overrides layered on top of it. Pure —
 * no internal state — so callers that also need battle-state-dependent
 * values derived from the same breakdown/effectiveAbility (e.g.
 * RosterPokemonPicker's weather/Tailwind-aware Speed multiplier) can call it
 * again alongside PokemonEditor's own internal call rather than needing it
 * threaded back out via a callback.
 */
export function computePokemonBuild(
  pokemon: ParsedPokemon | null,
  mega: boolean,
  statOverrides: StatOverrides,
  labels: BuildLabels = ENGLISH_LABELS,
): PokemonBuild {
  const { text } = labels;
  const hasMegaForm = pokemon
    ? candidateFormKeys(pokemon.species, pokemon.item).length > 1
    : false;
  const effectivePokemon =
    pokemon && hasMegaForm && !mega ? { ...pokemon, item: undefined } : pokemon;
  const overriddenPokemon = effectivePokemon
    ? applyStatOverrides(effectivePokemon, statOverrides)
    : undefined;
  const breakdown = overriddenPokemon ? calculateStatBreakdown(overriddenPokemon) : null;
  const effectiveAbility = effectivePokemon
    ? resolveEffectiveAbility(
        effectivePokemon.species,
        effectivePokemon.item,
        effectivePokemon.ability,
      )
    : undefined;
  const currentNature = overriddenPokemon?.nature ?? "Hardy";

  // Ability options for the current FORM (mega-aware — Charizard-Mega-X only
  // has Tough Claws, not Blaze/Solar Power).
  const abilityFormKey = effectivePokemon
    ? candidateFormKeys(effectivePokemon.species, effectivePokemon.item)[0]
    : undefined;
  const abilityOptions = abilityFormKey ? (ABILITIES[abilityFormKey] ?? []) : [];
  const types = abilityFormKey ? (SPECIES_TYPES[abilityFormKey] ?? []) : [];
  const abilitySelectOptions: SearchableSelectOption[] = abilityOptions.map((ability) => {
    const label = ability.isHidden
      ? `${text.ability(ability.name)} (${labels.hiddenAbility})`
      : text.ability(ability.name);
    return {
      id: ability.name,
      label,
      searchText: ability.name,
      content: abilityOptionContent(ability.name, label),
    };
  });

  // REGULATIONS[0]'s own function, not the bare `megaStoneItemsForSpecies`
  // re-export (that's specifically Regulation M-B's list — seven other
  // callers thread `regulation.megaStoneItemsForSpecies` through correctly;
  // this one didn't, which silently hid every Mega Stone M-C added on top of
  // M-B, e.g. Salamencite for Salamence).
  const megaStoneOptions = pokemon
    ? REGULATIONS[0].megaStoneItemsForSpecies(normalizeSpeciesKey(pokemon.species))
    : [];
  // Flat, searchable item list — a real pasted team's item might not be in
  // the Regulation's list (an older/off-meta paste), so it's injected as its
  // own option first so the combobox still reflects it accurately instead of
  // silently dropping it.
  const itemOptions: SearchableSelectOption[] = pokemon
    ? [
        ...(pokemon.item &&
        !megaStoneOptions.includes(pokemon.item) &&
        !REGULATIONS[0].items.includes(pokemon.item)
          ? [
              {
                id: pokemon.item,
                label: text.item(pokemon.item),
                searchText: pokemon.item,
                content: itemOptionContent(pokemon.item, text.item(pokemon.item)),
              },
            ]
          : []),
        ...megaStoneOptions.map((item) => {
          const label = `${text.item(item)} (${labels.megaStone})`;
          return { id: item, label, searchText: item, content: itemOptionContent(item, label) };
        }),
        ...REGULATIONS[0].items.map((item) => ({
          id: item,
          label: text.item(item),
          searchText: item,
          content: itemOptionContent(item, text.item(item)),
        })),
      ]
    : [];

  return {
    hasMegaForm,
    types,
    effectivePokemon,
    breakdown,
    currentNature,
    effectiveAbility,
    abilitySelectOptions,
    itemOptions,
  };
}
