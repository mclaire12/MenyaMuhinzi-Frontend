/** NestJS ↔ BFF header names (lowercase HTTP). Never log values. */
export const BFF_SECRET_HEADER = "x-menya-bff-secret";
export const WEB_SESSION_HEADER = "x-menya-web-session";
export const ACCESS_TOKEN_HEADER = "x-menya-access-token";
export const ACCESS_EXPIRES_HEADER = "x-menya-access-expires-in";

export const SENSITIVE_HEADER_NAMES = new Set([
  BFF_SECRET_HEADER,
  WEB_SESSION_HEADER,
  ACCESS_TOKEN_HEADER,
  "authorization",
  "cookie",
]);

export function redactHeaderRecord(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return redacted;
}