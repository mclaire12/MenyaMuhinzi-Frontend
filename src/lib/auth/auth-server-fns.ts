import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { changePasswordSubmitSchema } from "@/lib/auth/password-schema";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";

export type { BffLoginResult } from "./bff-types";

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

function assertNoSensitivePayload(value: unknown): void {
  if (value == null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const forbidden = ["accessToken", "refreshToken", "sessionId", "tokenType"];
  for (const key of forbidden) {
    if (key in record) throw new Error(`Unsafe BFF payload key: ${key}`);
  }
}

async function mapBffAuthFailure(error: unknown): Promise<never> {
  const { BffAuthError } = await import("@/lib/server/bff-error");
  if (error instanceof BffAuthError) throw serializeBffAuthFailure(error);
  throw error;
}

async function guardStateChangingRequest(): Promise<void> {
  const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
  await assertBffStateChangeOrigin();
}

export const bffLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { loginWithPassword } = await import("@/lib/server/auth-service");
    try {
      const result = await loginWithPassword(data.identifier, data.password);
      assertNoSensitivePayload(result);
      return result;
    } catch (error) {
      return mapBffAuthFailure(error);
    }
  });

export const bffGetCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getCurrentUserFromSession } = await import("@/lib/server/auth-service");
  try {
    const user = await getCurrentUserFromSession();
    assertNoSensitivePayload(user);
    return user;
  } catch (error) {
    return mapBffAuthFailure(error);
  }
});

export const bffRestoreSession = createServerFn({ method: "GET" }).handler(async () => {
  const { restoreSessionFromCookie } = await import("@/lib/server/auth-service");
  try {
    const user = await restoreSessionFromCookie();
    assertNoSensitivePayload(user);
    return user;
  } catch (error) {
    return mapBffAuthFailure(error);
  }
});

export const bffRefreshSession = createServerFn({ method: "POST" }).handler(async () => {
  await guardStateChangingRequest();
  const { refreshSessionCredentials } = await import("@/lib/server/auth-service");
  const meta = await refreshSessionCredentials();
  assertNoSensitivePayload(meta);
  return meta;
});

export const bffLogout = createServerFn({ method: "POST" }).handler(async () => {
  await guardStateChangingRequest();
  const { logoutSession } = await import("@/lib/server/auth-service");
  try {
    return await logoutSession();
  } catch (error) {
    return mapBffAuthFailure(error);
  }
});

export const bffChangePassword = createServerFn({ method: "POST" })
  .validator((data: unknown) => changePasswordSubmitSchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { changePasswordWithSession } = await import("@/lib/server/auth-service");
    try {
      return await changePasswordWithSession(data);
    } catch (error) {
      return mapBffAuthFailure(error);
    }
  });