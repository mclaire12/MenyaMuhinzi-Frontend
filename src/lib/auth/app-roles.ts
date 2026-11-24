import type { UserRole } from "@/lib/api/types";

/** Portal role slugs used across existing farmer/staff UI. */
export type AppRole = "admin" | "facilitator" | "farmer" | "basic_phone_farmer";

const API_TO_APP: Record<UserRole, AppRole> = {
  ADMIN: "admin",
  FACILITATOR: "facilitator",
  SMARTPHONE_FARMER: "farmer",
  BASIC_PHONE_FARMER: "basic_phone_farmer",
};

export function toAppRoles(apiRoles: UserRole[]): AppRole[] {
  const seen = new Set<AppRole>();
  const roles: AppRole[] = [];
  for (const api of apiRoles) {
    const mapped = API_TO_APP[api];
    if (!seen.has(mapped)) {
      seen.add(mapped);
      roles.push(mapped);
    }
  }
  return roles;
}

export function isStaffRole(roles: AppRole[]): boolean {
  return roles.includes("admin") || roles.includes("facilitator");
}