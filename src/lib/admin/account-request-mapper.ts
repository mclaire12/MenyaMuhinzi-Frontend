import type { AccountRequestResponse, AccountRequestStatus } from "@/lib/api/account-request-types";
import type { FarmerType, Province, UserLocation, UserRole } from "@/lib/api/types";

/** Row model for the Account Approvals table — not a PortalUser. */
export interface AccountRequestApprovalRow {
  requestId: string;
  applicantUserId: string;
  name: string;
  phone: string;
  email: string | null;
  requestedRole: UserRole;
  status: AccountRequestStatus;
  createdAt: string;
  decisionAt: string | null;
  rejectionReason: string | null;
  qualification: string | null;
  locationLabel: string;
  submittedByName: string | null;
  decidedByName: string | null;
  farmerAccessType: FarmerType | null;
}

const PROVINCE_LABELS: Record<Province, string> = {
  KIGALI_CITY: "Kigali City",
  NORTHERN: "Northern Province",
  SOUTHERN: "Southern Province",
  EASTERN: "Eastern Province",
  WESTERN: "Western Province",
};

export function formatAccountRequestLocation(location: UserLocation | null): string {
  if (!location) return "—";
  const province = PROVINCE_LABELS[location.province] ?? location.province;
  const segment = [location.sector, location.district].filter(Boolean).join(", ");
  return segment || [location.district, province].filter(Boolean).join(", ") || "—";
}

export function mapAccountRequestToRow(request: AccountRequestResponse): AccountRequestApprovalRow {
  const { applicant, decision, submittedBy } = request;
  return {
    requestId: request.id,
    applicantUserId: applicant.id,
    name: applicant.fullName,
    phone: applicant.phoneNumber,
    email: applicant.email,
    requestedRole: request.requestedRole,
    status: request.status,
    createdAt: request.createdAt,
    decisionAt: decision?.decidedAt ?? null,
    rejectionReason: request.status === "REJECTED" ? (decision?.reason ?? null) : null,
    qualification:
      request.requestedRole === "FACILITATOR"
        ? (applicant.facilitatorProfile?.professionalTitle ?? null)
        : null,
    locationLabel: formatAccountRequestLocation(applicant.location),
    submittedByName: submittedBy?.fullName ?? null,
    decidedByName: decision?.decidedBy.fullName ?? null,
    farmerAccessType: applicant.farmerProfile?.farmerType ?? null,
  };
}

export type ApprovalsView = "pending" | "approved" | "rejected";

export function approvalsViewToApiStatus(view: ApprovalsView): AccountRequestStatus {
  if (view === "pending") return "PENDING";
  if (view === "approved") return "APPROVED";
  return "REJECTED";
}
