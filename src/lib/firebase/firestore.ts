import { type Firestore, getFirestore, initializeFirestore } from "firebase/firestore";
import { firebaseApp } from "./config";

// Team/Opponent/ParsedPokemon all have several optional string fields
// (pokepasteUrl, item, ability, nature, evs, ...) that are simply absent —
// `undefined` — rather than `null` when unset. Firestore's default setDoc()
// rejects any `undefined` field value outright; ignoreUndefinedProperties
// makes it silently omit those fields instead, matching how they already
// behave in IndexedDB, without needing to sanitize every optional field at
// every call site.
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
} catch {
  // Next's Fast Refresh re-evaluates this module without restarting the
  // page — initializeFirestore throws on a second call for the same app, so
  // fall back to the already-configured instance instead of crashing.
  firestoreInstance = getFirestore(firebaseApp);
}

export const db = firestoreInstance;
