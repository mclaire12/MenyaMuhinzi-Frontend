import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { basicPhoneFarmerInputSchema } from "@/lib/api/basic-phone-farmer-types";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";

const createSchema = z.object({
  mode: z.enum(["direct", "request"]),
  farmer: basicPhoneFarmerInputSchema,
});

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

/** Staff-only: registers a basic-phone farmer through the BFF session (CSRF/Origin guarded). */
export const bffCreateBasicPhoneFarmer = createServerFn({ method: "POST" })
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
    await assertBffStateChangeOrigin();
    const { createBasicPhoneFarmerFromSession } =
      await import("@/lib/server/basic-phone-farmer-service");
    try {
      return await createBasicPhoneFarmerFromSession(data.mode, data.farmer);
    } catch (error) {
      return mapBffFailure(error);
    }
  });
