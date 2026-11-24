import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";

const startSchema = z.object({
  mode: z.enum(["login", "register"]),
  accountType: z.enum(["SMARTPHONE_FARMER", "FACILITATOR"]).optional(),
  phoneNumber: z.string().trim().optional(),
  fullName: z.string().trim().max(150).optional(),
  preferredLanguage: z.enum(["rw", "en", "fr"]).optional(),
});

const completeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  callbackUrl: z.string().url(),
});

async function mapBffAuthFailure(error: unknown): Promise<never> {
  const { BffAuthError } = await import("@/lib/server/bff-error");
  if (error instanceof BffAuthError) throw serializeBffAuthFailure(error);
  throw error;
}

async function guardStateChangingRequest(): Promise<void> {
  const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
  await assertBffStateChangeOrigin();
}

async function callbackRedirectUri(): Promise<string> {
  const { getServerRuntimeEnv } = await import("@/lib/server/runtime-env");
  return `${getServerRuntimeEnv().siteOrigin}/auth/google/callback`;
}

export const bffGoogleOAuthStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getGoogleOAuthStatus } = await import("@/lib/server/google-oauth-service");
  return getGoogleOAuthStatus();
});

export const bffGoogleOAuthStart = createServerFn({ method: "POST" })
  .validator((data: unknown) => startSchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { startGoogleOAuth } = await import("@/lib/server/google-oauth-service");
    try {
      return await startGoogleOAuth({ ...data, redirectUri: await callbackRedirectUri() });
    } catch (error) {
      return mapBffAuthFailure(error);
    }
  });

export const bffGoogleOAuthComplete = createServerFn({ method: "POST" })
  .validator((data: unknown) => completeSchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { completeGoogleOAuth } = await import("@/lib/server/google-oauth-service");
    try {
      const result = await completeGoogleOAuth(data);
      return result;
    } catch (error) {
      return mapBffAuthFailure(error);
    }
  });