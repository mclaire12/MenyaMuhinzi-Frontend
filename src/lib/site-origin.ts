/** Normalizes an origin URL to `protocol//host` (scheme, host, port). */
export function normalizeOrigin(value: string): string {
  const url = new URL(value.trim());
  return `${url.protocol}//${url.host}`;
}

function effectivePort(protocol: string, port: string): string {
  if (port) return port;
  return protocol === "https:" ? "443" : "80";
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

/** Private LAN / WSL host interfaces (e.g. 172.30.x.x on Windows↔WSL). */
function isPrivateLanHost(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Local dev often opens the Vite host by IP (127.0.0.1, WSL bridge 172.x, 192.168.x)
 * while `SITE_ORIGIN` stays `http://localhost:3000`. Same port + protocol is enough.
 */
export function matchesLocalDevSiteOrigin(
  origin: string | undefined,
  configured: string | undefined,
): boolean {
  if (!origin || !configured?.trim()) return false;
  try {
    const request = new URL(origin);
    const expected = new URL(configured);
    if (request.protocol !== expected.protocol) return false;
    if (effectivePort(request.protocol, request.port) !== effectivePort(expected.protocol, expected.port)) {
      return false;
    }
    return isLoopbackHost(request.hostname) || isPrivateLanHost(request.hostname);
  } catch {
    return false;
  }
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

export function isSiteOriginAllowed(
  origin: string | undefined,
  configured: string | undefined,
  options?: { allowLocalDevAliases?: boolean },
): boolean {
  if (matchesConfiguredSiteOrigin(origin, configured)) return true;
  if (options?.allowLocalDevAliases && matchesLocalDevSiteOrigin(origin, configured)) return true;
  return false;
}

export function isLocalDevOriginPolicy(): boolean {
  return process.env["NODE_ENV"] !== "production";
}