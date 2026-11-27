import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADMIN_API_METHODS, isAllowedAdminApiPath } from "@/lib/api/admin-api-routes";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";

const inputSchema = z.object({
  method: z.enum(ADMIN_API_METHODS as [string, ...string[]]),
  path: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine(isAllowedAdminApiPath, "Endpoint not available to the admin portal"),
  query: z
    .record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()]).optional())
    .optional(),
  body: z.unknown().optional(),
});

/**
 * Admin portal → backend, through the BFF: the browser never sees tokens. State-changing calls
 * also pass the Origin check. Only allow-listed admin endpoints are reachable.
 */
export const bffAdminApi = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.method !== "GET") {
      const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
      await assertBffStateChangeOrigin();
    }
    const { callAdminApiFromSession } = await import("@/lib/server/admin-api-service");
    try {
      return (await callAdminApiFromSession({
        method: data.method as "GET",
        path: data.path,
        query: data.query,
        body: data.body,
      })) as never;
    } catch (error) {
      const { BffAuthError } = await import("@/lib/server/bff-error");
      if (error instanceof BffAuthError) throw serializeBffAuthFailure(error);
      throw error;
    }
  });
