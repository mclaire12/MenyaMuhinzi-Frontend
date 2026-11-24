import { describe, expect, it } from "vitest";
import type { AccountRequestResponse } from "@/lib/api/account-request-types";
import {
  approvalsViewToApiStatus,
  formatAccountRequestLocation,
  mapAccountRequestToRow,
} from "@/lib/admin/account-request-mapper";

function sampleRequest(overrides: Partial<AccountRequestResponse> = {}): AccountRequestResponse {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    status: "PENDING",
    requestedRole: "SMARTPHONE_FARMER",
    notes: null,
    applicant: {
      id: "22222222-2222-4222-8222-222222222222",
      fullName: "Jean Farmer",
      phoneNumber: "0788000001",
      email: null,
      status: "PENDING",
      statusReason: null,
      statusChangedAt: null,
      preferredLanguage: "rw",
      roles: ["SMARTPHONE_FARMER"],
      lastLoginAt: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      location: null,
      farmerProfile: null,
      facilitatorProfile: null,
    },
    submittedBy: null,
    decision: null,
    createdAt: "2025-01-02T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("account request mapper", () => {
  it("maps request id separately from applicant id", () => {
    const row = mapAccountRequestToRow(sampleRequest());
    expect(row.requestId).toBe("11111111-1111-4111-8111-111111111111");
    expect(row.applicantUserId).toBe("22222222-2222-4222-8222-222222222222");
    expect(row.requestId).not.toBe(row.applicantUserId);
  });

  it("handles nullable email and location", () => {
    const row = mapAccountRequestToRow(sampleRequest());
    expect(row.email).toBeNull();
    expect(row.locationLabel).toBe("—");
  });

  it("maps facilitator qualification and farmer type when present", () => {
    const row = mapAccountRequestToRow(
      sampleRequest({
        requestedRole: "FACILITATOR",
        applicant: {
          ...sampleRequest().applicant,
          facilitatorProfile: {
            id: "f1",
            professionalTitle: "Agronomist",
            organization: "Org",
            contactEmail: null,
            contactPhone: null,
          },
        },
      }),
    );
    expect(row.qualification).toBe("Agronomist");

    const farmerRow = mapAccountRequestToRow(
      sampleRequest({
        applicant: {
          ...sampleRequest().applicant,
          farmerProfile: {
            id: "fp1",
            farmerType: "BASIC_PHONE",
            farmerCategory: "SMALLHOLDER",
            registeredAt: "2025-01-01T00:00:00.000Z",
          },
        },
      }),
    );
    expect(farmerRow.farmerAccessType).toBe("BASIC_PHONE");
  });

  it("maps rejection reason only for rejected requests", () => {
    const approved = mapAccountRequestToRow(
      sampleRequest({
        status: "APPROVED",
        decision: {
          decision: "APPROVED",
          reason: null,
          decidedAt: "2025-01-03T00:00:00.000Z",
          decidedBy: { id: "a1", fullName: "Admin" },
        },
      }),
    );
    expect(approved.rejectionReason).toBeNull();

    const rejected = mapAccountRequestToRow(
      sampleRequest({
        status: "REJECTED",
        decision: {
          decision: "REJECTED",
          reason: "Duplicate phone",
          decidedAt: "2025-01-03T00:00:00.000Z",
          decidedBy: { id: "a1", fullName: "Admin" },
        },
      }),
    );
    expect(rejected.rejectionReason).toBe("Duplicate phone");
    expect(rejected.decidedByName).toBe("Admin");
  });

  it("formats location from backend fields", () => {
    expect(
      formatAccountRequestLocation({
        province: "NORTHERN",
        district: "Musanze",
        sector: "Muhoza",
        cell: null,
        village: null,
      }),
    ).toBe("Muhoza, Musanze");
  });

  it("maps approval views to API status", () => {
    expect(approvalsViewToApiStatus("pending")).toBe("PENDING");
    expect(approvalsViewToApiStatus("approved")).toBe("APPROVED");
    expect(approvalsViewToApiStatus("rejected")).toBe("REJECTED");
  });
});
