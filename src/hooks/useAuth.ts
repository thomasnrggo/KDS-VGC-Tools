"use client";

import { useEffect, useState } from "react";
import { type User, onAuthStateChanged } from "firebase/auth";
import {
  auth,
  saveProfile,
  signInWithGoogle as signInWithGooglePopup,
  signOutUser,
} from "@/lib/firebase";
import { toast } from "@/components/Toast";
import { getMessages } from "@/lib/i18n/settings";

// Firebase throws these when the user closes/abandons the popup themselves —
// not a real failure, so don't surface an error toast for them.
const POPUP_DISMISSED_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

/**
 * The last auth state Firebase reported, kept across page navigations — each
 * page mounts its own useAuth, and starting from "loading, signed out" every
 * time made the header's avatar (and everything keyed on the user, like the
 * cloud team sync) blink on each navigation. Firebase still reports any
 * change through the listener below.
 */
let knownAuth: { user: User | null } | null = null;

/** Whose profile (see saveProfile) this page load has already saved — once each, not per hook. */
const savedProfiles = new Set<string>();

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => knownAuth?.user ?? null);
  const [isLoading, setIsLoading] = useState(() => knownAuth === null);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      knownAuth = { user: nextUser };
      if (nextUser && !savedProfiles.has(nextUser.uid)) {
        savedProfiles.add(nextUser.uid);
        void saveProfile(nextUser).catch((error) =>
          console.error("[profiles] save failed:", error),
        );
      }
      setUser(nextUser);
      setIsLoading(false);
    });
  }, []);

  async function signInWithGoogle() {
    try {
      await signInWithGooglePopup();
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code && POPUP_DISMISSED_CODES.has(code)) return;
      toast.error(getMessages().errors.signInFailed);
    }
  }

  async function signOut() {
    try {
      await signOutUser();
    } catch {
      toast.error(getMessages().errors.signOutFailed);
    }
  }

  return { user, isLoading, signInWithGoogle, signOut };
}
