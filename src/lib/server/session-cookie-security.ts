import { getRequestProtocol } from "@tanstack/react-start/server";

/**
 * Whether the platform forwards a trusted `x-forwarded-proto` hop (Vercel edge).
 * We only opt in on Vercel; clients cannot spoof this into cookie flags elsewhere.
 */
export function trustedForwardedProto(): boolean {
  return process.env["VERCEL"] === "1";
}

/** True when the active request is served over HTTPS (including behind Vercel's proxy). */
export function shouldUseSecureSessionCookie(): boolean {
  return getRequestProtocol(trustedForwardedProto() ? { xForwardedProto: true } : {}) === "https";
}