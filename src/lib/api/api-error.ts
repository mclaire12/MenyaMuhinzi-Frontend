import type { ApiErrorResponse } from "./types";

export type ApiErrorKind =
  "http" | "network" | "timeout" | "aborted" | "response" | "configuration";

/** Status groups future services can branch on without comparing raw codes. */
export type ApiErrorCategory =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "locked"
  | "rate_limit"
  | "server"
  | "network"
  | "timeout"
  | "aborted"
  | "response"
  | "configuration"
  | "http";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly response: ApiErrorResponse | undefined;

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind;
      status?: number;
      response?: ApiErrorResponse;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.response = options.response;
  }

  category(): ApiErrorCategory {
    if (this.kind === "network") return "network";
    if (this.kind === "timeout") return "timeout";
    if (this.kind === "aborted") return "aborted";
    if (this.kind === "response") return "response";
    if (this.kind === "configuration") return "configuration";
    switch (this.status) {
      case 400: return "validation";
      case 401: return "unauthorized";
      case 403: return "forbidden";
      case 404: return "not_found";
      case 409: return "conflict";
      case 423: return "locked";
      case 429: return "rate_limit";
      default: return this.status !== undefined && this.status >= 500 ? "server" : "http";
    }
  }
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) return false;

  const body = value as Record<string, unknown>;
  return (
    typeof body["statusCode"] === "number" &&
    typeof body["error"] === "string" &&
    (typeof body["message"] === "string" ||
      (Array.isArray(body["message"]) &&
        body["message"].every((item) => typeof item === "string"))) &&
    typeof body["path"] === "string" &&
    typeof body["method"] === "string" &&
    typeof body["timestamp"] === "string"
  );
}

export function getApiErrorMessage(error: ApiErrorResponse): string {
  return Array.isArray(error.message) ? error.message.join(", ") : error.message;
}
