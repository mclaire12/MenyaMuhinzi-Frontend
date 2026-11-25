import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";

const rangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const bffGetFacilitatorDashboard = createServerFn({ method: "GET" })
  .validator((data: unknown) => rangeSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const { getFacilitatorDashboardFromSession } =
      await import("@/lib/server/facilitator-dashboard-service");
    try {
      return await getFacilitatorDashboardFromSession(data);
    } catch (error) {
      const { BffAuthError } = await import("@/lib/server/bff-error");
      if (error instanceof BffAuthError) throw serializeBffAuthFailure(error);
      throw error;
    }
  });
