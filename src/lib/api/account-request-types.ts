import type {
  AccountStatus,
  FarmerCategory,
  FarmerProfile,
  FacilitatorProfile,
  Language,
  UserLocation,
  UserResponse,
  UserRole,
} from "./types";

export type AccountRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ApprovalDecision = "APPROVED" | "REJECTED";

export interface UserReference {
  id: string;
  fullName: string;
}

export interface UserDetailResponse extends UserResponse {
  location: UserLocation | null;
  farmerProfile: FarmerProfile | null;
  facilitatorProfile: FacilitatorProfile | null;
}

export interface AccountDecision {
  decision: ApprovalDecision;
  reason: string | null;
  decidedAt: string;
  decidedBy: UserReference;
}

export interface AccountRequestResponse {
  id: string;
  status: AccountRequestStatus;
  requestedRole: UserRole;
  notes: string | null;
  applicant: UserDetailResponse;
  submittedBy: UserReference | null;
  decision: AccountDecision | null;
  createdAt: string;
  updatedAt: string;
  /** Only on approve/reject: whether the SMTP server accepted the verification or rejection email. */
  emailSent?: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedAccountRequests {
  data: AccountRequestResponse[];
  meta: PaginationMeta;
}

export interface ListAccountRequestsQuery {
  status?: AccountRequestStatus | undefined;
  requestedRole?: UserRole | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface ApproveAccountRequestInput {
  note?: string;
}

export interface RejectAccountRequestInput {
  reason: string;
}

/** Fields carried on applicant profiles (DTO mirror for tests). */
export type { AccountStatus, FarmerCategory, Language };