import type { BffLoginResult } from "@/lib/auth/bff-types";
import { createBackendClient } from "./backend-client";
import { writeSessionCookie } from "./session-cookie";

let clientFactory = () => createBackendClient();

/** @internal */
export function setGoogleOAuthClientFactory(factory: typeof clientFactory): void {
  clientFactory = factory;
}

/** @internal */
export function resetGoogleOAuthClientFactory(): void {
  clientFactory = () => createBackendClient();
}

function client() {
  return clientFactory();
}

export async function getGoogleOAuthStatus(): Promise<{ enabled: boolean; clientId?: string }> {
  return client().getGoogleOAuthStatus();
}

export async function startGoogleOAuth(input: {
  mode: "login" | "register";
  redirectUri: string;
  accountType?: string;
  phoneNumber?: string;
  fullName?: string;
  preferredLanguage?: string;
}): Promise<{ authorizationUrl: string }> {
  return client().startGoogleOAuth(input);
}

export async function completeGoogleOAuth(input: {
  code: string;
  state: string;
  callbackUrl: string;
}): Promise<BffLoginResult> {
  const created = await client().completeGoogleOAuth(input);
  writeSessionCookie(created.sessionId);
  return {
    user: created.body.user,
    session: {
      idleExpiresAt: created.body.idleExpiresAt,
      absoluteExpiresAt: created.body.absoluteExpiresAt,
    },
  };
}