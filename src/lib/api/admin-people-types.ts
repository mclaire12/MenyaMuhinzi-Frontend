import type { PaginationMeta, UserDetailResponse } from "./account-request-types";
import type { AccountStatus, UserRole } from "./types";

/** GET /users row: the user with location, role profiles and email verification time. */
export interface AdminUserResponse extends UserDetailResponse {
  emailVerifiedAt: string | null;
}

export interface PaginatedAdminUsers {
  data: AdminUserResponse[];
  meta: PaginationMeta;
}

export interface ListAdminUsersQuery {
  search?: string | undefined;
  status?: AccountStatus | undefined;
  role?: UserRole | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

/** PATCH /users/:id/status — PENDING/REJECTED go through account approvals instead. */
export type ManageableAccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface UpdateAdminUserStatusInput {
  status: ManageableAccountStatus;
  reason?: string | undefined;
}

export interface KeyCount {
  key: string;
  count: number;
}

/** GET /admin/reports/dashboard (fields used by the admin dashboard). */
export interface AdminDashboardReport {
  generatedAt: string;
  users: {
    total: number;
    byStatus: KeyCount[];
    smartphoneFarmers: number;
    basicPhoneFarmers: number;
    facilitators: number;
  };
  groups: { activeFacilitatorGroups: number; memberships: number };
  learning: {
    coursesByStatus: KeyCount[];
    lessons: number;
    enrollmentsByStatus: KeyCount[];
    completedLessonProgress: number;
    assessmentAttemptsByStatus: KeyCount[];
  };
}

/** GET /admin/reports/registrations (farmer registrations). */
export interface AdminRegistrationsReport {
  byFarmerType: KeyCount[];
  byFarmerCategory: KeyCount[];
  byProvince: KeyCount[];
  registrationsOverTime: { date: string; count: number }[];
  pendingAccountRequests: number;
  approvalDecisions: KeyCount[];
}

export interface ReportRangeQuery {
  /** ISO timestamp, inclusive. */
  startDate?: string | undefined;
  /** ISO timestamp, exclusive. */
  endDate?: string | undefined;
}
