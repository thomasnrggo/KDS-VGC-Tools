import type { MetaCombos } from "./aggregateMeta";
import type { MetaDocument } from "./metaDocument";

/** How many Pokémon (and of each core and team list) the snapshot keeps: the overview's top 20. */
export const SNAPSHOT_SIZE = 20;

/**
 * The part of a metagame document the home page's first paint needs, small
 * enough to send with the server-rendered HTML (~1/4 of the ~380KB whole):
 * the events, the top Pokémon of the recent slice and of the whole
 * regulation (whose per-event histories draw the cards' trend arrows), and
 * the top of each core list. The page then loads the whole document as
 * before (useMeta) for the other views and the rest of the list.
 */
export function metaSnapshot(doc: MetaDocument, size = SNAPSHOT_SIZE): MetaDocument {
  const { official } = doc;
  const recentTop = official.recent?.pokemon.slice(0, size) ?? [];
  const wanted = new Set(recentTop.map((mon) => mon.species));
  return {
    ...doc,
    official: {
      ...official,
      // The whole regulation's top, plus anything in the recent top for its history.
      pokemon: official.pokemon.filter((mon, index) => index < size || wanted.has(mon.species)),
      combos: official.combos && trimCombos(official.combos, size),
      recent: official.recent && {
        ...official.recent,
        pokemon: recentTop,
        combos: official.recent.combos && trimCombos(official.recent.combos, size),
      },
    },
  };
}

function trimCombos(combos: MetaCombos, size: number): MetaCombos {
  return {
    pairs: combos.pairs.slice(0, size),
    trios: combos.trios.slice(0, size),
    quads: combos.quads.slice(0, size),
    teams: combos.teams.slice(0, size),
  };
}
