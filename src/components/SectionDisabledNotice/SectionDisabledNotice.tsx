"use client";

import Link from "next/link";
import { useMessages } from "@/hooks/useLanguage";

/** Shown in place of a section's whole route tree when its feature flag is off and the current visitor isn't the admin — see FeatureGate. Same layout as admin/seasons' "Not authorized" block. */
export function SectionDisabledNotice() {
  const t = useMessages();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-lg font-semibold text-zinc-900">{t.sectionDisabled.title}</p>
      <p className="text-sm text-zinc-600">{t.sectionDisabled.body}</p>
      <Link href="/matchup-planner" className="text-sm font-medium text-zinc-600 hover:underline">
        {t.sectionDisabled.back}
      </Link>
    </div>
  );
}
