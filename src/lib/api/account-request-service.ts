import type {
  AccountRequestResponse,
  ApproveAccountRequestInput,
  ListAccountRequestsQuery,
  PaginatedAccountRequests,
  RejectAccountRequestInput,
} from "./account-request-types";
import {
  bffApproveAccountRequest,
  bffGetAccountRequest,
  bffListAccountRequests,
  bffRejectAccountRequest,
} from "@/lib/auth/account-request-server-fns";

export type {
  AccountDecision,
  AccountRequestResponse,
  AccountRequestStatus,
  ApprovalDecision,
  ApproveAccountRequestInput,
  ListAccountRequestsQuery,
  PaginatedAccountRequests,
  PaginationMeta,
  RejectAccountRequestInput,
  UserDetailResponse,
  UserReference,
} from "./account-request-types";

export async function listAccountRequests(
  query: ListAccountRequestsQuery = {},
): Promise<PaginatedAccountRequests> {
  return bffListAccountRequests({ data: query });
}

export async function getAccountRequest(id: string): Promise<AccountRequestResponse> {
  return bffGetAccountRequest({ data: { id } });
}

export async function approveAccountRequest(
  id: string,
  input: ApproveAccountRequestInput = {},
): Promise<AccountRequestResponse> {
  return bffApproveAccountRequest({ data: { id, ...input } });
}

export async function rejectAccountRequest(
  id: string,
  input: RejectAccountRequestInput,
): Promise<AccountRequestResponse> {
  return bffRejectAccountRequest({ data: { id, reason: input.reason } });
}