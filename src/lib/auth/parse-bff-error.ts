import type { BffErrorCode } from "@/lib/server/bff-error";

export const BFF_AUTH_ERROR_PREFIX = "__BFF_AUTH__:";

export interface ParsedBffError {
  code: BffErrorCode;
  message: string;
  status?: number;
}

export function serializeBffAuthFailure(error: {
  code: BffErrorCode;
  message: string;
  status?: number | undefined;
}): Error {
  const payload = JSON.stringify({
    code: error.code,
    message: error.message,
    status: error.status,
  });
  return new Error(`${BFF_AUTH_ERROR_PREFIX}${payload}`);
}

export function parseBffError(error: unknown): ParsedBffError {
  if (error instanceof Error && error.message.startsWith(BFF_AUTH_ERROR_PREFIX)) {
    try {
      const raw = JSON.parse(error.message.slice(BFF_AUTH_ERROR_PREFIX.length)) as ParsedBffError;
      if (raw.code && raw.message) return raw;
    } catch {
      /* fall through */
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return { code: "unknown", message: error.message };
  }
  return { code: "unknown", message: "Igikorwa nticyashoboye." };
}

export function isUnavailableAuthError(error: ParsedBffError): boolean {
  return error.code === "unavailable" || error.code === "network" || error.code === "timeout";
}