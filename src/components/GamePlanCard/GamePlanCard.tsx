"use client";

import { IconButton } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  leadBackSlotProps,
  PokemonSlotPicker,
  type SlotCalcs,
} from "@/components/PokemonSlotPicker";
import { RichTextEditor } from "@/components/RichTextEditor";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { EMPTY_PICKS, notesToHtml, planLetter } from "@/lib/matchupPlans";
import { BACK_2, effectiveMegas, leadBackToGroup } from "@/lib/slotPicks";
import { megaDisplay } from "@/lib/species/megaDisplay";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import {
  calcOwnSpecies,
  calcsBetween,
  calcThreat,
  isMegaForm,
  type CalcSideMon,
  type CalcSpecies,
} from "@/lib/teamCalcs";
import { speciesIdentity } from "@/lib/teamIdentity";
import type { GamePlan, ParsedPokemon, PlanPicks, TeamCalc } from "@/types";

/** A Pokémon as calcsBetween should match it: its Mega form only when it has one and it's on. */
function formOf(mon: ParsedPokemon, mega: boolean): CalcSideMon {
  return { species: mon.species, mega: megaDisplay(mon, mega).hasMegaForm && mega };
}

const LABEL_CLASSES = "text-xs font-semibold tracking-wide text-zinc-500 uppercase";

interface GamePlanCardProps {
  plan: GamePlan;
  /** Position in the matchup's plans — 0 is Plan A. */
  index: number;
  total: number;
  myTeam: ParsedPokemon[];
  theirTeam: ParsedPokemon[];
  /** Your team's calcs against their team — each pick's hover card shows the ones against the other side's picks. */
  calcs: TeamCalc[];
  onChange: (updater: (plan: GamePlan) => GamePlan) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * One plan of a matchup, on the matchup page: what you expect them to bring
 * (their lead and back, picked from their roster), what you bring against
 * it, and how you play it (rich text). Plan A is the first; the arrows
 * reorder. (The Matchup Planner card shows only your side — see OpponentCard.)
 */
export function GamePlanCard({
  plan,
  index,
  total,
  myTeam,
  theirTeam,
  calcs,
  onChange,
  onMove,
  onRemove,
}: GamePlanCardProps) {
  const t = useMessages();
  const name = t.matchupPage.plan(planLetter(index));
  const theirSlots = leadBackSlotProps<PlanPicks>(
    plan.theirs ?? EMPTY_PICKS,
    theirTeam,
    (updater) => onChange((p) => ({ ...p, theirs: updater(p.theirs ?? EMPTY_PICKS) })),
    t,
  );
  const mySlots = leadBackSlotProps(plan, myTeam, onChange, t, { flexBack: true });

  // Each pick's calcs are against the other side's picks, in the form each
  // is shown in (Mega or not) — or its whole team, either form, while it
  // has none.
  const picked = (picks: PlanPicks, roster: ParsedPokemon[]): CalcSideMon[] => {
    const group = leadBackToGroup(picks);
    const megas = effectiveMegas(group, roster);
    return group.picks.flatMap((index, slot) => {
      const mon = index === null ? undefined : roster[index];
      return mon ? [formOf(mon, megas[slot])] : [];
    });
  };
  // Back 2's alternative counts as one of your picks too.
  const back2Flex = mySlots(BACK_2).flex;
  const myAlternative =
    back2Flex?.alternative != null
      ? formOf(myTeam[back2Flex.alternative], back2Flex.alternativeMega)
      : undefined;
  const myPicks = [...picked(plan, myTeam), ...(myAlternative ? [myAlternative] : [])];
  const theirPicks = picked(plan.theirs ?? EMPTY_PICKS, theirTeam);
  // Rows are grouped under the Pokémon on the other side of each calc, per
  // form — a Mega's group shows its Mega sprite.
  const counterpart = (roster: ParsedPokemon[], species: CalcSpecies | undefined) => {
    if (!species) return undefined;
    const mon = roster.find((mon) => speciesIdentity(mon.species) === species.identity);
    return {
      key: species.spriteKey,
      species:
        isMegaForm(species) || !mon ? formatSpeciesDisplayName(species.spriteKey) : mon.species,
    };
  };
  const slotCalcs = (
    side: "mine" | "theirs",
    slot: number,
    mon: ParsedPokemon | undefined,
    mega: boolean,
  ): SlotCalcs | undefined => {
    if (!mon) return undefined;
    const others = side === "mine" ? theirPicks : myPicks;
    const wholeTeam = others.length === 0;
    const otherSide = wholeTeam ? (side === "mine" ? theirTeam : myTeam) : others;
    const self = formOf(mon, mega);
    return {
      ...(side === "mine"
        ? calcsBetween(calcs, [self], otherSide)
        : calcsBetween(calcs, otherSide, [self])),
      alternative:
        side === "mine" && slot === BACK_2 && myAlternative
          ? calcsBetween(calcs, [myAlternative], otherSide)
          : undefined,
      counterpart:
        side === "mine"
          ? (calc) => counterpart(theirTeam, calcThreat(calc))
          : (calc) => counterpart(myTeam, calcOwnSpecies(calc)),
      wholeTeam,
    };
  };

  const pickRow = (
    side: "mine" | "theirs",
    slots: typeof mySlots,
    rows: [string, readonly [number, number]][],
  ) => (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {rows.map(([label, pair]) => (
        <div key={label} className="flex flex-col gap-1">
          <h4 className={LABEL_CLASSES}>{label}</h4>
          <div className="flex gap-2">
            {pair.map((slot) => {
              const props = slots(slot);
              const mon = props.value === null ? undefined : props.myTeamPokemon[props.value];
              return (
                <PokemonSlotPicker
                  key={slot}
                  {...props}
                  calcs={slotCalcs(side, slot, mon, props.megaEnabled)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <section
      aria-label={name}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{name}</h3>
        <PlanControls name={name} index={index} total={total} onMove={onMove} onRemove={onRemove} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
        {/* What they bring on top, your answer below; the game plan beside them from md up. */}
        <div className="flex flex-col gap-3">
          {pickRow("theirs", theirSlots, [
            [t.matchupPage.theirLead, [0, 1]],
            [t.matchupPage.theirBack, [2, 3]],
          ])}
          {pickRow("mine", mySlots, [
            [t.matchupPage.yourLead, [0, 1]],
            [t.matchupPage.yourBack, [2, 3]],
          ])}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h4 className={LABEL_CLASSES}>{t.opponentCard.gamePlan}</h4>
          <RichTextEditor
            value={notesToHtml(plan.notes)}
            onChange={(notes) => onChange((p) => ({ ...p, notes }))}
            size="medium"
            placeholder={t.matchupPage.planNotesPlaceholder}
            ariaLabel={`${name} — ${t.opponentCard.gamePlan}`}
          />
        </div>
      </div>
    </section>
  );
}

/** A plan's ▲ / ▼ / remove buttons — shared with the Matchup Planner card's plan rows. */
export function PlanControls({
  name,
  index,
  total,
  onMove,
  onRemove,
  removeLabel: removeLabelOverride,
}: {
  name: string;
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  /** The trash button's label, for a list that isn't a matchup's plans. */
  removeLabel?: string;
}) {
  const t = useMessages();
  // The last plan left is cleared rather than removed — a matchup always has Plan A.
  const removeLabel =
    removeLabelOverride ??
    (total > 1 ? t.matchupPage.removePlan(name) : t.matchupPage.clearPlan(name));
  return (
    <div className="flex items-center gap-1">
      <IconButton
        variant="ghost"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        aria-label={t.matchupPage.moveUp(name)}
        title={t.matchupPage.moveUp(name)}
        className="disabled:opacity-30"
      >
        <Icon name={IconName.ArrowUpward} size={14} />
      </IconButton>
      <IconButton
        variant="ghost"
        onClick={() => onMove(1)}
        disabled={index === total - 1}
        aria-label={t.matchupPage.moveDown(name)}
        title={t.matchupPage.moveDown(name)}
        className="disabled:opacity-30"
      >
        <Icon name={IconName.ArrowDownward} size={14} />
      </IconButton>
      <IconButton
        variant="ghost"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="hover:text-red-600"
      >
        <Icon name={IconName.Delete} size={14} />
      </IconButton>
    </div>
  );
}
