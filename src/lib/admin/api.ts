import type { AdminApiMethod, AdminApiQuery } from "@/lib/api/admin-api-routes";
import { bffAdminApi } from "@/lib/auth/admin-api-server-fns";
import { parseBffError } from "@/lib/auth/parse-bff-error";

/** Calls an allow-listed backend endpoint as the signed-in administrator (through the BFF). */
export async function adminApi<T>(
  method: AdminApiMethod,
  path: string,
  options: { query?: AdminApiQuery; body?: unknown } = {},
): Promise<T> {
  const result = await bffAdminApi({
    data: {
      method,
      path,
      ...(options.query ? { query: options.query } : {}),
      ...(options.body !== undefined ? { body: options.body } : {}),
    },
  });
  return result as T;
}

export const adminGet = <T>(path: string, query?: AdminApiQuery) =>
  adminApi<T>("GET", path, query ? { query } : {});

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** Reads every page of a paginated list (bounded, for small admin catalogues). */
export async function adminGetAll<T>(path: string, query: AdminApiQuery = {}, maxPages = 10) {
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await adminGet<Paginated<T>>(path, { ...query, page, limit: 100 });
    rows.push(...result.data);
    if (page >= result.meta.totalPages) break;
  }
  return rows;
}

/** User-facing message for a failed admin call. */
export function adminErrorMessage(error: unknown, fallback: string): string {
  const parsed = parseBffError(error);
  if (parsed.status === 401) return "Your session has expired. Sign in again.";
  if (parsed.status === 403) return "You do not have permission to do this.";
  return parsed.message && parsed.code !== "unknown" ? parsed.message : fallback;
}
