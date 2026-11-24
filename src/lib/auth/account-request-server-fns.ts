import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";

const accountRequestStatus = z.enum(["PENDING", "APPROVED", "REJECTED"]);
const requestedRole = z.enum(["ADMIN", "FACILITATOR", "SMARTPHONE_FARMER", "BASIC_PHONE_FARMER"]);

const listQuerySchema = z.object({
  status: accountRequestStatus.optional(),
  requestedRole: requestedRole.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const requestIdSchema = z.object({
  id: z.string().uuid(),
});

const approveSchema = z.object({
  id: z.string().uuid(),
  note: z.string().trim().max(1000).optional(),
});

const rejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(5).max(1000),
});

function assertNoSensitivePayload(value: unknown): void {
  if (value == null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const forbidden = ["accessToken", "refreshToken", "sessionId", "tokenType"];
  for (const key of forbidden) {
    if (key in record) throw new Error(`Unsafe BFF payload key: ${key}`);
  }
  if (Array.isArray(value)) value.forEach(assertNoSensitivePayload);
  else Object.values(record).forEach((entry) => {
    if (entry != null && typeof entry === "object") assertNoSensitivePayload(entry);
  });
}

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

export const bffListAccountRequests = createServerFn({ method: "GET" })
  .validator((data: unknown) => listQuerySchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const { listAccountRequestsFromSession } = await import("@/lib/server/account-request-service");
    try {
      const result = await listAccountRequestsFromSession(data);
      assertNoSensitivePayload(result);
      return result;
    } catch (error) {
      return mapBffFailure(error);
    }
  });

export const bffGetAccountRequest = createServerFn({ method: "GET" })
  .validator((data: unknown) => requestIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { getAccountRequestFromSession } = await import("@/lib/server/account-request-service");
    try {
      const result = await getAccountRequestFromSession(data.id);
      assertNoSensitivePayload(result);
      return result;
    } catch (error) {
      return mapBffFailure(error);
    }
  });

export const bffApproveAccountRequest = createServerFn({ method: "POST" })
  .validator((data: unknown) => approveSchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { approveAccountRequestFromSession } = await import("@/lib/server/account-request-service");
    const { id, note } = data;
    try {
      const result = await approveAccountRequestFromSession(id, note ? { note } : {});
      assertNoSensitivePayload(result);
      return result;
    } catch (error) {
      return mapBffFailure(error);
    }
  });

export const bffRejectAccountRequest = createServerFn({ method: "POST" })
  .validator((data: unknown) => rejectSchema.parse(data))
  .handler(async ({ data }) => {
    await guardStateChangingRequest();
    const { rejectAccountRequestFromSession } = await import("@/lib/server/account-request-service");
    try {
      const result = await rejectAccountRequestFromSession(data.id, { reason: data.reason });
      assertNoSensitivePayload(result);
      return result;
    } catch (error) {
      return mapBffFailure(error);
    }
  });