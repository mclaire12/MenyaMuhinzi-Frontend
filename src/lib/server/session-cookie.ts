import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { getServerRuntimeEnv } from "./runtime-env";
import { shouldUseSecureSessionCookie } from "./session-cookie-security";

export function sessionCookieName(): string {
  return getServerRuntimeEnv().webSessionCookieName;
}

export function readSessionCookie(): string | undefined {
  const value = getCookie(sessionCookieName());
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sessionCookieFlags() {
  return {
    httpOnly: true as const,
    secure: shouldUseSecureSessionCookie(),
    sameSite: "lax" as const,
    path: "/",
  };
}

export function writeSessionCookie(sessionId: string): void {
  setCookie(sessionCookieName(), sessionId, sessionCookieFlags());
}

export function clearSessionCookie(): void {
  deleteCookie(sessionCookieName(), sessionCookieFlags());
}

/** Exposed for tests to read the flags we would pass to setCookie. */
export function sessionCookieOptionsForTest(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
} {
  return sessionCookieFlags();
}