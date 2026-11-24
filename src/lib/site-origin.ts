/** Normalizes an origin URL to `protocol//host` (scheme, host, port). */
export function normalizeOrigin(value: string): string {
  const url = new URL(value.trim());
  return `${url.protocol}//${url.host}`;
}

export function matchesConfiguredSiteOrigin(
  origin: string | undefined,
  configured: string | undefined,
): boolean {
  if (!origin) return true;
  if (!configured?.trim()) return false;
  try {
    return normalizeOrigin(origin) === normalizeOrigin(configured);
  } catch {
    return false;
  }
}