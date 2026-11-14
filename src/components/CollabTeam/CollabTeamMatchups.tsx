"use client";

import { useState } from "react";
import { OpponentsSection } from "../OpponentsSection";
import { AddFromListDialog } from "../PrepGroups";
import { toast } from "../Toast";
import { IconName } from "@/enums";
import { useAuth } from "@/hooks/useAuth";
import { useGroupOpponents } from "@/hooks/useGroupOpponents";
import { useGroups } from "@/hooks/useGroups";
import { useMessages } from "@/hooks/useLanguage";
import { useOpponents } from "@/hooks/useOpponents";
import { copyOpponent, copyOpponentsInto } from "@/lib/groupOpponents";
import { generateId } from "@/lib/id";
import type { Opponent, PrepGroup, Team } from "@/types";

/**
 * A collaborative team's matchups, on its Matchups tab: the team's group's
 * opponents, with the plan every member shares — added, edited and planned
 * here, like a Matchup Planner list (the planner itself only offers prep
 * groups). See docs/collaborative-teams.md.
 */
export function CollabTeamMatchups({ team, group }: { team: Team; group: PrepGroup }) {
  const t = useMessages();
  const { user } = useAuth();
  const list = useGroupOpponents(group);
  const personal = useOpponents();
  const { prepGroups } = useGroups();
  const [isAddingFromList, setIsAddingFromList] = useState(false);
  const regulationId = group.regulationId;

  // Copies teams from your own list or a prep group into the team's matchups.
  function addFromList(opponents: Opponent[]) {
    const inRegulation = list.opponents.filter((o) => o.regulationId === regulationId);
    list.addOpponents(
      copyOpponentsInto(
        opponents,
        inRegulation,
        generateId,
        user ? { uid: user.uid, name: user.displayName ?? undefined } : undefined,
      ),
    );
    toast.success(t.groups.addFrom.added(opponents.length, team.name));
    setIsAddingFromList(false);
  }

  function copyToMine(opponent: Opponent) {
    personal.addOpponents([copyOpponent(opponent, generateId())]);
    toast.success(t.groups.copiedToMine(opponent.label));
  }

  return (
    <>
      <OpponentsSection
        source={list}
        // OpponentsSection puts it in its own heading.
        title={t.teamPage.tabs.matchups}
        regulationLocked
        canClearAll={group.ownerUid === user?.uid}
        onAddFromList={user ? () => setIsAddingFromList(true) : undefined}
        matchupHref={(opponent) => `/teams/${team.id}/matchups/${opponent.id}?groupId=${group.id}`}
        calcHref={(opponent) => `/damage-calc?groupId=${group.id}&opponentId=${opponent.id}`}
        cardActions={(opponent) => [
          {
            label: t.groups.copyToMine,
            icon: IconName.ContentCopy,
            onClick: () => copyToMine(opponent),
          },
        ]}
        // Planned with this team: its shared plan (see useGroupOpponents).
        myTeamPokemon={team.pokemon}
        activeTeamId={team.id}
        activeTeamMatchesRegulation
        selectedRegulationId={regulationId}
        setSelectedRegulationId={() => {}}
      />
      {isAddingFromList && (
        <AddFromListDialog
          targetName={team.name}
          regulationId={regulationId}
          targetOpponents={list.opponents.filter((o) => o.regulationId === regulationId)}
          myOpponents={personal.opponents}
          groups={prepGroups.filter((g) => g.regulationId === regulationId)}
          onAdd={addFromList}
          onClose={() => setIsAddingFromList(false)}
        />
      )}
    </>
  );
}
