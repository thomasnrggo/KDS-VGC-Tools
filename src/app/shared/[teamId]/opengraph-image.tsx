import { ImageResponse } from "next/og";
import { getSharedTeamOnServer } from "@/lib/firebase/sharedTeamServer";
import { resolveSpeciesImage } from "@/lib/species/resolveSpeciesImage";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import SiteImage from "../../opengraph-image";

// A shared team's link preview: its name, creator and the six sprites. A
// team that isn't shared (anymore) gets the site's own preview instead.
export const alt = `A Pokémon VGC team shared on ${SITE_NAME}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Re-read at most every 5 minutes (same as the page's title/description).
export const revalidate = 300;

/**
 * An image as a data URI, or null when it can't be fetched — ImageResponse
 * fails the whole image on one broken <img>, so a missing sprite is left out
 * instead. Sprites and the logo come from the public site (the files under
 * public/ aren't bundled with this route).
 */
async function dataUri(path: string): Promise<string | null> {
  try {
    const response = await fetch(new URL(path, SITE_URL));
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = await getSharedTeamOnServer(teamId);
  if (!team) return SiteImage();

  const [logo, ...sprites] = await Promise.all([
    dataUri("/resources/logo.png"),
    ...team.pokemon.slice(0, 6).map((mon) => {
      const resolved = resolveSpeciesImage(mon.species, mon.item);
      return resolved ? dataUri(resolved.imageUrl) : Promise.resolve(null);
    }),
  ]);
  const creator = team.creator?.trim();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "56px 64px",
        background: "linear-gradient(135deg, #18181b 0%, #27272a 60%, #3f3f46 100%)",
        color: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {logo && <img src={logo} width={56} height={56} alt="" />}
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
          VGC<span style={{ fontWeight: 300, color: "#a1a1aa" }}>Box</span>
        </div>
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            padding: "8px 20px",
            borderRadius: 999,
            border: "2px solid #71717a",
            fontSize: 24,
            color: "#e4e4e7",
          }}
        >
          {team.sheet === "open" ? "Open team sheet" : "Team report"}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 44,
          fontSize: 76,
          fontWeight: 800,
          letterSpacing: -1.5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {team.name.trim() || "Shared team"}
      </div>
      <div style={{ display: "flex", marginTop: 8, fontSize: 32, color: "#a1a1aa", height: 40 }}>
        {creator ? `by ${creator}` : ""}
      </div>

      <div style={{ display: "flex", gap: 20, marginTop: "auto" }}>
        {team.pokemon.slice(0, 6).map((mon, index) => (
          <div
            key={`${mon.species}-${index}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 160,
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 160,
                height: 160,
                borderRadius: 24,
                background: "rgba(255, 255, 255, 0.08)",
                border: "2px solid rgba(255, 255, 255, 0.12)",
              }}
            >
              {sprites[index] ? (
                <img src={sprites[index]} width={136} height={136} alt="" />
              ) : (
                <div style={{ display: "flex", fontSize: 56, color: "#71717a" }}>?</div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 160,
                fontSize: 22,
                color: "#d4d4d8",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {mon.species}
            </div>
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
