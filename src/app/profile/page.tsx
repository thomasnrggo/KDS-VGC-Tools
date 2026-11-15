"use client";

import { useState } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useLanguage";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { PlayerProfileFields } from "@/components/PlayerProfileFields";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { REGULATIONS } from "@/data/regulations";
import { samePlayerProfile, type PlayerProfile } from "@/lib/playerProfile";

/**
 * The player profile (src/lib/playerProfile.ts): tournament details the team
 * list PDF fills in. Private to the account when signed in, this device's
 * otherwise.
 */
export default function ProfilePage() {
  const t = useMessages();
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
  const { profile, isLoading, isSignedIn, save } = usePlayerProfile();
  // Only once something is typed — until then it follows the profile as it loads.
  const [draft, setDraft] = useState<PlayerProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const value = draft ?? profile;
  const isChanged = !!draft && !samePlayerProfile(draft, profile);

  async function handleSave() {
    if (!draft) return;
    setIsSaving(true);
    try {
      await save(draft);
      setDraft(null);
      toast.success(t.playerProfile.saved);
    } catch (error) {
      console.error("[playerProfile] save failed:", error);
      toast.error(t.playerProfile.saveFailed);
    } finally {
      setIsSaving(false);
    }
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
        currentPage="profile"
        selectedRegulationId={REGULATIONS[0]?.id ?? ""}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-zinc-900">{t.playerProfile.title}</h2>
          <p className="text-sm text-zinc-600">
            {isSignedIn ? t.playerProfile.introSignedIn : t.playerProfile.intro}
          </p>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
            className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-raised p-4 sm:p-5"
          >
            <PlayerProfileFields value={value} onChange={setDraft} />
            <div className="flex justify-end gap-2">
              {isChanged && (
                <Button
                  variant="outline"
                  onClick={() => setDraft(null)}
                  className="px-4 py-2 text-sm"
                >
                  {t.common.cancel}
                </Button>
              )}
              <Button type="submit" disabled={!isChanged || isSaving} className="px-4 py-2 text-sm">
                {isSaving ? t.common.saving : t.common.save}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
