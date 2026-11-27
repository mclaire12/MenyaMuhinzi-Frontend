import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { adminGet, adminGetAll, type Paginated } from "@/lib/admin/api";
import type { AdminCourse, CourseStatusCode } from "@/lib/admin/backend-courses";

/** Facilitator view of courses and their own farmer groups, read from the backend. */

export interface FacilitatorGroupSummary {
  id: string;
  name: string;
  description: string | null;
  crop: { id: string; code: string; nameEn: string; nameRw: string };
  location: {
    province: string;
    district: string;
    sector: string | null;
    cell: string | null;
    village: string | null;
  };
  status: "ACTIVE" | "INACTIVE";
  memberCount: number;
  createdAt: string;
}

export const facilitatorCoursesKey = ["facilitator-courses"] as const;

/** The facilitator's own active groups (GET /facilitator/groups). */
export function facilitatorGroupsQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: [...facilitatorCoursesKey, "groups"] as const,
    queryFn: async () =>
      (await adminGetAll<FacilitatorGroupSummary>("facilitator/groups")).filter(
        (group) => group.status === "ACTIVE",
      ),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export type FacilitatorCourseQuery = {
  ownership: "GROUP" | "PLATFORM";
  page: number;
  search?: string;
  status?: CourseStatusCode;
  cropId?: string;
};

/**
 * GROUP: the courses this facilitator generated (any status), published to their groups.
 * PLATFORM: published platform courses they can teach.
 */
export function facilitatorCourseListQueryOptions(query: FacilitatorCourseQuery, enabled: boolean) {
  return queryOptions({
    queryKey: [...facilitatorCoursesKey, "list", query] as const,
    queryFn: () => adminGet<Paginated<AdminCourse>>("courses", { ...query, limit: 10 }),
    enabled,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/** Group course status as the facilitator sees it. */
export const groupCourseStatusLabels: Record<CourseStatusCode, string> = {
  DRAFT: "Not shared yet",
  UNDER_REVIEW: "Not shared yet",
  PUBLISHED: "Shared with group",
  ARCHIVED: "Archived",
};
