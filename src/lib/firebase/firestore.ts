import {
  type Firestore,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { firebaseApp } from "./config";

// Team/Opponent/ParsedPokemon all have several optional string fields
// (pokepasteUrl, item, ability, nature, evs, ...) that are simply absent —
// `undefined` — rather than `null` when unset. Firestore's default setDoc()
// rejects any `undefined` field value outright; ignoreUndefinedProperties
// makes it silently omit those fields instead, matching how they already
// behave in IndexedDB, without needing to sanitize every optional field at
// every call site.
//
// In the browser, Firestore also keeps a copy of what it has read (IndexedDB,
// shared across tabs): live listeners — your prep groups and a group's
// opponents — answer from it instantly on a reload, then update if the server
// has anything newer, instead of every page load waiting on the network.
// The server (prerendering) has no IndexedDB, so it keeps the default.
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(firebaseApp, {
    ignoreUndefinedProperties: true,
    localCache:
      typeof window === "undefined"
        ? memoryLocalCache()
        : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  // Next's Fast Refresh re-evaluates this module without restarting the
  // page — initializeFirestore throws on a second call for the same app, so
  // fall back to the already-configured instance instead of crashing.
  firestoreInstance = getFirestore(firebaseApp);
}

export const db = firestoreInstance;
