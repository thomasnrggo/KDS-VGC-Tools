"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AuthMenu } from "@/components/AuthMenu";
import { Button } from "@/components/Button";
import { SearchField } from "@/components/SearchField";
import { Select } from "@/components/Select";
import { toast } from "@/components/Toast";
import {
  listStaff,
  removeStaffRole,
  searchProfiles,
  setStaffRole,
  type StaffMember,
  type UserProfile,
} from "@/lib/firebase";
import { isOwnerUid, type StaffRole } from "@/lib/admin";

const ROLE_LABELS: Record<StaffRole, string> = { moderator: "Moderator", admin: "Admin" };
const ROLE_OPTIONS = [
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
];
const ROLE_HINTS: Record<StaffRole, string> = {
  moderator: "Meta sets, public calc sets, seasons and learnsets; sees previews.",
  admin: "Everything a moderator can, plus feature flags and roles.",
};

/**
 * Who's staff (see src/lib/admin.ts): the moderators and admins, each
 * with a role picker and Remove, and a search by email over everyone
 * who's signed in (profiles/) to add someone. Admins only. Your own role
 * can't be changed here, and the owner is always an admin.
 */
export default function AdminUsersPage() {
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[] | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    listStaff()
      .then((members) => {
        if (!cancelled) setStaff(sortStaff(members));
      })
      .catch((error) => {
        console.error("[admin/users] load failed:", error);
        if (!cancelled) setStaff([]);
        toast.error("Couldn't load the staff list. Are the Firestore rules published?");
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function search(event: FormEvent) {
    event.preventDefault();
    try {
      setResults(await searchProfiles(query));
    } catch (error) {
      console.error("[admin/users] search failed:", error);
      toast.error("Couldn't search. Are the Firestore rules published?");
    }
  }

  async function assign(
    person: { uid: string; email: string; displayName?: string },
    role: StaffRole,
  ) {
    if (!user) return;
    const member: StaffMember = {
      uid: person.uid,
      role,
      email: person.email,
      displayName: person.displayName,
      setBy: user.email ?? user.uid,
      setAt: new Date().toISOString(),
    };
    setBusyUid(person.uid);
    try {
      await setStaffRole(member);
      setStaff((current) =>
        sortStaff([...(current ?? []).filter((other) => other.uid !== person.uid), member]),
      );
      toast.success(`${person.displayName || person.email} is now ${ROLE_LABELS[role]}`);
    } catch (error) {
      console.error("[admin/users] save failed:", error);
      toast.error("Couldn't save that role.");
    } finally {
      setBusyUid(null);
    }
  }

  async function remove(member: StaffMember) {
    setBusyUid(member.uid);
    try {
      await removeStaffRole(member.uid);
      setStaff((current) => (current ?? []).filter((other) => other.uid !== member.uid));
      toast.success(`${member.displayName || member.email} is a regular user again`);
    } catch (error) {
      console.error("[admin/users] remove failed:", error);
      toast.error("Couldn't remove that role.");
    } finally {
      setBusyUid(null);
    }
  }

  if (isAuthLoading || (user && roleLoading)) return null;

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-zinc-700">Sign in to continue.</p>
        <Button onClick={signInWithGoogle}>Sign in with Google</Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-zinc-900">Not authorized</p>
        <p className="text-sm text-zinc-600">This page is only available to admins.</p>
        <Link href="/matchup-planner" className="text-sm font-medium text-zinc-600 hover:underline">
          ← Back to Matchup Planner
        </Link>
      </div>
    );
  }

  const staffRole = (uid: string) => staff?.find((member) => member.uid === uid)?.role;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-chrome-600 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/features"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            ← Features
          </Link>
          <h1 className="text-lg font-semibold text-white">Admin: Users</h1>
        </div>
        <AuthMenu
          user={user}
          isLoading={isAuthLoading}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
        />
      </header>

      <div className="flex w-full max-w-2xl flex-col gap-8 p-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Staff</h2>
          <ul className="flex flex-col gap-1 text-xs text-zinc-500">
            {(["moderator", "admin"] as const).map((role) => (
              <li key={role}>
                <span className="font-semibold text-zinc-700">{ROLE_LABELS[role]}:</span>{" "}
                {ROLE_HINTS[role]}
              </li>
            ))}
          </ul>
          {staff === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-raised">
              <li className="flex items-center gap-3 px-3 py-2.5">
                <PersonLabel
                  name="Site owner"
                  detail={isOwnerUid(user.uid) ? (user.email ?? "") : "Set in the app's config"}
                />
                <span className="text-xs font-medium text-zinc-500">Admin, always</span>
              </li>
              {staff.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-zinc-500">
                  No moderators or other admins yet.
                </li>
              )}
              {staff.map((member) => {
                const isSelf = member.uid === user.uid;
                return (
                  <li key={member.uid} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <PersonLabel
                      name={member.displayName || member.email}
                      detail={`${member.email} · set by ${member.setBy}`}
                    />
                    {isSelf ? (
                      <span className="text-xs font-medium text-zinc-500">
                        {ROLE_LABELS[member.role]} (you)
                      </span>
                    ) : (
                      <>
                        <Select
                          value={member.role}
                          onChange={(role) => assign(member, role as StaffRole)}
                          options={ROLE_OPTIONS}
                          ariaLabel={`Role of ${member.email}`}
                        />
                        <Button
                          variant="danger"
                          onClick={() => remove(member)}
                          disabled={busyUid === member.uid}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Add someone</h2>
          <p className="text-xs text-zinc-500">
            Search by email. Only people who have signed in to the app at least once can be found.
          </p>
          <form onSubmit={search} className="flex flex-wrap items-center gap-2">
            <SearchField
              query={query}
              onQueryChange={setQuery}
              placeholder="Email, e.g. name@gmail.com"
              ariaLabel="Search people by email"
              className="w-full sm:w-80"
            />
            <Button type="submit" variant="outline" disabled={!query.trim()}>
              Search
            </Button>
          </form>
          {results !== null &&
            (results.length === 0 ? (
              <p className="text-sm text-zinc-500">No one who has signed in matches that email.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-raised">
                {results.map((profile) => {
                  const current = isOwnerUid(profile.uid) ? "admin" : staffRole(profile.uid);
                  return (
                    <li key={profile.uid} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <PersonLabel
                        name={profile.displayName || profile.email}
                        detail={profile.email}
                      />
                      {current ? (
                        <span className="text-xs font-medium text-zinc-500">
                          {ROLE_LABELS[current]}
                        </span>
                      ) : (
                        (["moderator", "admin"] as const).map((role) => (
                          <Button
                            key={role}
                            variant="outline"
                            onClick={() => assign(profile, role)}
                            disabled={busyUid === profile.uid}
                          >
                            Make {ROLE_LABELS[role].toLowerCase()}
                          </Button>
                        ))
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
        </section>
      </div>
    </div>
  );
}

function PersonLabel({ name, detail }: { name: string; detail: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-medium text-zinc-900">{name}</span>
      <span className="truncate text-xs text-zinc-500">{detail}</span>
    </span>
  );
}

/** Admins first, then by name. */
function sortStaff(members: StaffMember[]): StaffMember[] {
  return [...members].sort(
    (a, b) =>
      (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1) ||
      (a.displayName || a.email).localeCompare(b.displayName || b.email),
  );
}
