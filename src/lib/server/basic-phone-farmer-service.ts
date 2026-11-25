import type {
  BasicPhoneFarmerCreated,
  BasicPhoneFarmerInput,
  BasicPhoneFarmerSubmission,
  CreateBasicPhoneFarmerBody,
} from "../api/basic-phone-farmer-types";
import { obtainAccessTokenFromSession } from "./auth-service";
import { createBackendClient } from "./backend-client";

let clientFactory = () => createBackendClient();

/** @internal */
export function setBasicPhoneFarmerBackendClientFactory(factory: typeof clientFactory): void {
  clientFactory = factory;
}

/** @internal */
export function resetBasicPhoneFarmerBackendClientFactory(): void {
  clientFactory = () => createBackendClient();
}

export function toCreateFarmerBody(input: BasicPhoneFarmerInput): CreateBasicPhoneFarmerBody {
  return {
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    email: input.email,
    preferredLanguage: input.preferredLanguage,
    farmerType: "BASIC_PHONE",
    ...(input.farmerCategory ? { farmerCategory: input.farmerCategory } : {}),
    ...(input.password ? { password: input.password } : {}),
    location: input.location,
  };
}

/**
 * Creates a basic-phone farmer with the signed-in staff member's session. The backend decides
 * whether the caller may do so: POST /farmers needs farmers:create (administrators),
 * POST /accounts/requests needs account-requests:create (facilitators, pending approval).
 */
export async function createBasicPhoneFarmerFromSession(
  mode: BasicPhoneFarmerSubmission,
  input: BasicPhoneFarmerInput,
): Promise<BasicPhoneFarmerCreated> {
  const accessToken = await obtainAccessTokenFromSession();
  const body = toCreateFarmerBody(input);

  if (mode === "direct") {
    const farmer = await clientFactory().createFarmer(accessToken, body);
    return {
      mode,
      userId: farmer.userId,
      fullName: farmer.fullName,
      phoneNumber: farmer.phoneNumber,
      email: farmer.email,
      status: farmer.status,
      accountRequestId: null,
      emailSent: farmer.emailSent ?? null,
    };
  }

  // Account requests do not take a password; the farmer sets one through password reset.
  const { password: _password, ...requestBody } = body;
  const request = await clientFactory().createAccountRequest(accessToken, {
    ...requestBody,
    ...(input.notes ? { notes: input.notes } : {}),
  });
  return {
    mode,
    userId: request.applicant.id,
    fullName: request.applicant.fullName,
    phoneNumber: request.applicant.phoneNumber,
    email: request.applicant.email,
    status: request.applicant.status,
    accountRequestId: request.id,
    emailSent: null,
  };
}
