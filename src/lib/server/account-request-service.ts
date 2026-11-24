import type {
  AccountRequestResponse,
  ApproveAccountRequestInput,
  ListAccountRequestsQuery,
  PaginatedAccountRequests,
  RejectAccountRequestInput,
} from "../api/account-request-types";
import { obtainAccessTokenFromSession } from "./auth-service";
import { createBackendClient } from "./backend-client";

let clientFactory = () => createBackendClient();

/** @internal */
export function setAccountRequestBackendClientFactory(factory: typeof clientFactory): void {
  clientFactory = factory;
}

/** @internal */
export function resetAccountRequestBackendClientFactory(): void {
  clientFactory = () => createBackendClient();
}

function client() {
  return clientFactory();
}

export async function listAccountRequestsFromSession(
  query: ListAccountRequestsQuery,
): Promise<PaginatedAccountRequests> {
  const accessToken = await obtainAccessTokenFromSession();
  return client().listAccountRequests(accessToken, query);
}

export async function getAccountRequestFromSession(id: string): Promise<AccountRequestResponse> {
  const accessToken = await obtainAccessTokenFromSession();
  return client().getAccountRequest(accessToken, id);
}

export async function approveAccountRequestFromSession(
  id: string,
  input: ApproveAccountRequestInput,
): Promise<AccountRequestResponse> {
  const accessToken = await obtainAccessTokenFromSession();
  return client().approveAccountRequest(accessToken, id, input);
}

export async function rejectAccountRequestFromSession(
  id: string,
  input: RejectAccountRequestInput,
): Promise<AccountRequestResponse> {
  const accessToken = await obtainAccessTokenFromSession();
  return client().rejectAccountRequest(accessToken, id, input);
}