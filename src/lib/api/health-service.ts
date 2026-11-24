import { api } from "./api-client";
import type { HealthResponse } from "./types";

/** Readiness check: `GET /health`. Throws `ApiError` when the process answers 503. */
export function checkHealth(): Promise<HealthResponse> {
  return api.get<HealthResponse>("health");
}
