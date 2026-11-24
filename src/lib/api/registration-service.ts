import { api } from "./api-client";
import type { RegistrationRequest, RegistrationResponse } from "./types";

/** POST /auth/register. Does not store tokens or write to the local mock store. */
export function registerAccount(request: RegistrationRequest): Promise<RegistrationResponse> {
  return api.post<RegistrationResponse>("auth/register", request);
}
