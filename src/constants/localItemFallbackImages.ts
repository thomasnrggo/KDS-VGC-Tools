/**
 * Locally-hosted fallback art (public/items/) for item icons PokeAPI's sprite
 * repo doesn't have yet — mostly newer Pokémon Champions additions (Mega
 * Stones especially, see megaStones.ts's "Champions / Legends: Z-A" section),
 * which predate PokeAPI's own item-sprite coverage. resolveItemImage still
 * tries PokeAPI first; ItemIcon falls back to one of these on a 404, so the
 * moment PokeAPI adds real art for one of these, no code change is needed —
 * it'll just stop 404ing and the entry below becomes unused for that key.
 *
 * Keyed by the item's normalizeSpeciesKey with hyphens stripped (that's how
 * the images were supplied): "raichunite-x" -> "raichunitex", "fairy-feather"
 * -> "fairyfeather". Value is the public/ path to serve.
 */
export const LOCAL_ITEM_FALLBACK_IMAGES: Record<string, string> = {
  barbaracite: "/items/mega-stones/barbaracite.png",
  baxcalibrite: "/items/mega-stones/baxcalibrite.png",
  chandelurite: "/items/mega-stones/chandelurite.png",
  chesnaughtite: "/items/mega-stones/chesnaughtite.png",
  chimechite: "/items/mega-stones/chimechite.png",
  clefablite: "/items/mega-stones/clefablite.png",
  crabominite: "/items/mega-stones/crabominite.png",
  darkranite: "/items/mega-stones/darkranite.png",
  delphoxite: "/items/mega-stones/delphoxite.png",
  dragalgite: "/items/mega-stones/dragalgite.png",
  drampanite: "/items/mega-stones/drampanite.png",
  eelektrossite: "/items/mega-stones/eelektrossite.png",
  emboarite: "/items/mega-stones/emboarite.png",
  excadrite: "/items/mega-stones/excadrite.png",
  falinksite: "/items/mega-stones/falinksite.png",
  feraligite: "/items/mega-stones/feraligite.png",
  floettite: "/items/mega-stones/floettite.png",
  froslassite: "/items/mega-stones/froslassite.png",
  garchompitez: "/items/mega-stones/garchompitez.png",
  glimmoranite: "/items/mega-stones/glimmoranite.png",
  golisopite: "/items/mega-stones/golisopite.png",
  golurkite: "/items/mega-stones/golurkite.png",
  greninjite: "/items/mega-stones/greninjite.png",
  hawluchanite: "/items/mega-stones/hawluchanite.png",
  heatranite: "/items/mega-stones/heatranite.png",
  lucarionitez: "/items/mega-stones/lucarionitez.png",
  magearnite: "/items/mega-stones/magearnite.png",
  malamarite: "/items/mega-stones/malamarite.png",
  meganiumite: "/items/mega-stones/meganiumite.png",
  meowsticite: "/items/mega-stones/meowsticite.png",
  pyroarite: "/items/mega-stones/pyroarite.png",
  raichunitex: "/items/mega-stones/raichunitex.png",
  raichunitey: "/items/mega-stones/raichunitey.png",
  scolipite: "/items/mega-stones/scolipite.png",
  scovillainite: "/items/mega-stones/scovillainite.png",
  scraftinite: "/items/mega-stones/scraftinite.png",
  skarmorite: "/items/mega-stones/skarmorite.png",
  staraptite: "/items/mega-stones/staraptite.png",
  starminite: "/items/mega-stones/starminite.png",
  tatsugirinite: "/items/mega-stones/tatsugirinite.png",
  victreebelite: "/items/mega-stones/victreebelite.png",
  zeraorite: "/items/mega-stones/zeraorite.png",
  zygardite: "/items/mega-stones/zygardite.png",

  // Non-Mega-Stone items missing from PokeAPI
  fairyfeather: "/items/fairyfeather.png",
};
