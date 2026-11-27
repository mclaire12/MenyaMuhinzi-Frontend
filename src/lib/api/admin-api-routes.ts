/**
 * Backend endpoints the staff portals (admin and facilitator) may call through the generic BFF
 * function (`bffAdminApi`).
 * Anything not listed here is refused before a request reaches the backend; the backend still
 * enforces roles and permissions on every call with the administrator's own session token.
 */
export type AdminApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const SEGMENT = "[A-Za-z0-9_-]+";
const tail = `(?:/${SEGMENT}){0,4}`;

const ADMIN_API_PREFIXES = [
  "admin/groups",
  "admin/ai",
  "admin/reports",
  "admin/ussd",
  "admin/ivr",
  "admin/notifications",
  "admin/audit-logs",
  "health",
  "crops",
  "courses",
  "course-generations",
  "facilitator/groups",
  "farmers",
  "modules",
  "lessons",
  "knowledge",
  "assessments",
  "settings",
] as const;

const ROUTE = new RegExp(
  `^(?:${ADMIN_API_PREFIXES.map((prefix) => prefix.replace("/", "\\/")).join("|")})${tail}$`,
);

export const ADMIN_API_METHODS: readonly AdminApiMethod[] = [
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
];

/** True when `path` (no leading slash, no query) is an admin-portal endpoint. */
export function isAllowedAdminApiPath(path: string): boolean {
  if (path.length > 200 || path.includes("..") || path.includes("//")) return false;
  return ROUTE.test(path);
}

export type AdminApiQuery = Record<string, string | number | boolean | undefined>;

export function adminApiQueryString(query: AdminApiQuery | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
