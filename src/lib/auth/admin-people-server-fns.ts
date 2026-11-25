import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addUserSchema } from "@/lib/api/add-user-types";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";

const role = z.enum(["ADMIN", "FACILITATOR", "SMARTPHONE_FARMER", "BASIC_PHONE_FARMER"]);
const status = z.enum(["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED", "REJECTED"]);

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: status.optional(),
  role: role.optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  reason: z.string().trim().min(5).max(500).optional(),
});

const rangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
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

export const bffListUsers = createServerFn({ method: "GET" })
  .validator((data: unknown) => listSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const { listUsersFromSession } = await import("@/lib/server/admin-people-service");
    try {
      return await listUsersFromSession(data);
    } catch (error) {
      return mapBffFailure(error);
    }
  });

export const bffGetUser = createServerFn({ method: "GET" })
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const { getUserFromSession } = await import("@/lib/server/admin-people-service");
    try {
      return await getUserFromSession(data.id);
    } catch (error) {
      return mapBffFailure(error);
    }
  });

export const bffUpdateUserStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) => statusSchema.parse(data))
  .handler(async ({ data }) => {
    const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
    await assertBffStateChangeOrigin();
    const { updateUserStatusFromSession } = await import("@/lib/server/admin-people-service");
    const { id, ...input } = data;
    try {
      return await updateUserStatusFromSession(id, input);
    } catch (error) {
      return mapBffFailure(error);
    }
  });

export const bffCreateUser = createServerFn({ method: "POST" })
  .validator((data: unknown) => addUserSchema.parse(data))
  .handler(async ({ data }) => {
    const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
    await assertBffStateChangeOrigin();
    const { createUserFromSession } = await import("@/lib/server/admin-people-service");
    try {
      return await createUserFromSession(data);
    } catch (error) {
      return mapBffFailure(error);
    }
  });

export const bffGetAdminDashboard = createServerFn({ method: "GET" })
  .validator((data: unknown) => rangeSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const { getAdminDashboardFromSession } = await import("@/lib/server/admin-people-service");
    try {
      return await getAdminDashboardFromSession(data);
    } catch (error) {
      return mapBffFailure(error);
    }
  });
