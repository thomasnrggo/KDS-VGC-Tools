import { useSyncExternalStore } from "react";

/**
 * The Metagame's view lives in the URL's query (?reg, ?events, ?view, ?q,
 * ?pokemon), so a link shares it and Back closes a Pokémon's details — read
 * here as a store rather than with useSearchParams, which would keep a
 * statically rendered page from rendering this part on the server. The
 * server (and hydration) see no query, the default view; the browser then
 * re-renders with the real one. Written with history.replaceState /
 * pushState (setUrl), which notify the store; Back and Forward do through
 * popstate.
 */
const CHANGE_EVENT = "metagame-url-change";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The page's query string ("" on the server). */
export function useUrlQuery(): URLSearchParams {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  return new URLSearchParams(search);
}

/** Updates the page's URL query without a navigation; a null value removes the key. */
export function setUrl(
  changes: Record<string, string | null>,
  mode: "replace" | "push" = "replace",
) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const search = params.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
