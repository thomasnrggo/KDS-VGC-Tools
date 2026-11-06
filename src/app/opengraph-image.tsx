import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, TAGLINE } from "@/lib/site";

// The link preview every page shares (Discord, X, WhatsApp…): the logo,
// the name and what VGC Box is. Rendered once at build time.
export const alt = `${SITE_NAME} — ${TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TOOLS = ["Metagame", "Team Builder", "Damage Calculator", "Speed Tiers", "Team Library"];

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/resources/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "72px 88px",
        background: "linear-gradient(135deg, #18181b 0%, #27272a 60%, #3f3f46 100%)",
        color: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <img src={logoSrc} width={150} height={150} alt="" />
        <div style={{ display: "flex", fontSize: 112, fontWeight: 800, letterSpacing: -2 }}>
          VGC<span style={{ fontWeight: 300, color: "#a1a1aa" }}>Box</span>
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 40, fontSize: 52, fontWeight: 600 }}>{TAGLINE}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 40 }}>
        {TOOLS.map((tool) => (
          <div
            key={tool}
            style={{
              display: "flex",
              padding: "10px 24px",
              borderRadius: 999,
              border: "2px solid #71717a",
              fontSize: 30,
              color: "#e4e4e7",
            }}
          >
            {tool}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
