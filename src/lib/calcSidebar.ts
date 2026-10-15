/** The minimal shape of a Damage Calculator sidebar entry these helpers need. */
interface Entry {
  pokemon: { species: string };
}

/**
 * Removes the entry at `index` and picks what's selected next, so a side is
 * never left without a Pokémon: removing the open entry opens its neighbor
 * (the next one, or the previous if it was last), and removing the only one
 * leaves `fallback()` — the default species — in its place.
 */
export function removeSidebarEntry<T extends Entry>(
  sidebar: T[],
  selectedIndex: number | null,
  index: number,
  fallback: () => T,
): { sidebar: T[]; selectedIndex: number; selectionChanged: boolean } {
  const remaining = sidebar.filter((_, i) => i !== index);
  if (remaining.length === 0) {
    return { sidebar: [fallback()], selectedIndex: 0, selectionChanged: true };
  }
  if (selectedIndex === null || selectedIndex === index) {
    return {
      sidebar: remaining,
      selectedIndex: Math.min(index, remaining.length - 1),
      selectionChanged: true,
    };
  }
  return {
    sidebar: remaining,
    selectedIndex: selectedIndex > index ? selectedIndex - 1 : selectedIndex,
    selectionChanged: false,
  };
}

/** A restored or loaded sidebar with nothing in it, or nothing selected, gets the same fix: the default species, or the first entry. */
export function ensureSidebarSelection<T extends Entry>(
  sidebar: T[],
  selectedIndex: number | null,
  fallback: () => T,
): { sidebar: T[]; selectedIndex: number } {
  if (sidebar.length === 0) return { sidebar: [fallback()], selectedIndex: 0 };
  if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= sidebar.length) {
    return { sidebar, selectedIndex: 0 };
  }
  return { sidebar, selectedIndex };
}
