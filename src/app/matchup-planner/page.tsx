"use client";

import { useState } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { useOpponents } from "@/hooks/useOpponents";
import { useGroups } from "@/hooks/useGroups";
import { useGroupOpponents } from "@/hooks/useGroupOpponents";
import { useMessages } from "@/hooks/useLanguage";
import { setPlannerSource, usePlannerSource } from "@/hooks/usePlannerSource";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { OpponentsSection } from "@/components/OpponentsSection";
import {
  CopyToGroupDialog,
  CreateGroupDialog,
  GroupBar,
  PlannerSourcePicker,
} from "@/components/PrepGroups";
import { toast } from "@/components/Toast";
import { IconName } from "@/enums";
import { saveGroupOpponent, saveGroupPlan } from "@/lib/firebase";
import { copyOpponent, splitGroupOpponent } from "@/lib/groupOpponents";
import { generateId } from "@/lib/id";
import { REGULATIONS } from "@/data/regulations";
import type { Opponent, PrepGroup } from "@/types";

export default function MatchupPlanner() {
  const t = useMessages();
  const {
    activeTeams,
    activeTeam,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
  } = useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [pickedRegulationId, setSelectedRegulationId] = useState(REGULATIONS[0]?.id ?? "");

  // Which opponent list is open: your own, or one of your prep groups (see
  // docs/prep-groups.md). Both lists stay loaded so copying between them is
  // instant; a group you've left falls back to your own list.
  const personal = useOpponents();
  const groupsApi = useGroups();
  const source = usePlannerSource();
  const group = groupsApi.groups.find((g) => g.id === source) ?? null;
  const groupList = useGroupOpponents(group);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [copyingOpponent, setCopyingOpponent] = useState<Opponent | null>(null);

  // A group belongs to one regulation, so it drives the filter while open.
  const selectedRegulationId = group ? group.regulationId : pickedRegulationId;

  // The active team is never auto-swapped just because the regulation filter
  // changed (see MyTeamHeader) — but Lead/Back picking is blocked whenever it
  // doesn't match, rather than letting you build a plan against a team that
  // isn't actually legal for the regulation you're viewing.
  const activeTeamMatchesRegulation = activeTeam
    ? activeTeam.regulationIds.includes(selectedRegulationId)
    : false;

  async function createGroup(name: string, regulationId: string) {
    const created = await groupsApi.createGroup(name, regulationId);
    if (created) setPlannerSource(created.id);
    setIsCreatingGroup(false);
  }

  async function copyToGroup(opponent: Opponent, target: PrepGroup) {
    if (!user) return;
    const copy = copyOpponent(opponent, generateId(), {
      uid: user.uid,
      name: user.displayName ?? undefined,
    });
    const { shared, plan } = splitGroupOpponent(copy, target.id);
    await saveGroupOpponent(target.id, shared);
    if (Object.keys(plan.plansByTeamId).length > 0) await saveGroupPlan(user.uid, plan);
    toast.success(t.groups.copiedToGroup(opponent.label, target.name));
    setCopyingOpponent(null);
  }

  function copyToMine(opponent: Opponent) {
    personal.addOpponents([copyOpponent(opponent, generateId())]);
    toast.success(t.groups.copiedToMine(opponent.label));
  }

  const title = (
    <PlannerSourcePicker
      source={group ? group.id : "personal"}
      activeGroups={groupsApi.activeGroups}
      archivedGroups={groupsApi.archivedGroups}
      isSignedIn={!!user}
      onSelect={setPlannerSource}
      onCreateGroup={() => setIsCreatingGroup(true)}
      onSignIn={signInWithGoogle}
    />
  );

  const banner =
    group && user ? (
      <>
        <GroupBar
          group={group}
          uid={user.uid}
          onRename={(name) => groupsApi.renameGroup(group, name)}
          onSetArchived={(archived) => groupsApi.setArchived(group, archived)}
          onResetInvite={() => groupsApi.resetInvite(group)}
          onRemoveMember={(memberUid) => groupsApi.removeMember(group, memberUid)}
          onLeave={async () => {
            await groupsApi.leaveGroup(group);
            setPlannerSource("personal");
          }}
        />
        {groupList.error && (
          <p role="alert" className="text-sm text-red-600">
            {t.groups.loadFailed}
          </p>
        )}
      </>
    ) : null;

  return (
    <div className="flex flex-1 flex-col">
      <MyTeamHeader
        teams={activeTeams}
        activeTeamId={activeTeamId}
        isLoading={isLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
        currentPage="matchup-planner"
        selectedRegulationId={selectedRegulationId}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex w-full flex-col gap-6 p-6">
        <OpponentsSection
          // Remount per list, so view state (expanded variants, search,
          // dialogs) doesn't carry over between your list and a group.
          key={group ? group.id : "personal"}
          source={group ? groupList : personal}
          title={title}
          banner={banner}
          regulationLocked={!!group}
          canClearAll={!group || group.ownerUid === user?.uid}
          addedByLabel={
            group
              ? (opponent) =>
                  opponent.addedBy === user?.uid
                    ? t.groups.addedByYou
                    : opponent.addedByName
                      ? t.groups.addedBy(opponent.addedByName)
                      : undefined
              : undefined
          }
          // The calculator finds a group's opponent through ?groupId=.
          calcHref={(opponent) =>
            group
              ? `/damage-calc?groupId=${group.id}&opponentId=${opponent.id}`
              : `/damage-calc?opponentId=${opponent.id}`
          }
          cardActions={(opponent) =>
            group
              ? [{ label: t.groups.copyToMine, icon: IconName.ContentCopy, onClick: () => copyToMine(opponent) }]
              : [
                  ...(groupsApi.activeGroups.length > 0
                    ? [
                        {
                          label: t.groups.copyToGroup,
                          icon: IconName.Group,
                          onClick: () => setCopyingOpponent(opponent),
                        },
                      ]
                    : []),
                ]
          }
          myTeamPokemon={activeTeam?.pokemon ?? []}
          activeTeamId={activeTeamId}
          activeTeamMatchesRegulation={activeTeamMatchesRegulation}
          selectedRegulationId={selectedRegulationId}
          setSelectedRegulationId={setSelectedRegulationId}
        />
      </div>

      {isCreatingGroup && (
        <CreateGroupDialog
          defaultRegulationId={selectedRegulationId}
          onCreate={createGroup}
          onClose={() => setIsCreatingGroup(false)}
        />
      )}
      {copyingOpponent && (
        <CopyToGroupDialog
          opponent={copyingOpponent}
          groups={groupsApi.activeGroups.filter(
            (g) => g.regulationId === copyingOpponent.regulationId,
          )}
          onCopy={(target) => copyToGroup(copyingOpponent, target)}
          onClose={() => setCopyingOpponent(null)}
        />
      )}
    </div>
  );
}
