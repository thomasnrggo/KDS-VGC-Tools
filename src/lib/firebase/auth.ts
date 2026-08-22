import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from "firebase/auth";
import { firebaseApp } from "./config";

export const auth = getAuth(firebaseApp);

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}
