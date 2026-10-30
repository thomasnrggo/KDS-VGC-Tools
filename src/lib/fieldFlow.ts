/**
 * Keyboard flow through an editor: picking with Enter in one field moves the
 * focus to the next one, so a set can be filled in from the keyboard alone
 * (Pokémon → item → ability → Stat Points → nature → moves in the Damage
 * Calculator). Fields opt in with FLOW_FIELD and are visited in page order;
 * only fields inside the same FLOW_ROOT count, and outside a root nothing
 * moves, so a field that's also used elsewhere keeps its plain behavior.
 * Tab moves on the same way as Enter (see isFlowAdvanceKey).
 */
export const FLOW_FIELD = { "data-flow-field": "" } as const;
export const FLOW_ROOT = { "data-flow-root": "" } as const;

/** Enter or Tab (not Shift+Tab): the keys that move on to the next field. */
export function isFlowAdvanceKey(event: { key: string; shiftKey: boolean }): boolean {
  return event.key === "Enter" || (event.key === "Tab" && !event.shiftKey);
}

/** Whether `from` is inside a flow (FLOW_ROOT), so Enter/Tab are the flow's to handle. */
export function isInFlow(from: Element | null): boolean {
  return !!from?.closest("[data-flow-root]");
}

/** Moves the focus to the next flow field; false when there's none (the browser's Tab can go on). */
export function focusNextFlowField(from: Element | null): boolean {
  const root = from?.closest("[data-flow-root]");
  if (!from || !root) return false;
  const fields = flowFields(root);
  const index = fields.findIndex((field) => field === from || field.contains(from));
  if (index === -1) return false;
  // Found by position after the pick re-renders, since a new Pokémon can
  // swap (or enable) the fields below it.
  requestAnimationFrame(() => flowFields(root)[index + 1]?.focus());
  return index < fields.length - 1;
}

function flowFields(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-flow-field]")].filter(
    (field) => field.getClientRects().length > 0 && !field.hasAttribute("disabled"),
  );
}
