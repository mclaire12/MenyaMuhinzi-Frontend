import type { QueryClient } from "@tanstack/react-query";
import { isUnavailableAuthError, type ParsedBffError } from "@/lib/auth/parse-bff-error";
import { accountRequestDetailQueryKey } from "@/lib/admin/account-request-detail";

export const REJECT_REASON_MIN = 5;
export const REJECT_REASON_MAX = 1000;

export function validateRejectReason(raw: string): string | null {
  const reason = raw.trim();
  if (!reason) return "Enter a reason for rejecting this request.";
  if (reason.length < REJECT_REASON_MIN) {
    return `The reason must be at least ${REJECT_REASON_MIN} characters.`;
  }
  if (reason.length > REJECT_REASON_MAX) {
    return `The reason must be at most ${REJECT_REASON_MAX} characters.`;
  }
  return null;
}

export function resolveAccountRequestDecisionError(parsed: ParsedBffError): string {
  if (parsed.code === "unauthorized" || parsed.status === 401) {
    return "Your session has expired. Sign in again before deciding account requests.";
  }
  if (parsed.code === "forbidden" || parsed.status === 403) {
    return "You do not have permission to approve or reject account requests.";
  }
  if (parsed.status === 404) {
    return "This account request was not found. It may have been removed.";
  }
  if (parsed.status === 409) {
    return "This request was already decided by another administrator. Refreshing the latest status.";
  }
  if (parsed.code === "validation" || parsed.status === 400) {
    return (
      parsed.message.trim() || "The decision could not be submitted. Check the form and try again."
    );
  }
  if (isUnavailableAuthError(parsed) || parsed.status === 503) {
    return "The decision could not be saved right now. Try again shortly.";
  }
  if (parsed.message.trim()) return parsed.message;
  return "The decision could not be completed.";
}

export function invalidateAccountRequestQueries(
  queryClient: QueryClient,
  requestId?: string,
): void {
  if (requestId) {
    void queryClient.invalidateQueries({ queryKey: accountRequestDetailQueryKey(requestId) });
  }
  void queryClient.invalidateQueries({
    predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "account-requests",
  });
}

export function accountRequestQueriesPredicate(queryKey: unknown): boolean {
  return Array.isArray(queryKey) && queryKey[0] === "account-requests";
}
