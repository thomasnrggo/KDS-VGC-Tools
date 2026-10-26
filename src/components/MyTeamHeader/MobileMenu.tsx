"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "firebase/auth";
import { GoogleLogo } from "../AuthMenu";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useTheme } from "@/hooks/useTheme";
import { useLanguageSettings, useMessages } from "@/hooks/useLanguage";
import {
  APP_LANGUAGE_NAMES,
  APP_LANGUAGES,
  POKEMON_LANGUAGE_NAMES,
  POKEMON_LANGUAGES,
} from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

export interface MobileMenuLink {
  page: string;
  href: string;
  label: string;
}

interface MobileMenuProps {
  links: MobileMenuLink[];
  currentPage: string;
  user: User | null;
  isAuthLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

// The menu sits on the header's fixed dark chrome (zinc-800 in light mode,
// zinc-200 in dark), so its text uses the same theme-invariant pairings as
// the header's own links and icon buttons.
const rowClassName =
  "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base text-chrome-200 hover:bg-chrome-700";
const mutedTextClassName = "text-chrome-400";

function Avatar({ user }: { user: User }) {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-base font-semibold text-zinc-700">
      {user.photoURL ? (
        <Image
          src={user.photoURL}
          alt=""
          fill
          unoptimized
          sizes="44px"
          referrerPolicy="no-referrer"
          className="object-cover"
        />
      ) : (
        (user.displayName ?? user.email ?? "?").charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** One language list in the Language sub-screen: a row per choice, the current one checked. */
function LanguageChoices<T extends string>({
  label,
  options,
  names,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: readonly T[];
  names: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col">
      <span
        className={cn(
          "px-3 pb-1 text-xs font-semibold tracking-wide uppercase",
          mutedTextClassName,
        )}
      >
        {label}
      </span>
      {options.map((option) => {
        const isSelected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option)}
            className={cn(rowClassName, isSelected && "font-semibold")}
          >
            <span lang={option} className="flex-1">
              {names[option]}
            </span>
            {isSelected && <Icon name={IconName.Check} size={20} />}
          </button>
        );
      })}
      {hint && <p className={cn("px-3 pt-1 text-xs", mutedTextClassName)}>{hint}</p>}
    </div>
  );
}

/**
 * The phone/tablet menu (below 1024px): a full screen under the header row,
 * so the page's own sticky bars don't show through and the page behind it
 * doesn't scroll. Account first, then the pages, then the settings pinned to
 * the bottom: Language opens its own sub-screen, Dark mode is a switch, and
 * Sign out comes last.
 */
export function MobileMenu({
  links,
  currentPage,
  user,
  isAuthLoading,
  onSignIn,
  onSignOut,
  onClose,
}: MobileMenuProps) {
  const t = useMessages();
  const { theme, setTheme } = useTheme();
  const { appLanguage, pokemonLanguage, setAppLanguage, setPokemonLanguage } =
    useLanguageSettings();
  const [view, setView] = useState<"main" | "language">("main");
  const isDark = theme === "dark";

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  let content: ReactNode;
  if (view === "language") {
    content = (
      <div className="flex flex-col gap-4 p-3">
        <button
          type="button"
          onClick={() => setView("main")}
          className={cn(rowClassName, "font-semibold")}
        >
          <Icon name={IconName.ChevronLeft} size={22} />
          {t.language.menu}
        </button>
        <LanguageChoices
          label={t.language.appLanguage}
          options={APP_LANGUAGES}
          names={APP_LANGUAGE_NAMES}
          value={appLanguage}
          onChange={setAppLanguage}
        />
        <LanguageChoices
          label={t.language.pokemonLanguage}
          options={POKEMON_LANGUAGES}
          names={POKEMON_LANGUAGE_NAMES}
          value={pokemonLanguage}
          onChange={setPokemonLanguage}
          hint={t.language.pokemonLanguageHint}
        />
      </div>
    );
  } else {
    content = (
      <>
        {!isAuthLoading && (
          <div className="border-b border-chrome-600 p-4">
            {user ? (
              <div className="flex items-center gap-3">
                <Avatar user={user} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-base font-semibold text-white dark:text-zinc-900">
                    {user.displayName ?? t.auth.signedIn}
                  </span>
                  {user.email && (
                    <span className={cn("truncate text-sm", mutedTextClassName)}>{user.email}</span>
                  )}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <GoogleLogo />
                {t.auth.signIn}
              </button>
            )}
          </div>
        )}

        <nav className="flex flex-col gap-1 p-3">
          {links.map((link) =>
            link.page === currentPage ? (
              <span
                key={link.page}
                aria-current="page"
                className="flex min-h-12 items-center rounded-lg bg-chrome-600 px-3 text-base font-bold text-white dark:text-zinc-900"
              >
                {link.label}
              </span>
            ) : (
              <Link key={link.page} href={link.href} onClick={onClose} className={rowClassName}>
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-chrome-600 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setView("language")} className={rowClassName}>
            <Icon name={IconName.Translate} size={22} />
            <span className="flex-1">{t.language.menu}</span>
            <span className={cn("text-sm", mutedTextClassName)}>
              {APP_LANGUAGE_NAMES[appLanguage]}
            </span>
            <Icon name={IconName.ChevronRight} size={22} className={mutedTextClassName} />
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={rowClassName}
          >
            <Icon name={IconName.DarkMode} size={22} />
            <span className="flex-1">{t.theme.darkMode}</span>
            <span
              aria-hidden="true"
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                isDark ? "bg-emerald-500" : "bg-zinc-500",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-[left]",
                  isDark ? "left-[1.375rem]" : "left-0.5",
                )}
              />
            </span>
          </button>
          {user && (
            <button type="button" onClick={onSignOut} className={cn(rowClassName, "!text-red-400")}>
              <Icon name={IconName.Logout} size={22} />
              {t.auth.signOut}
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-x-0 top-[var(--site-header-height,5rem)] bottom-0 flex flex-col overflow-y-auto overscroll-contain border-t border-chrome-600 bg-chrome-800 lg:hidden">
      {content}
    </div>
  );
}
