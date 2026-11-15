"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pullMetaDoc, pushMetaDoc } from "@/lib/firebase";
import {
  EMPTY_PLAYER_PROFILE,
  PLAYER_PROFILE_DOC,
  isEmptyPlayerProfile,
  loadLocalPlayerProfile,
  normalizePlayerProfile,
  saveLocalPlayerProfile,
  type PlayerProfile,
} from "@/lib/playerProfile";

/**
 * The player profile (src/lib/playerProfile.ts): this device's copy, replaced
 * by the account's once signed in. The first sign-in with an empty account
 * uploads what this device had, so details typed before signing in aren't lost.
 */
export function usePlayerProfile() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile>(EMPTY_PLAYER_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;

    async function load(): Promise<PlayerProfile> {
      const local = loadLocalPlayerProfile();
      if (!uid) return local;
      try {
        const remote = await pullMetaDoc<unknown>(uid, PLAYER_PROFILE_DOC);
        if (remote) {
          const synced = normalizePlayerProfile(remote);
          saveLocalPlayerProfile(synced);
          return synced;
        }
        if (!isEmptyPlayerProfile(local)) {
          await pushMetaDoc(uid, PLAYER_PROFILE_DOC, { ...local });
        }
      } catch (error) {
        console.error("[playerProfile] sync failed:", error);
      }
      return local;
    }

    load().then((loaded) => {
      if (cancelled) return;
      setProfile(loaded);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, isAuthLoading]);

  /** Saves on this device, and to the account when signed in (throws if that fails). */
  async function save(next: PlayerProfile) {
    const clean = normalizePlayerProfile(next);
    saveLocalPlayerProfile(clean);
    setProfile(clean);
    if (uid) await pushMetaDoc(uid, PLAYER_PROFILE_DOC, { ...clean });
  }

  return { profile, isLoading, isSignedIn: !!uid, save };
}
