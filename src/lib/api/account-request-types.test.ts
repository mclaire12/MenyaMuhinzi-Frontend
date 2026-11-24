import { describe, expect, it } from "vitest";
import type { AccountRequestResponse } from "./account-request-types";

describe("AccountRequestResponse shape", () => {
  it("keeps request id separate from applicant id", () => {
    const sample: AccountRequestResponse = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "PENDING",
      requestedRole: "FACILITATOR",
      notes: null,
      submittedBy: null,
      decision: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      applicant: {
        id: "22222222-2222-4222-8222-222222222222",
        fullName: "Test",
        phoneNumber: "+250788000001",
        email: "a@example.rw",
        status: "PENDING",
        statusReason: null,
        statusChangedAt: null,
        preferredLanguage: "rw",
        roles: ["FACILITATOR"],
        lastLoginAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        location: null,
        farmerProfile: null,
        facilitatorProfile: {
          id: "fac-1",
          professionalTitle: "Agronomist",
          organization: "RAB",
          contactEmail: null,
          contactPhone: null,
        },
      },
    };
    expect(sample.id).not.toBe(sample.applicant.id);
  });
});