import { createBackendClient } from "./backend-client";

let clientFactory = () => createBackendClient();

/** @internal */
export function setEmailVerificationBackendClientFactory(factory: typeof clientFactory): void {
  clientFactory = factory;
}

/** @internal */
export function resetEmailVerificationBackendClientFactory(): void {
  clientFactory = () => createBackendClient();
}

/** The link token and the 6-digit code from the same email are both required. */
export async function verifyEmailToken(token: string, code: string): Promise<void> {
  await clientFactory().verifyEmail(token, code);
}

export async function resendVerificationEmail(identifier: string): Promise<{ message: string }> {
  const response = await clientFactory().resendVerification(identifier);
  // Only the generic message reaches the browser.
  return { message: response.message };
}
