/**
 * Keyboard flow through an editor: picking with Enter in one field moves the
 * focus to the next one, so a set can be filled in from the keyboard alone
 * (Pokémon → item → ability → Stat Points → nature → moves in the Damage
 * Calculator). Fields opt in with FLOW_FIELD and are visited in page order;
 * only fields inside the same FLOW_ROOT count, and outside a root nothing
 * moves, so a field that's also used elsewhere keeps its plain behavior.
 */
export const FLOW_FIELD = { "data-flow-field": "" } as const;
export const FLOW_ROOT = { "data-flow-root": "" } as const;

export function focusNextFlowField(from: Element | null) {
  const root = from?.closest("[data-flow-root]");
  if (!from || !root) return;
  const index = flowFields(root).findIndex((field) => field === from || field.contains(from));
  if (index === -1) return;
  // Found by position after the pick re-renders, since a new Pokémon can
  // swap the fields below it.
  requestAnimationFrame(() => flowFields(root)[index + 1]?.focus());
}

function flowFields(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-flow-field]")].filter(
    (field) => field.getClientRects().length > 0 && !field.hasAttribute("disabled"),
  );
}
