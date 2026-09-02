/**
 * `crypto.randomUUID()` only exists in secure contexts (HTTPS or localhost).
 * Loading the dev server from a phone over plain HTTP via a LAN IP (e.g.
 * `http://192.168.x.x:3000`) is an insecure context, so it's undefined there
 * and throws. `crypto.getRandomValues()` has no such restriction, so build a
 * v4 UUID from it as a fallback.
 */
export function generateId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
