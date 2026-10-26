"use client";

import { useTheme } from "@/hooks/useTheme";
import { useMessages } from "@/hooks/useLanguage";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

/**
 * Sits directly on the header's chrome bar, which stays the same fixed dark
 * zinc in both themes (see MyTeamHeader) — so like the header's other icon
 * buttons (the hamburger menu), it uses the theme-invariant
 * text-zinc-100/dark:text-zinc-900 pairing rather than letting the normal
 * zinc-scale swap apply. Shows the icon for the theme you'd switch TO
 * (moon while light, sun while dark), the usual convention for a toggle
 * rather than a status indicator.
 */
export function ThemeToggle() {
  const t = useMessages();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t.theme.toLight : t.theme.toDark}
      title={isDark ? t.theme.toLight : t.theme.toDark}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-chrome-100 hover:bg-zinc-500"
    >
      <Icon name={isDark ? IconName.LightMode : IconName.DarkMode} size={20} />
    </button>
  );
}
