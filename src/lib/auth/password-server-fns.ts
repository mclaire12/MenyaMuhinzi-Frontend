import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";
import {
  forgotPasswordSchema,
  normalizeForgotIdentifier,
} from "@/lib/auth/password-schema";

const resetSubmitSchema = z.object({
  token: z.string().trim().min(1).max(256),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Za-z]/)
    .regex(/\d/),
});

async function mapBffFailure(error: unknown): Promise<never> {
  const { BffAuthError } = await import("@/lib/server/bff-error");
  if (error instanceof BffAuthError) throw serializeBffAuthFailure(error);
  if (error instanceof z.ZodError) {
    throw serializeBffAuthFailure(
      new BffAuthError("Amakuru yatanzwe ntiyemewe.", { code: "validation", status: 400, cause: error }),
    );
  }
  throw error;
}

async function guardStateChangingRequest(): Promise<void> {
  const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
  await assertBffStateChangeOrigin();
}

export const bffForgotPassword = createServerFn({ method: "POST" })
  .validator((data: unknown) => forgotPasswordSchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { requestPasswordReset, toSafeForgotPasswordResult } = await import(
      "@/lib/server/password-service"
    );
    try {
      const identifier = normalizeForgotIdentifier(data.identifier);
      const response = await requestPasswordReset(identifier);
      return toSafeForgotPasswordResult(response);
    } catch (error) {
      return mapBffFailure(error);
    }
  });

export const bffResetPassword = createServerFn({ method: "POST" })
  .validator((data: unknown) => resetSubmitSchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { resetPasswordWithToken } = await import("@/lib/server/password-service");
    try {
      await resetPasswordWithToken(data.token.trim(), data.newPassword);
      return { ok: true as const };
    } catch (error) {
      return mapBffFailure(error);
    }
  });