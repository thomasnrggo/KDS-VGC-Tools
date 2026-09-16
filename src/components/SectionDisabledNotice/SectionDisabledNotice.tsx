import Link from "next/link";

/** Shown in place of a section's whole route tree when its feature flag is off and the current visitor isn't the admin — see FeatureGate. Same layout as admin/seasons' "Not authorized" block. */
export function SectionDisabledNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-lg font-semibold text-zinc-900">This section isn&apos;t available right now</p>
      <p className="text-sm text-zinc-600">Check back later.</p>
      <Link href="/matchup-planner" className="text-sm font-medium text-zinc-600 hover:underline">
        ← Back to Matchup Planner
      </Link>
    </div>
  );
}
