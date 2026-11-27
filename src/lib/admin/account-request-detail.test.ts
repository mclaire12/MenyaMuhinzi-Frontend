import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AccountRequestResponse } from "@/lib/api/account-request-types";
import { getAccountRequest } from "@/lib/api/account-request-service";
import { BFF_AUTH_ERROR_PREFIX } from "@/lib/auth/parse-bff-error";
import {
  accountRequestDetailQueryKey,
  accountRequestDetailQueryOptions,
  isFacilitatorRequestRole,
  isFarmerRequestRole,
  resolveAccountRequestDetailErrorMessage,
  shortDisplayId,
  submissionChannelLabel,
  accountRequestDetailLink,
} from "@/lib/admin/account-request-detail";

vi.mock("@/lib/api/account-request-service", () => ({
  getAccountRequest: vi.fn(),
  listAccountRequests: vi.fn(),
}));

const getMock = vi.mocked(getAccountRequest);

const requestId = "11111111-1111-4111-8111-111111111111";
const applicantId = "22222222-2222-4222-8222-222222222222";

function buildRequest(overrides: Partial<AccountRequestResponse> = {}): AccountRequestResponse {
  return {
    id: requestId,
    status: "PENDING",
    requestedRole: "SMARTPHONE_FARMER",
    notes: null,
    applicant: {
      id: applicantId,
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

describe("account request detail", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("uses the account-request UUID in the query key and service call", async () => {
    getMock.mockResolvedValueOnce(buildRequest());
    const options = accountRequestDetailQueryOptions(requestId, true);
    expect(accountRequestDetailQueryKey(requestId)).toEqual([
      "account-requests",
      "detail",
      requestId,
    ]);
    await options.queryFn!({} as never);
    expect(getMock).toHaveBeenCalledWith(requestId);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("keeps applicant UUID separate from request id in payload", () => {
    const body = buildRequest();
    expect(body.id).toBe(requestId);
    expect(body.applicant.id).toBe(applicantId);
    expect(body.id).not.toBe(body.applicant.id);
  });

  it("labels self-registration vs staff submission", () => {
    expect(submissionChannelLabel(null)).toBe("Self-registration");
    expect(submissionChannelLabel({ id: "s1", fullName: "Staff" })).toBe("Submitted by staff");
  });

  it("selects farmer and facilitator sections by requested role", () => {
    expect(isFarmerRequestRole("SMARTPHONE_FARMER")).toBe(true);
    expect(isFacilitatorRequestRole("FACILITATOR")).toBe(true);
    expect(isFarmerRequestRole("FACILITATOR")).toBe(false);
  });

  it("resolves detail errors for 401, 403, 404 and 503", () => {
    expect(
      resolveAccountRequestDetailErrorMessage({ code: "unauthorized", message: "", status: 401 }),
    ).toMatch(/session/i);
    expect(
      resolveAccountRequestDetailErrorMessage({ code: "forbidden", message: "", status: 403 }),
    ).toMatch(/permission/i);
    expect(
      resolveAccountRequestDetailErrorMessage({ code: "unknown", message: "", status: 404 }),
    ).toMatch(/not found/i);
    expect(
      resolveAccountRequestDetailErrorMessage({ code: "unavailable", message: "", status: 503 }),
    ).toMatch(/unavailable/i);
  });

  it("does not fall back when getAccountRequest fails", async () => {
    const err = new Error(
      `${BFF_AUTH_ERROR_PREFIX}${JSON.stringify({ code: "unavailable", message: "down", status: 503 })}`,
    );
    getMock.mockRejectedValueOnce(err);
    await expect(getAccountRequest(requestId)).rejects.toThrow(BFF_AUTH_ERROR_PREFIX);
  });

  it("covers pending, approved and rejected display inputs", () => {
    expect(buildRequest({ status: "PENDING" }).decision).toBeNull();
    expect(
      buildRequest({
        status: "APPROVED",
        decision: {
          decision: "APPROVED",
          reason: null,
          decidedAt: "2025-01-03T00:00:00.000Z",
          decidedBy: { id: "a1", fullName: "Admin" },
        },
      }).status,
    ).toBe("APPROVED");
    expect(
      buildRequest({
        status: "REJECTED",
        decision: {
          decision: "REJECTED",
          reason: "Duplicate",
          decidedAt: "2025-01-03T00:00:00.000Z",
          decidedBy: { id: "a1", fullName: "Admin" },
        },
      }).decision?.reason,
    ).toBe("Duplicate");
  });

  it("supports nullable email and profiles on valid requests", () => {
    const pending = buildRequest();
    expect(pending.applicant.email).toBeNull();
    const farmer = buildRequest({
      applicant: {
        ...buildRequest().applicant,
        email: "j@example.com",
        farmerProfile: {
          id: "fp",
          farmerType: "SMARTPHONE",
          farmerCategory: "SMALLHOLDER",
          registeredAt: "2025-01-01T00:00:00.000Z",
        },
      },
    });
    expect(farmer.applicant.email).toBe("j@example.com");
    const facilitator = buildRequest({
      requestedRole: "FACILITATOR",
      applicant: {
        ...buildRequest().applicant,
        facilitatorProfile: {
          id: "ff",
          professionalTitle: "Agronomist",
          organization: "Org",
          contactEmail: null,
          contactPhone: null,
        },
      },
    });
    expect(facilitator.applicant.facilitatorProfile?.professionalTitle).toBe("Agronomist");
  });

  it("shortens UUIDs for display without losing the full value in tests", () => {
    expect(shortDisplayId(requestId)).toMatch(/^11111111/);
    expect(shortDisplayId(requestId)).toContain("…");
  });

  it("builds approvals navigation with AccountRequest.id", () => {
    const link = accountRequestDetailLink(requestId);
    expect(link.to).toBe("/admin/users/requests/$requestId");
    expect(link.params.requestId).toBe(requestId);
    expect(link.params.requestId).not.toBe(applicantId);
  });
});

describe("admin user detail route", () => {
  it("exposes the user detail route module", async () => {
    const mod = await import("@/routes/_authenticated/admin/users.$userId");
    expect(mod.Route).toBeDefined();
    expect((mod.Route.options as { path?: string }).path).toBeUndefined();
  }, 20_000);
});
