import {
  adminApiQueryString,
  isAllowedAdminApiPath,
  type AdminApiMethod,
  type AdminApiQuery,
} from "../api/admin-api-routes";
import { obtainAccessTokenFromSession } from "./auth-service";
import { createBackendClient } from "./backend-client";
import { BffAuthError } from "./bff-error";

let clientFactory = () => createBackendClient();

/** @internal */
export function setAdminApiBackendClientFactory(factory: typeof clientFactory): void {
  clientFactory = factory;
}

/** @internal */
export function resetAdminApiBackendClientFactory(): void {
  clientFactory = () => createBackendClient();
}

const SENSITIVE_KEYS = new Set([
  "accessToken",
  "refreshToken",
  "sessionId",
  "tokenHash",
  "passwordHash",
  "apiKey",
  "secret",
]);

/** Defence in depth: such fields must never be forwarded to the browser. */
export function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) continue;
      out[key] = stripSensitive(entry);
    }
    return out;
  }
  return value;
}

export async function callAdminApiFromSession(input: {
  method: AdminApiMethod;
  path: string;
  query?: AdminApiQuery | undefined;
  body?: unknown;
}): Promise<unknown> {
  if (!isAllowedAdminApiPath(input.path)) {
    throw new BffAuthError("Igikorwa nticyemewe.", { code: "forbidden", status: 403 });
  }
  const accessToken = await obtainAccessTokenFromSession();
  const payload = await clientFactory().adminCall(
    accessToken,
    input.method,
    `${input.path}${adminApiQueryString(input.query)}`,
    input.method === "GET" || input.method === "DELETE" ? undefined : (input.body ?? {}),
  );
  return stripSensitive(payload);
}
