import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AgeDivision, PlayerProfile } from "@/lib/playerProfile";

/**
 * Fills Play! Pokémon's official "Pokémon Video Game Team List"
 * (public/team-list/play-pokemon-vg-team-list.pdf). The form has no fillable
 * fields, so text is drawn at measured positions: page 1 is for tournament
 * staff (with Player ID, date of birth and each Pokémon's stats), page 2 for
 * opponents (no stats). Both pages share one grid of six boxes; page 2 sits
 * a few points higher.
 *
 * Positions were measured on a 1082 px wide render of the 612 × 792 pt page —
 * `px()` converts them. If Pokémon changes the form, re-measure here.
 */

export type TeamListPages = "opponents" | "staff" | "both";
/** The player's profile (src/lib/playerProfile.ts) plus this team's Battle Team number / name. */
export interface TeamListPlayer extends PlayerProfile {
  battleTeam: string;
}

/** One box of the sheet, already in the words to print (translated, capitalized). */
export interface TeamListPokemon {
  species: string;
  nature: string;
  ability: string;
  item: string;
  moves: string[];
  /** HP, Atk, Def, Sp. Atk, Sp. Def, Speed at Level 50 — staff page only; null leaves them blank. */
  stats: number[] | null;
}

const PAGE_HEIGHT = 792;
const SCALE = 612 / 1082;
const px = (value: number) => value * SCALE;
/** A top-down y measured in px → pdf-lib's bottom-up y in points. */
const yFromTop = (value: number) => PAGE_HEIGHT - px(value);

const INK = rgb(0, 0, 0);

/** Where each page's grid starts, and how much higher page 2's header sits. */
const PAGE_LAYOUT = {
  staff: { index: 0, headerShift: 0, boxTop: 286 },
  opponents: { index: 1, headerShift: -4, boxTop: 282 },
} as const;

const BOX_LEFT = [33, 549];
const BOX_PITCH = 356;
/** Value text starts here, inside a box — past the longest label ("Stat Alignment"). */
const VALUE_X = 140;
/** Rows with a stat cell to their right end before it; Pokémon and Stat Alignment run the full box. */
const VALUE_WIDTH_BESIDE_STATS = 258;
const VALUE_WIDTH_FULL = 350;
const STAT_RIGHT = 490;
const ROW_PITCH = 41;
const DIVISION_BOX_X: Record<AgeDivision, number> = { juniors: 845, seniors: 942, masters: 1031 };

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Whether the font can draw `text` — the standard fonts only cover Latin-1-ish text. */
function canDraw(font: PDFFont, text: string): boolean {
  try {
    font.widthOfTextAtSize(text, 10);
    return true;
  } catch {
    return false;
  }
}

/** Draws `text` with its left edge at `x`, shrinking it (down to 6 pt) to fit `maxWidth` when given. */
function draw(
  page: PDFPage,
  font: PDFFont,
  text: string,
  { x, y, size = 10, maxWidth }: { x: number; y: number; size?: number; maxWidth?: number },
) {
  const value = text.trim();
  if (!value || !canDraw(font, value)) return;
  let fitted = size;
  if (maxWidth) {
    while (fitted > 6 && font.widthOfTextAtSize(value, fitted) > px(maxWidth)) fitted -= 0.5;
  }
  page.drawText(value, { x: px(x), y: yFromTop(y), size: fitted, font, color: INK });
}

function drawRight(page: PDFPage, font: PDFFont, text: string, right: number, y: number) {
  const size = 11;
  page.drawText(text, {
    x: px(right) - font.widthOfTextAtSize(text, size),
    y: yFromTop(y),
    size,
    font,
    color: INK,
  });
}

/** "2000-01-31" → ["01", "31", "2000"]; anything else → null. */
export function birthDateParts(value: string): [string, string, string] | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? [match[2], match[3], match[1]] : null;
}

function fillPage(
  page: PDFPage,
  kind: "staff" | "opponents",
  player: TeamListPlayer,
  team: TeamListPokemon[],
  { regular, bold }: Fonts,
) {
  const { headerShift: dy, boxTop } = PAGE_LAYOUT[kind];

  draw(page, regular, player.playerName, { x: 256, y: 152 + dy, size: 11, maxWidth: 290 });
  draw(page, regular, player.trainerName, { x: 256, y: 189 + dy, maxWidth: 290 });
  draw(page, regular, player.battleTeam, { x: 256, y: 226 + dy, maxWidth: 290 });
  draw(page, regular, player.switchProfile, { x: 256, y: 269 + dy, maxWidth: 290 });
  if (player.division) {
    draw(page, bold, "X", { x: DIVISION_BOX_X[player.division] - 6, y: 153 + dy, size: 11 });
  }

  if (kind === "staff") {
    draw(page, regular, player.playerId, { x: 772, y: 190, maxWidth: 270 });
    const birth = birthDateParts(player.birthDate);
    if (birth) {
      draw(page, regular, birth[0], { x: 790, y: 226 });
      draw(page, regular, birth[1], { x: 885, y: 226 });
      draw(page, regular, birth[2], { x: 975, y: 226 });
    }
    draw(page, regular, player.supportId, { x: 772, y: 269, maxWidth: 270 });
  }

  team.slice(0, 6).forEach((mon, slot) => {
    const left = BOX_LEFT[slot % 2];
    const top = boxTop + Math.floor(slot / 2) * BOX_PITCH;
    const x = left + VALUE_X;
    draw(page, bold, mon.species, { x, y: top + 34, size: 12, maxWidth: VALUE_WIDTH_FULL });
    draw(page, regular, mon.nature, { x, y: top + 81, maxWidth: VALUE_WIDTH_FULL });
    const rows = [mon.ability, mon.item, ...mon.moves.slice(0, 4)];
    rows.forEach((value, row) =>
      draw(page, regular, value, {
        x,
        y: top + 123 + row * ROW_PITCH,
        maxWidth: VALUE_WIDTH_BESIDE_STATS,
      }),
    );
    if (kind === "staff" && mon.stats) {
      mon.stats.forEach((value, row) =>
        drawRight(page, regular, String(value), left + STAT_RIGHT, top + 128 + row * ROW_PITCH),
      );
    }
  });
}

/** Fills the blank form (`template`, the PDF's bytes) and returns only the chosen page(s). */
export async function fillTeamList(
  template: ArrayBuffer | Uint8Array,
  {
    pages,
    player,
    team,
  }: { pages: TeamListPages; player: TeamListPlayer; team: TeamListPokemon[] },
): Promise<Uint8Array> {
  const source = await PDFDocument.load(template);
  const fonts: Fonts = {
    regular: await source.embedFont(StandardFonts.Helvetica),
    bold: await source.embedFont(StandardFonts.HelveticaBold),
  };
  const kinds: ("staff" | "opponents")[] =
    pages === "both" ? ["staff", "opponents"] : [pages === "staff" ? "staff" : "opponents"];
  for (const kind of kinds) {
    fillPage(source.getPage(PAGE_LAYOUT[kind].index), kind, player, team, fonts);
  }
  // Drop the page that wasn't asked for (from the end, so indexes hold).
  for (const kind of ["opponents", "staff"] as const) {
    if (!kinds.includes(kind)) source.removePage(PAGE_LAYOUT[kind].index);
  }
  source.setTitle(player.battleTeam ? `Team List — ${player.battleTeam}` : "Team List");
  return source.save();
}
