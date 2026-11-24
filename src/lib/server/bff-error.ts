import { getApiErrorMessage, isApiErrorResponse } from "../api/api-error";

export type BffErrorCode =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "locked"
  | "rate_limit"
  | "unavailable"
  | "network"
  | "timeout"
  | "configuration"
  | "unknown";

/** Safe, browser-facing authentication error without secrets or session identifiers. */
export class BffAuthError extends Error {
  readonly code: BffErrorCode;
  readonly status: number | undefined;

  constructor(message: string, options: { code: BffErrorCode; status?: number; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = "BffAuthError";
    this.code = options.code;
    this.status = options.status;
  }
}

export function mapHttpStatusToBffCode(status: number): BffErrorCode {
  switch (status) {
    case 400:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "unknown";
    case 409:
      return "unknown";
    case 423:
      return "locked";
    case 429:
      return "rate_limit";
    case 503:
      return "unavailable";
    default:
      return status >= 500 ? "unavailable" : "unknown";
  }
}

export function safeBackendMessage(payload: unknown, status: number): string {
  if (isApiErrorResponse(payload)) return getApiErrorMessage(payload);
  if (status === 401) return "Email cyangombwa cyangombwa nticyemewe.";
  if (status === 403) return "Konti ntishobora gukoreshwa.";
  if (status === 423) return "Konti ifunze by'agateganyo.";
  if (status === 429) return "Ibigeragezo byinshi. Gerageza nyuma.";
  if (status === 503) return "Serivisi ntiboneka by'agateganyo.";
  if (status >= 500) return "Serivisi ntiboneka.";
  return "Igikorwa nticyashoboye.";
}