import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { adminGet, type Paginated } from "@/lib/admin/api";
import type { FacilitatorGroupSummary } from "@/lib/facilitator/backend-courses";
import type { FarmerCategory, Province } from "@/lib/api/types";

/** Facilitator groups and their members, from /facilitator/groups. */

export interface GroupMember {
  userId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  farmerType: "SMARTPHONE" | "BASIC_PHONE";
  status: string;
  addedAt: string;
}

export interface FarmerSearchRow {
  userId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  status: string;
  farmerType: "SMARTPHONE" | "BASIC_PHONE";
  location: { district: string; sector: string | null } | null;
}

export interface RegisteredMember {
  userId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  emailSent: boolean;
}

export interface MemberImportResult {
  total: number;
  created: (RegisteredMember & { row: number })[];
  failed: { row: number; fullName: string | null; errors: string[] }[];
}

/** Body of POST /facilitator/groups/:id/members/register (same as registering a farmer). */
export interface NewMemberBody {
  fullName: string;
  phoneNumber: string;
  email: string;
  farmerType: "SMARTPHONE" | "BASIC_PHONE";
  farmerCategory: FarmerCategory;
  preferredLanguage: "rw" | "en";
  location: { province: Province; district: string; sector: string; cell: string; village: string };
}

export const farmerTypeLabels = { SMARTPHONE: "Smartphone", BASIC_PHONE: "Basic phone" } as const;

export const facilitatorGroupsKey = ["facilitator-groups"] as const;

export function groupListQueryOptions(query: { page: number; search?: string }, enabled: boolean) {
  return queryOptions({
    queryKey: [...facilitatorGroupsKey, "list", query] as const,
    queryFn: () =>
      adminGet<Paginated<FacilitatorGroupSummary>>("facilitator/groups", { ...query, limit: 10 }),
    enabled,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function groupQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...facilitatorGroupsKey, "detail", id] as const,
    queryFn: () => adminGet<FacilitatorGroupSummary>(`facilitator/groups/${id}`),
    enabled,
    retry: false,
  });
}

export function groupMembersQueryOptions(
  id: string,
  query: { page: number; search?: string },
  enabled: boolean,
) {
  return queryOptions({
    queryKey: [...facilitatorGroupsKey, "members", id, query] as const,
    queryFn: () =>
      adminGet<Paginated<GroupMember>>(`facilitator/groups/${id}/members`, { ...query, limit: 20 }),
    enabled,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/** Farmers already on the platform, found by email, phone or name (GET /farmers?search=). */
export function farmerSearchQueryOptions(search: string, enabled: boolean) {
  return queryOptions({
    queryKey: ["farmer-search", search] as const,
    queryFn: () => adminGet<Paginated<FarmerSearchRow>>("farmers", { search, page: 1, limit: 10 }),
    enabled: enabled && search.trim().length >= 3,
    retry: false,
  });
}
