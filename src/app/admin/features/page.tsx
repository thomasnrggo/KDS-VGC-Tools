"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { AuthMenu } from "@/components/AuthMenu";
import { toast } from "@/components/Toast";
import type { FeatureFlags } from "@/types";
import { cn } from "@/lib/utils";

const SECTION_FLAGS: { flagKey: keyof FeatureFlags; label: string }[] = [
  { flagKey: "matchupPlanner", label: "Matchup Planner" },
  { flagKey: "teams", label: "My Teams" },
  { flagKey: "tournaments", label: "Tournaments" },
  { flagKey: "speedTiers", label: "Speed Tiers" },
];

function FlagToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-3">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-zinc-900">{label}</span>
        <span className="text-xs text-zinc-500">
          {active
            ? "Visible to everyone."
            : "Only visible to you (admin) — hidden from everyone else."}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={onClick}
        className={cn(
          "shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
          active ? "bg-chrome-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
        )}
      >
        {active ? "Enabled" : "Disabled"}
      </button>
    </div>
  );
}

export default function AdminFeaturesPage() {
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { flags, isLoading: flagsLoading, updateFlags } = useFeatureFlags();

  async function toggle(flagKey: keyof FeatureFlags) {
    const next = { ...flags, [flagKey]: !flags[flagKey] };
    try {
      await updateFlags(next);
      toast.success(
        `${SECTION_FLAGS.find((s) => s.flagKey === flagKey)?.label} ${next[flagKey] ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      console.error("[admin/features] save failed:", error);
      toast.error("Couldn't save that change.");
    }
  }

  if (isAuthLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-zinc-700">Sign in to continue.</p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="rounded-full bg-chrome-600 px-5 py-2 text-sm font-medium text-white hover:bg-chrome-700"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-zinc-900">Not authorized</p>
        <p className="text-sm text-zinc-600">This page is only available to the site admin.</p>
        <Link href="/matchup-planner" className="text-sm font-medium text-zinc-600 hover:underline">
          ← Back to Matchup Planner
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-chrome-600 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/matchup-planner"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            ← Matchup Planner
          </Link>
          <h1 className="text-lg font-semibold text-white">Admin: Features</h1>
          <Link
            href="/admin/seasons"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            Seasons →
          </Link>
          <Link
            href="/admin/learnsets"
            className="text-sm font-medium text-zinc-100 hover:text-white"
          >
            Learnsets →
          </Link>
        </div>
        <AuthMenu
          user={user}
          isLoading={isAuthLoading}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
        />
      </header>

      <div className="flex flex-col gap-3 p-6 md:max-w-md">
        <h2 className="text-sm font-semibold text-zinc-900">App sections</h2>
        <p className="text-xs text-zinc-500">
          Disabling a section hides it from the nav and blocks its pages for everyone except you.
        </p>
        {flagsLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {SECTION_FLAGS.map((section) => (
              <FlagToggle
                key={section.flagKey}
                label={section.label}
                active={flags[section.flagKey]}
                onClick={() => toggle(section.flagKey)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
