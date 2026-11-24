import type { CurrentUserResponse } from "../api/types";
import type { BffLoginResult, WebSessionPublicMeta } from "@/lib/auth/bff-types";
import { createBackendClient } from "./backend-client";
import { BffAuthError } from "./bff-error";
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "./session-cookie";

export type { BffLoginResult, WebSessionPublicMeta };

let clientFactory = () => createBackendClient();

/** @internal */
export function setBackendClientFactory(factory: typeof clientFactory): void {
  clientFactory = factory;
}

/** @internal */
export function resetBackendClientFactory(): void {
  clientFactory = () => createBackendClient();
}

function client() {
  return clientFactory();
}

function clearSessionOnAuthFailure(error: unknown): void {
  if (error instanceof BffAuthError && (error.code === "unauthorized" || error.code === "forbidden")) {
    clearSessionCookie();
  }
}

type SessionRotation = { sessionId: string; expiresIn: number; accessToken: string };

const refreshInFlight = new Map<string, Promise<SessionRotation>>();

async function rotateWebSessionCookie(startSessionId: string): Promise<SessionRotation> {
  try {
    const rotated = await client().refreshWebSession(startSessionId);
    return {
      sessionId: rotated.sessionId,
      expiresIn: rotated.expiresIn,
      accessToken: rotated.accessToken,
    };
  } catch (error) {
    if (error instanceof BffAuthError && error.code === "unauthorized") {
      const current = readSessionCookie();
      if (current && current !== startSessionId) {
        const recovered = await client().refreshWebSession(current);
        return {
          sessionId: recovered.sessionId,
          expiresIn: recovered.expiresIn,
          accessToken: recovered.accessToken,
        };
      }
    }
    throw error;
  }
}

async function rotateSessionWithDedup(sessionId: string): Promise<SessionRotation> {
  const pending = refreshInFlight.get(sessionId);
  if (pending) return pending;

  const work = rotateWebSessionCookie(sessionId);
  refreshInFlight.set(sessionId, work);
  try {
    return await work;
  } finally {
    refreshInFlight.delete(sessionId);
  }
}

function applyRotatedSessionCookie(result: SessionRotation, previousSessionId: string): void {
  const current = readSessionCookie();
  if (!current || current === previousSessionId) writeSessionCookie(result.sessionId);
}

/** Server-only: refresh the web session cookie and return a short-lived NestJS access token. */
export async function obtainAccessTokenFromSession(): Promise<string> {
  const sessionId = readSessionCookie();
  if (!sessionId) {
    throw new BffAuthError("Nta sesiyo y'umukoresha.", { code: "unauthorized", status: 401 });
  }
  try {
    const result = await rotateSessionWithDedup(sessionId);
    applyRotatedSessionCookie(result, sessionId);
    return result.accessToken;
  } catch (error) {
    clearSessionOnAuthFailure(error);
    throw error;
  }
}

export async function loginWithPassword(email: string, password: string): Promise<BffLoginResult> {
  const created = await client().createWebSession(email, password);
  writeSessionCookie(created.sessionId);
  return {
    user: created.body.user,
    session: {
      idleExpiresAt: created.body.idleExpiresAt,
      absoluteExpiresAt: created.body.absoluteExpiresAt,
    },
  };
}

export async function getCurrentUserFromSession(): Promise<CurrentUserResponse | null> {
  const sessionId = readSessionCookie();
  if (!sessionId) return null;
  try {
    return await client().getWebSessionUser(sessionId);
  } catch (error) {
    clearSessionOnAuthFailure(error);
    if (error instanceof BffAuthError && (error.code === "unauthorized" || error.code === "forbidden")) {
      return null;
    }
    throw error;
  }
}

export async function restoreSessionFromCookie(): Promise<CurrentUserResponse | null> {
  return getCurrentUserFromSession();
}

export async function refreshSessionCredentials(): Promise<{ expiresIn: number }> {
  const sessionId = readSessionCookie();
  if (!sessionId) {
    throw new BffAuthError("Nta sesiyo y'umukoresha.", { code: "unauthorized", status: 401 });
  }

  try {
    const result = await rotateSessionWithDedup(sessionId);
    applyRotatedSessionCookie(result, sessionId);
    return { expiresIn: result.expiresIn };
  } catch (error) {
    clearSessionOnAuthFailure(error);
    throw error;
  }
}

export async function logoutSession(): Promise<{ ok: true }> {
  const sessionId = readSessionCookie();
  clearSessionCookie();
  if (sessionId) {
    try {
      await client().logoutWebSession(sessionId);
    } catch (error) {
      if (error instanceof BffAuthError && error.code === "unauthorized") return { ok: true };
      throw error;
    }
  }
  return { ok: true };
}

export async function changePasswordWithSession(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true }> {
  const sessionId = readSessionCookie();
  if (!sessionId) {
    throw new BffAuthError("Nta sesiyo y'umukoresha.", { code: "unauthorized", status: 401 });
  }
  let accessToken: string;
  let activeSessionId = sessionId;
  try {
    const rotated = await rotateSessionWithDedup(sessionId);
    applyRotatedSessionCookie(rotated, sessionId);
    activeSessionId = rotated.sessionId;
    accessToken = rotated.accessToken;
  } catch (error) {
    clearSessionOnAuthFailure(error);
    throw error;
  }

  try {
    await client().changePassword(accessToken, input);
  } catch (error) {
    throw error;
  }

  clearSessionCookie();
  try {
    await client().logoutWebSession(activeSessionId);
  } catch {
    /* family may already be revoked */
  }
  return { ok: true };
}

/** @internal */
export function resetRefreshInFlightForTests(): void {
  refreshInFlight.clear();
}