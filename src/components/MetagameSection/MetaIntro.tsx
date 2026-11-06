"use client";

import Image from "next/image";
import Link from "next/link";
import { IconName } from "@/enums";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMessages } from "@/hooks/useLanguage";
import type { FeatureFlags } from "@/types";
import { IconButton } from "../Button";
import { Icon } from "../Icon";

type ToolKey = "teamBuilder" | "damageCalc" | "teamLibrary" | "matchupPlanner";

const TOOLS: { key: ToolKey; href: string; icon: IconName; flagKey: keyof FeatureFlags | null }[] =
  [
    { key: "teamBuilder", href: "/team-builder", icon: IconName.Edit, flagKey: "teams" },
    { key: "damageCalc", href: "/damage-calc", icon: IconName.Calculate, flagKey: null },
    {
      key: "teamLibrary",
      href: "/team-library",
      icon: IconName.Description,
      flagKey: "teamLibrary",
    },
    {
      key: "matchupPlanner",
      href: "/matchup-planner",
      icon: IconName.Group,
      flagKey: "matchupPlanner",
    },
  ];

/**
 * The home page's welcome, above the metagame: what the page shows, where
 * it comes from, and the app's tools (those switched on — see FeatureGate).
 * Its ✕ closes it for good on this device: a returning visitor knows the
 * tools (they're in the nav). Hidden by CSS from a flag the root layout's
 * early script sets, so it never flashes — and crawlers, with no stored
 * flag, always get it.
 */
const DISMISSED_KEY = "homeIntroDismissed";

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Private mode: it just comes back next visit.
  }
  document.documentElement.dataset.introDismissed = "";
}

export function MetaIntro() {
  const t = useMessages();
  const { flags } = useFeatureFlags();
  const { isStaff } = useIsAdmin();
  const tools = TOOLS.filter((tool) => !tool.flagKey || flags[tool.flagKey] || isStaff);

  // Hisuian Zoroark's accents: a light purple to say "welcome" without the
  // weight of the dark header, and a red tint in dark mode. On wide screens the
  // text sits left and the tools in a 2×2 grid on the right.
  return (
    <section className="home-intro relative flex flex-col gap-4 overflow-hidden rounded-xl border border-purple-200 bg-linear-to-br from-purple-50 via-fuchsia-50 to-violet-100/70 p-4 sm:p-6 xl:flex-row xl:items-center xl:gap-6 xl:pr-12 dark:border-red-900/60 dark:from-red-950/60 dark:via-zinc-50 dark:to-rose-950/40">
      <IconButton
        variant="ghost"
        onClick={dismiss}
        aria-label={t.metagame.hideIntro}
        title={t.metagame.hideIntro}
        className="absolute top-2 right-2 h-8 w-8 text-zinc-500 hover:bg-purple-100 hover:text-zinc-900 dark:hover:bg-red-900/40"
      >
        <Icon name={IconName.Close} size={18} />
      </IconButton>
      <div className="flex items-start gap-4 pr-8 xl:flex-1 xl:pr-0">
        <Image
          src="/resources/logo.png"
          alt=""
          width={64}
          height={64}
          unoptimized
          className="hidden h-16 w-16 shrink-0 sm:block"
        />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
            {t.metagame.introTitle}
          </h1>
          <p className="max-w-3xl text-sm text-zinc-700">{t.metagame.introBody}</p>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:w-[34rem] xl:shrink-0 xl:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool.key}>
            <Link
              href={tool.href}
              className="flex h-full items-start gap-2.5 rounded-lg border border-purple-200/80 bg-raised/80 p-2.5 transition-colors hover:border-purple-400 hover:bg-raised sm:p-3 dark:border-red-900/50 dark:hover:border-red-500"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-chrome-800 text-white">
                <Icon name={tool.icon} size={18} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-zinc-900">
                  {t.metagame.tools[tool.key].title}
                </span>
                <span className="hidden text-xs text-zinc-600 sm:block">
                  {t.metagame.tools[tool.key].body}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
