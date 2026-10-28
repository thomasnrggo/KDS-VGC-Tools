"use client";

import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { TeamCalcRow } from "./TeamCalcsList";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMessages } from "@/hooks/useLanguage";
import type { TeamCalc, TeamCalcSide } from "@/types";

/** One collapsible Offensive or Defensive list of a Pokémon's saved calcs, open by default. */
function CalcSection({
  title,
  calcs,
  onRemoveCalc,
  searching,
}: {
  title: string;
  calcs: TeamCalc[];
  onRemoveCalc?: (id: string) => void;
  searching?: boolean;
}) {
  const t = useMessages();
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold tracking-wide text-zinc-600 uppercase hover:bg-zinc-100">
        <span>
          {title} <span className="font-normal text-zinc-500">· {calcs.length}</span>
        </span>
        <Icon
          name={IconName.ExpandMore}
          size={16}
          className="text-zinc-500 transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2">
        {calcs.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {searching ? t.pokemonCard.noMatchingCalcs : t.pokemonCard.noCalcsYet}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200">
            {calcs.map((calc) => (
              <TeamCalcRow
                key={calc.id}
                calc={calc}
                removeLabel={t.pokemonCard.removeCalc}
                onRemove={onRemoveCalc ? () => onRemoveCalc(calc.id) : undefined}
              />
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

const CALC_SIDES: TeamCalcSide[] = ["offensive", "defensive"];

interface PokemonCalcsBoxProps {
  /** This Pokémon's saved calcs (already filtered while searching). */
  calcs: TeamCalc[];
  onRemoveCalc?: (id: string) => void;
  /** A search is narrowing `calcs` — an empty list then says nothing matched. */
  searching?: boolean;
}

/**
 * A Pokémon's saved calcs as collapsible Offensive and Defensive lists — a
 * box of its own under its card on the team page's Calcs tab.
 */
export function PokemonCalcsBox({ calcs, onRemoveCalc, searching }: PokemonCalcsBoxProps) {
  const t = useMessages();
  return (
    <div className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
      {CALC_SIDES.map((side) => (
        <CalcSection
          key={side}
          title={side === "offensive" ? t.pokemonCard.offensiveCalcs : t.pokemonCard.defensiveCalcs}
          calcs={calcs.filter((calc) => calc.side === side)}
          onRemoveCalc={onRemoveCalc}
          searching={searching}
        />
      ))}
    </div>
  );
}
