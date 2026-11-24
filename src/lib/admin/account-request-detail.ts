import { queryOptions } from "@tanstack/react-query";
import { getAccountRequest } from "@/lib/api/account-request-service";
import type { AccountRequestResponse } from "@/lib/api/account-request-types";
import type { FarmerCategory, FarmerType, Province, UserRole } from "@/lib/api/types";
import {
  isUnavailableAuthError,
  parseBffError,
  type ParsedBffError,
} from "@/lib/auth/parse-bff-error";

const PROVINCE_LABELS: Record<Province, string> = {
  KIGALI_CITY: "Kigali City",
  NORTHERN: "Northern Province",
  SOUTHERN: "Southern Province",
  EASTERN: "Eastern Province",
  WESTERN: "Western Province",
};

const FARMER_CATEGORY_LABELS: Record<FarmerCategory, string> = {
  SMALLHOLDER: "Smallholder",
  MEDIUM_SCALE: "Medium scale",
  COMMERCIAL: "Commercial",
  COOPERATIVE_MEMBER: "Cooperative member",
  LEAD_FARMER: "Lead farmer",
};

const FARMER_TYPE_LABELS: Record<FarmerType, string> = {
  SMARTPHONE: "Smartphone",
  BASIC_PHONE: "Basic phone",
};

const REQUEST_STATUS_LABELS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

const LANGUAGE_LABELS = {
  rw: "Kinyarwanda",
  en: "English",
} as const;

export function accountRequestDetailQueryKey(requestId: string) {
  return ["account-requests", "detail", requestId] as const;
}

export function accountRequestDetailQueryOptions(requestId: string, enabled: boolean) {
  return queryOptions({
    queryKey: accountRequestDetailQueryKey(requestId),
    queryFn: () => getAccountRequest(requestId),
    enabled: enabled && requestId.length > 0,
    retry: false,
  });
}

export function resolveAccountRequestDetailErrorMessage(parsed: ParsedBffError): string {
  if (parsed.code === "unauthorized" || parsed.status === 401) {
    return "Your session has expired or is unavailable. Sign in again to view this request.";
  }
  if (parsed.code === "forbidden" || parsed.status === 403) {
    return "You do not have permission to view this account request.";
  }
  if (parsed.status === 404) {
    return "This account request was not found. It may have been removed.";
  }
  if (isUnavailableAuthError(parsed) || parsed.status === 503) {
    return "This request cannot be loaded right now. The service is temporarily unavailable.";
  }
  if (parsed.message.trim()) return parsed.message;
  return "This account request could not be loaded.";
}

export function parseAccountRequestDetailError(error: unknown): ParsedBffError {
  return parseBffError(error);
}

export function shortDisplayId(id: string): string {
  if (id.length < 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function formatProvince(province: Province): string {
  return PROVINCE_LABELS[province] ?? province;
}

export function formatPreferredLanguage(code: "rw" | "en"): string {
  return LANGUAGE_LABELS[code] ?? code;
}

export function formatFarmerType(type: FarmerType): string {
  return FARMER_TYPE_LABELS[type] ?? type;
}

export function formatFarmerCategory(category: FarmerCategory): string {
  return FARMER_CATEGORY_LABELS[category] ?? category;
}

export function requestStatusLabel(status: AccountRequestResponse["status"]): string {
  return REQUEST_STATUS_LABELS[status];
}

export function isFarmerRequestRole(role: UserRole): boolean {
  return role === "SMARTPHONE_FARMER" || role === "BASIC_PHONE_FARMER";
}

export function isFacilitatorRequestRole(role: UserRole): boolean {
  return role === "FACILITATOR";
}

export function submissionChannelLabel(submittedBy: AccountRequestResponse["submittedBy"]): string {
  return submittedBy ? "Submitted by staff" : "Self-registration";
}

export function accountRequestDetailLink(requestId: string) {
  return { to: "/admin/users/requests/$requestId" as const, params: { requestId } };
}
