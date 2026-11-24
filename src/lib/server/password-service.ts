import type { ForgotPasswordResponse } from "../api/types";
import { createBackendClient } from "./backend-client";

let clientFactory = () => createBackendClient();

/** @internal */
export function setPasswordBackendClientFactory(factory: typeof clientFactory): void {
  clientFactory = factory;
}

/** @internal */
export function resetPasswordBackendClientFactory(): void {
  clientFactory = () => createBackendClient();
}

function client() {
  return clientFactory();
}

export async function requestPasswordReset(identifier: string): Promise<ForgotPasswordResponse> {
  return client().forgotPassword(identifier);
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  await client().resetPassword(token, newPassword);
}

/** Strip dev-only reset tokens before any browser-visible payload. */
export function toSafeForgotPasswordResult(
  response: ForgotPasswordResponse,
): { message: string } {
  return { message: response.message };
}