"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { useGroups } from "@/hooks/useGroups";
import { useMessages } from "@/hooks/useLanguage";
import { setPlannerSource } from "@/hooks/usePlannerSource";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { getInvite, joinGroup } from "@/lib/firebase";
import { REGULATIONS } from "@/data/regulations";
import type { GroupInvite } from "@/types";

interface JoinGroupPageProps {
  params: Promise<{ code: string }>;
}

const PRIMARY_BUTTON =
  "rounded-full bg-zinc-600 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-400 dark:hover:bg-zinc-300";

/**
 * A prep group's invite link (see docs/prep-groups.md): shows which group
 * it's for and joins it. Reading an invite needs sign-in, so signed out it
 * only offers that.
 */
export default function JoinGroupPage({ params }: JoinGroupPageProps) {
  const t = useMessages();
  const { code } = use(params);
  const router = useRouter();
  const {
    activeTeams,
    activeTeamId,
    isLoading: isTeamsLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
  } = useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const { groups } = useGroups();
  const [invite, setInvite] = useState<
    { code: string; state: "missing" | "error" } | { code: string; state: "ready"; invite: GroupInvite } | null
  >(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState(false);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getInvite(code)
      .then((found) => {
        if (cancelled) return;
        setInvite(found ? { code, state: "ready", invite: found } : { code, state: "missing" });
      })
      .catch((error) => {
        console.error("[prep group] invite load failed:", error);
        if (!cancelled) setInvite({ code, state: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [code, uid]);

  const loaded = invite?.code === code ? invite : null;
  const groupId = loaded?.state === "ready" ? loaded.invite.groupId : null;
  const isMember = !!groupId && groups.some((group) => group.id === groupId);

  function openGroup() {
    if (!groupId) return;
    setPlannerSource(groupId);
    router.push("/matchup-planner");
  }

  async function join() {
    if (!user || loaded?.state !== "ready") return;
    setIsJoining(true);
    setJoinError(false);
    try {
      await joinGroup(code, loaded.invite, {
        uid: user.uid,
        name: user.displayName ?? user.email ?? "?",
        photoURL: user.photoURL ?? undefined,
      });
      openGroup();
    } catch (error) {
      console.error("[prep group] join failed:", error);
      setJoinError(true);
      setIsJoining(false);
    }
  }

  let body;
  if (isAuthLoading) {
    body = <p className="text-sm text-zinc-500">{t.common.loading}</p>;
  } else if (!user) {
    body = (
      <>
        <p className="text-sm text-zinc-600">{t.groups.join.explain}</p>
        <button type="button" onClick={signInWithGoogle} className={PRIMARY_BUTTON}>
          {t.groups.join.signIn}
        </button>
      </>
    );
  } else if (!loaded) {
    body = <p className="text-sm text-zinc-500">{t.common.loading}</p>;
  } else if (loaded.state !== "ready") {
    body = (
      <p className="text-sm text-zinc-600">
        {loaded.state === "missing" ? t.groups.join.invalid : t.groups.join.failed}
      </p>
    );
  } else {
    body = (
      <>
        <p className="text-lg font-semibold text-zinc-900">
          {t.groups.join.invited(loaded.invite.groupName)}
        </p>
        <p className="text-sm text-zinc-600">
          {isMember ? t.groups.join.alreadyMember : t.groups.join.explain}
        </p>
        {isMember ? (
          <button type="button" onClick={openGroup} className={PRIMARY_BUTTON}>
            {t.groups.join.open}
          </button>
        ) : (
          <button type="button" onClick={() => void join()} disabled={isJoining} className={PRIMARY_BUTTON}>
            {isJoining ? t.groups.join.joining : t.groups.join.join}
          </button>
        )}
        {joinError && (
          <p role="alert" className="text-sm text-red-600">
            {t.groups.join.failed}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <MyTeamHeader
        teams={activeTeams}
        activeTeamId={activeTeamId}
        isLoading={isTeamsLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
        currentPage="matchup-planner"
        selectedRegulationId={REGULATIONS[0]?.id ?? ""}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex flex-1 items-start justify-center p-6">
        <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-zinc-600">
            <Icon name={IconName.Group} size={26} />
          </span>
          <h1 className="text-xl font-semibold text-zinc-900">{t.groups.join.title}</h1>
          {body}
        </div>
      </div>
    </div>
  );
}
