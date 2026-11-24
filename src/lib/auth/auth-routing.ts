import type { UserRole } from "@/lib/api/types";

/** Post-login destination based on backend roles (trusted server response). */
export function homeForApiRoles(roles: UserRole[]): "/phone" | "/admin" | "/facilitator" | "/dashboard" {
  if (roles.includes("BASIC_PHONE_FARMER")) return "/phone";
  if (roles.includes("ADMIN")) return "/admin";
  if (roles.includes("FACILITATOR")) return "/facilitator";
  return "/dashboard";
}