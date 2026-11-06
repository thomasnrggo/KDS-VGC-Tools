/**
 * Regenerates the app icons from the logo (public/resources/logo.png):
 * src/app/favicon.ico (16, 32 and 48px), src/app/icon.png (192px) and
 * src/app/apple-icon.png (180px), which Next.js links in every page's head.
 *
 * The logo is mostly white, so it sits on the header's dark chrome-800 as a
 * tile (rounded for the favicon and icon; square for the apple icon, which
 * iOS rounds itself) — on a light browser tab it would otherwise vanish.
 *
 * Run: npm run generate:icons (one-off, after the logo changes).
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const LOGO = "public/resources/logo.png";
const BACKGROUND = "#27272a"; // --color-chrome-800

/** The logo centered on a dark tile of `size` px, `inset` (a fraction) from each edge. */
async function tile(size, { rounded, inset }) {
  const radius = rounded ? Math.round(size * 0.22) : 0;
  const background = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${BACKGROUND}"/></svg>`,
  );
  const inner = Math.round(size * (1 - inset * 2));
  const logo = await sharp(LOGO)
    .trim()
    .resize(inner, inner, { fit: "contain", background: "#0000" })
    .png()
    .toBuffer();
  return sharp(background)
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

/** An .ico holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size, entry); // width
    header.writeUInt8(size, entry + 1); // height
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

const favicons = await Promise.all(
  [16, 32, 48].map(async (size) => ({
    size,
    png: await tile(size, { rounded: true, inset: 0.06 }),
  })),
);
writeFileSync("src/app/favicon.ico", ico(favicons));
writeFileSync("src/app/icon.png", await tile(192, { rounded: true, inset: 0.08 }));
writeFileSync("src/app/apple-icon.png", await tile(180, { rounded: false, inset: 0.12 }));
console.log("Wrote src/app/favicon.ico, icon.png and apple-icon.png");
