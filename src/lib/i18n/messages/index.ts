import type { AppLanguage } from "../languages";
import { en } from "./en";
import { es } from "./es";

/**
 * The app's own text, one dictionary per app language (see
 * docs/localization.md). en.ts is the source of truth for the shape; es.ts
 * is typed against it, so a missing or extra Spanish string fails the type
 * check. Text that varies (counts, names) is a function, so each language
 * writes its own grammar.
 */
export type Messages = typeof en;

export const MESSAGES: Record<AppLanguage, Messages> = { en, es };
