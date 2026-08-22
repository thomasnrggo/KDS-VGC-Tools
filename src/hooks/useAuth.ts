"use client";

import { useEffect, useState } from "react";
import { type User, onAuthStateChanged } from "firebase/auth";
import { auth, signInWithGoogle as signInWithGooglePopup, signOutUser } from "@/lib/firebase";
import { toast } from "@/components/Toast";

// Firebase throws these when the user closes/abandons the popup themselves —
// not a real failure, so don't surface an error toast for them.
const POPUP_DISMISSED_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
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
      toast.error("Couldn't sign in with Google.");
    }
  }

  async function signOut() {
    try {
      await signOutUser();
    } catch {
      toast.error("Couldn't sign out.");
    }
  }

  return { user, isLoading, signInWithGoogle, signOut };
}
