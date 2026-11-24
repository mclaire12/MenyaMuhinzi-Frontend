import { queryOptions } from "@tanstack/react-query";
import type { UserRole } from "@/lib/api/types";
import { listAccountRequests } from "@/lib/api/account-request-service";
import type { ListAccountRequestsQuery } from "@/lib/api/account-request-types";
import {
  parseBffError,
  isUnavailableAuthError,
  type ParsedBffError,
} from "@/lib/auth/parse-bff-error";
import {
  approvalsViewToApiStatus,
  mapAccountRequestToRow,
  type ApprovalsView,
} from "@/lib/admin/account-request-mapper";

export const APPROVALS_PAGE_SIZE = 10;

export interface AccountRequestListParams {
  view: ApprovalsView;
  search: string;
  role: UserRole | "all";
  page: number;
}

export function buildListAccountRequestsQuery(
  params: AccountRequestListParams,
): ListAccountRequestsQuery {
  const search = params.search.trim();
  return {
    status: approvalsViewToApiStatus(params.view),
    ...(search ? { search } : {}),
    ...(params.role !== "all" ? { requestedRole: params.role } : {}),
    page: params.page + 1,
    limit: APPROVALS_PAGE_SIZE,
  };
}

export function accountRequestListQueryKey(params: AccountRequestListParams) {
  return [
    "account-requests",
    "list",
    {
      view: params.view,
      search: params.search.trim(),
      role: params.role,
      page: params.page,
    },
  ] as const;
}

export function accountRequestCountQueryKey(status: "PENDING" | "APPROVED" | "REJECTED") {
  return ["account-requests", "count", status] as const;
}

export function accountRequestListQueryOptions(params: AccountRequestListParams, enabled: boolean) {
  return queryOptions({
    queryKey: accountRequestListQueryKey(params),
    queryFn: async () => {
      const result = await listAccountRequests(buildListAccountRequestsQuery(params));
      return {
        ...result,
        rows: result.data.map(mapAccountRequestToRow),
      };
    },
    enabled,
    retry: false,
  });
}

export function accountRequestStatusCountQueryOptions(
  status: "PENDING" | "APPROVED" | "REJECTED",
  enabled: boolean,
) {
  return queryOptions({
    queryKey: accountRequestCountQueryKey(status),
    queryFn: () => listAccountRequests({ status, page: 1, limit: 1 }),
    enabled,
    staleTime: 30_000,
    select: (data) => data.meta.total,
  });
}

export function resolveApprovalsListErrorMessage(parsed: ParsedBffError): string {
  if (parsed.code === "unauthorized" || parsed.status === 401) {
    return "Your session has expired or is unavailable. Sign in again to review account requests.";
  }
  if (parsed.code === "forbidden" || parsed.status === 403) {
    return "You do not have permission to view account requests.";
  }
  if (isUnavailableAuthError(parsed) || parsed.status === 503) {
    return "Account requests cannot be loaded right now. The service is temporarily unavailable.";
  }
  if (parsed.message.trim()) return parsed.message;
  return "Account requests could not be loaded.";
}

export function parseApprovalsListError(error: unknown): ParsedBffError {
  return parseBffError(error);
}

export const approvalsEmptyCopy: Record<ApprovalsView, string> = {
  pending: "No account requests are waiting.",
  approved: "No approved accounts.",
  rejected: "No rejected accounts.",
};
