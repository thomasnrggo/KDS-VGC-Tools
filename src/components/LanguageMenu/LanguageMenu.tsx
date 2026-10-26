"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useLanguageSettings, useMessages } from "@/hooks/useLanguage";
import {
  APP_LANGUAGE_NAMES,
  APP_LANGUAGES,
  POKEMON_LANGUAGE_NAMES,
  POKEMON_LANGUAGES,
} from "@/lib/i18n/languages";

/**
 * The header's language picker: the app's text and the Pokémon names are
 * two separate choices (see docs/localization.md). Sits on the header's
 * fixed dark bar, so the trigger uses the same theme-invariant colors as
 * ThemeToggle.
 */
export function LanguageMenu() {
  const t = useMessages();
  const { appLanguage, pokemonLanguage, setAppLanguage, setPokemonLanguage } =
    useLanguageSettings();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={t.language.menu}
        title={t.language.menu}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-chrome-100 hover:bg-zinc-500"
      >
        <Icon name={IconName.Translate} size={20} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={t.language.menu}
          className="absolute top-full right-0 z-20 mt-2 flex w-64 flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 shadow-lg"
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              {t.language.appLanguage}
            </legend>
            {APP_LANGUAGES.map((language) => (
              <label
                key={language}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-zinc-800 hover:bg-zinc-100"
              >
                <input
                  type="radio"
                  name="app-language"
                  checked={appLanguage === language}
                  onChange={() => setAppLanguage(language)}
                />
                <span lang={language}>{APP_LANGUAGE_NAMES[language]}</span>
              </label>
            ))}
          </fieldset>
          <div className="border-t border-zinc-200" />
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              {t.language.pokemonLanguage}
            </legend>
            {POKEMON_LANGUAGES.map((language) => (
              <label
                key={language}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-zinc-800 hover:bg-zinc-100"
              >
                <input
                  type="radio"
                  name="pokemon-language"
                  checked={pokemonLanguage === language}
                  onChange={() => setPokemonLanguage(language)}
                />
                <span lang={language}>{POKEMON_LANGUAGE_NAMES[language]}</span>
              </label>
            ))}
            <p className="mt-1 text-xs text-zinc-500">{t.language.pokemonLanguageHint}</p>
          </fieldset>
        </div>
      )}
    </div>
  );
}
