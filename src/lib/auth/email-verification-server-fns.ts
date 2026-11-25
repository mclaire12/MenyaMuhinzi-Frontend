import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";
import { normalizeForgotIdentifier } from "@/lib/auth/password-schema";

const verifySchema = z.object({
  token: z.string().trim().min(1).max(256),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});
const resendSchema = z.object({ identifier: z.string().trim().min(1).max(254) });

async function mapBffFailure(error: unknown): Promise<never> {
  const { BffAuthError } = await import("@/lib/server/bff-error");
  if (error instanceof BffAuthError) throw serializeBffAuthFailure(error);
  if (error instanceof z.ZodError) {
    throw serializeBffAuthFailure(
      new BffAuthError("Amakuru yatanzwe ntiyemewe.", {
        code: "validation",
        status: 400,
        cause: error,
      }),
    );
  }
  throw error;
}

async function guardStateChangingRequest(): Promise<void> {
  const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
  await assertBffStateChangeOrigin();
}

export const bffVerifyEmail = createServerFn({ method: "POST" })
  .validator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { verifyEmailToken } = await import("@/lib/server/email-verification-service");
    try {
      await verifyEmailToken(data.token, data.code);
      return { ok: true as const };
    } catch (error) {
      return mapBffFailure(error);
    }
  });

export const bffResendVerification = createServerFn({ method: "POST" })
  .validator((data: unknown) => resendSchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { resendVerificationEmail } = await import("@/lib/server/email-verification-service");
    try {
      return await resendVerificationEmail(normalizeForgotIdentifier(data.identifier));
    } catch (error) {
      return mapBffFailure(error);
    }
  });
