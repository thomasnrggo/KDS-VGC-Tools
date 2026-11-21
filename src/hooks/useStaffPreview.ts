"use client";

import { useEffect, useId, useSyncExternalStore } from "react";

/**
 * Which mounted parts of the page are staff-only previews right now — a
 * section whose flag is off (FeatureGate), a preview tab — so the site
 * header can say so with a banner under it. A module-level store, so any
 * component can mark itself without a provider around the app.
 */
const markers = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const hasMarkers = () => markers.size > 0;
const noMarkersOnServer = () => false;

/** Marks the calling component's part of the page as staff-only while `active` (a moderator or admin is seeing something others can't). */
export function useStaffPreview(active: boolean) {
  const id = useId();
  useEffect(() => {
    if (!active) return;
    markers.add(id);
    emit();
    return () => {
      markers.delete(id);
      emit();
    };
  }, [active, id]);
}

/** True while anything on the page is marked staff-only (see useStaffPreview). */
export function useIsStaffPreview() {
  return useSyncExternalStore(subscribe, hasMarkers, noMarkersOnServer);
}
