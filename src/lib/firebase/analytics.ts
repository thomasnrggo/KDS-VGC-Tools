import { type Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { firebaseApp } from "./config";

let analyticsPromise: Promise<Analytics | null> | undefined;

/**
 * Lazily initializes Firebase Analytics. Unlike the console's setup snippet,
 * this can't run eagerly at module load: `getAnalytics` touches `window`
 * (breaks server-side rendering) and isn't supported everywhere (Safari
 * private browsing, bots, older browsers) — `isSupported()` guards that.
 */
export function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  if (!analyticsPromise) {
    analyticsPromise = isSupported().then((supported) =>
      supported ? getAnalytics(firebaseApp) : null,
    );
  }
  return analyticsPromise;
}
