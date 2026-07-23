/**
 * Generates a v4 UUID for local (client-side) identity, e.g. React keys.
 *
 * crypto.randomUUID() exists only in secure contexts (HTTPS, or localhost).
 * When the app is served over plain HTTP — an EC2 instance reached by IP,
 * a LAN preview — it's undefined and calling it throws. crypto.getRandomValues()
 * is available in insecure contexts too, so we fall back to building the UUID
 * from it. HTTPS in production is still the right fix; this just keeps the app
 * from hard-crashing without it.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}
