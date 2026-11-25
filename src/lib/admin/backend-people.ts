import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type {
  AdminUserResponse,
  KeyCount,
  ListAdminUsersQuery,
  ManageableAccountStatus,
} from "@/lib/api/admin-people-types";
import type { AccountStatus, Province, UserRole } from "@/lib/api/types";
import { bffGetAdminDashboard, bffGetUser, bffListUsers } from "@/lib/auth/admin-people-server-fns";

/** Real accounts from the backend (GET /users). Shared by the admin people screens. */

export const backendRoleLabels: Record<UserRole, string> = {
  ADMIN: "Administrator",
  FACILITATOR: "Facilitator",
  SMARTPHONE_FARMER: "Smartphone farmer",
  BASIC_PHONE_FARMER: "Basic-phone farmer",
};

export const backendStatusLabels: Record<AccountStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending approval",
  SUSPENDED: "Suspended",
  INACTIVE: "Inactive",
  REJECTED: "Rejected",
};

export const provinceLabels: Record<Province, string> = {
  KIGALI_CITY: "Kigali City",
  NORTHERN: "Northern",
  SOUTHERN: "Southern",
  EASTERN: "Eastern",
  WESTERN: "Western",
};

export function backendStatusTone(status: AccountStatus): "ok" | "warn" | "bad" | "muted" {
  if (status === "ACTIVE") return "ok";
  if (status === "PENDING") return "warn";
  if (status === "REJECTED" || status === "SUSPENDED") return "bad";
  return "muted";
}

/** The account's main role; farmers and staff never hold incompatible roles together. */
export function primaryRole(user: Pick<AdminUserResponse, "roles">): UserRole | null {
  const order: UserRole[] = ["ADMIN", "FACILITATOR", "SMARTPHONE_FARMER", "BASIC_PHONE_FARMER"];
  return order.find((role) => user.roles.includes(role)) ?? null;
}

export function rolesLabel(user: Pick<AdminUserResponse, "roles">): string {
  return user.roles.map((role) => backendRoleLabels[role] ?? role).join(", ") || "—";
}

export function locationLabel(user: Pick<AdminUserResponse, "location">, full = false): string {
  const location = user.location;
  if (!location) return "—";
  const parts = full
    ? [
        location.village,
        location.cell,
        location.sector,
        location.district,
        provinceLabels[location.province] ?? location.province,
      ]
    : [location.district, provinceLabels[location.province] ?? location.province];
  return parts.filter(Boolean).join(", ") || "—";
}

/** Status transitions an administrator can apply; pending/rejected go through approvals. */
export function manageableActions(status: AccountStatus): ManageableAccountStatus[] {
  if (status === "ACTIVE") return ["SUSPENDED", "INACTIVE"];
  if (status === "SUSPENDED") return ["ACTIVE", "INACTIVE"];
  if (status === "INACTIVE") return ["ACTIVE"];
  return [];
}

export const statusActionCopy: Record<
  ManageableAccountStatus,
  { label: string; title: string; text: string; done: string }
> = {
  ACTIVE: {
    label: "Activate",
    title: "Activate this account?",
    text: "The user can sign in, or dial in by USSD and IVR, again.",
    done: "is now active",
  },
  SUSPENDED: {
    label: "Suspend",
    title: "Suspend this account?",
    text: "The user is blocked and signed out until an administrator activates the account again. Learning records are kept.",
    done: "is now suspended",
  },
  INACTIVE: {
    label: "Deactivate",
    title: "Deactivate this account?",
    text: "The account becomes inactive and is signed out. Learning records are kept.",
    done: "is now inactive",
  },
};

export function countFor(rows: KeyCount[] | undefined, key: string): number {
  return rows?.find((row) => row.key === key)?.count ?? 0;
}

export function sumCounts(rows: KeyCount[] | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + row.count, 0);
}

export const adminUsersKey = ["admin-users"] as const;

export function adminUserListQueryOptions(query: ListAdminUsersQuery, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminUsersKey, "list", query] as const,
    queryFn: () => bffListUsers({ data: query }),
    enabled,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function adminUserDetailQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminUsersKey, "detail", id] as const,
    queryFn: () => bffGetUser({ data: { id } }),
    enabled,
    retry: false,
  });
}

/** Dashboard totals (all time) plus farmer registrations in the last `days` days. */
export function adminDashboardQueryOptions(days: number, enabled: boolean) {
  return queryOptions({
    queryKey: ["admin-dashboard", days] as const,
    queryFn: () => {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - (days - 1));
      return bffGetAdminDashboard({ data: { startDate: start.toISOString() } });
    },
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

/** Fills missing days with zero so the chart shows the whole range. */
export function dailySeries(
  points: { date: string; count: number }[],
  days: number,
): { day: string; count: number }[] {
  const byDay = new Map(points.map((point) => [point.date.slice(0, 10), point.count]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (days - 1 - index));
    const key = date.toISOString().slice(0, 10);
    return { day: key.slice(5), count: byDay.get(key) ?? 0 };
  });
}
