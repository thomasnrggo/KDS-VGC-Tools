import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { parseRole, type Role, type StaffRole } from "@/lib/admin";
import { db } from "./firestore";

/**
 * Staff roles — `roles/{uid}`, one doc per moderator or admin (a regular
 * user has none). Each person reads only their own; admins read and write
 * them all (see firestore.rules). See src/lib/admin.ts for what each role
 * may do.
 */
export interface StaffMember {
  uid: string;
  role: StaffRole;
  email: string;
  displayName?: string;
  /** The admin who last set it. */
  setBy: string;
  /** ISO timestamp. */
  setAt: string;
}

/**
 * Who has signed in — `profiles/{uid}`, saved on each sign-in so an admin
 * can find someone by email at /admin/users (the browser can't look up
 * Firebase Auth accounts). Each person writes their own; only admins read.
 */
export interface UserProfile {
  uid: string;
  email: string;
  /** Lowercased, for the prefix search. */
  emailLower: string;
  displayName?: string;
  photoURL?: string;
  /** ISO timestamp. */
  lastSignInAt: string;
}

const ROLES = "roles";
const PROFILES = "profiles";

export async function getRole(uid: string): Promise<Role> {
  const snap = await getDoc(doc(db, ROLES, uid));
  return snap.exists() ? parseRole(snap.data().role) : "user";
}

export async function listStaff(): Promise<StaffMember[]> {
  const snap = await getDocs(collection(db, ROLES));
  return snap.docs
    .map((entry) => ({ ...(entry.data() as StaffMember), uid: entry.id }))
    .filter((member) => parseRole(member.role) !== "user");
}

export async function setStaffRole(member: StaffMember): Promise<void> {
  await setDoc(doc(db, ROLES, member.uid), withoutUndefined(member));
}

export async function removeStaffRole(uid: string): Promise<void> {
  await deleteDoc(doc(db, ROLES, uid));
}

export async function saveProfile(user: User): Promise<void> {
  if (!user.email) return;
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    emailLower: user.email.toLowerCase(),
    displayName: user.displayName ?? undefined,
    photoURL: user.photoURL ?? undefined,
    lastSignInAt: new Date().toISOString(),
  };
  await setDoc(doc(db, PROFILES, user.uid), withoutUndefined(profile));
}

/** Up to 10 people whose email starts with `text` (case-insensitive). */
export async function searchProfiles(text: string): Promise<UserProfile[]> {
  const prefix = text.trim().toLowerCase();
  if (!prefix) return [];
  const snap = await getDocs(
    query(
      collection(db, PROFILES),
      where("emailLower", ">=", prefix),
      where("emailLower", "<", `${prefix}`),
      limit(10),
    ),
  );
  return snap.docs.map((entry) => entry.data() as UserProfile);
}

/** Firestore rejects `undefined` fields. */
function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}
