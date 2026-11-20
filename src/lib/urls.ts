// Pure URL helpers (no Next imports): product, image and competitor links come from
// outside feeds, so only plain http(s) URLs ever reach an href or img src.

/** The URL if it's an absolute http or https URL, else undefined. */
export function httpUrl(value: string | null | undefined): string | undefined {
  if (!value || typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
