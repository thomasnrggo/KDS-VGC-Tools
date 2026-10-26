"use client";

import { useSyncExternalStore } from "react";

/** Below Tailwind's `sm` breakpoint — where pickers open as a full-screen sheet instead of a dropdown. */
const PHONE_QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Whether the screen is phone-sized. False during server rendering. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
