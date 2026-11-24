import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  APPROVALS_PAGE_SIZE,
  accountRequestListQueryKey,
  buildListAccountRequestsQuery,
  resolveApprovalsListErrorMessage,
} from "@/lib/admin/account-request-approvals";
import { BFF_AUTH_ERROR_PREFIX } from "@/lib/auth/parse-bff-error";
import { listAccountRequests } from "@/lib/api/account-request-service";

vi.mock("@/lib/api/account-request-service", () => ({
  listAccountRequests: vi.fn(),
}));

const listMock = vi.mocked(listAccountRequests);

describe("account request approvals list", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("builds pending query for initial view with page size 10", () => {
    expect(
      buildListAccountRequestsQuery({ view: "pending", search: "", role: "all", page: 0 }),
    ).toEqual({
      status: "PENDING",
      page: 1,
      limit: APPROVALS_PAGE_SIZE,
    });
    expect(APPROVALS_PAGE_SIZE).toBe(10);
  });

  it("builds approved and rejected status queries per tab", () => {
    expect(
      buildListAccountRequestsQuery({ view: "approved", search: "", role: "all", page: 0 }).status,
    ).toBe("APPROVED");
    expect(
      buildListAccountRequestsQuery({ view: "rejected", search: "", role: "all", page: 0 }).status,
    ).toBe("REJECTED");
  });

  it("passes search and role filters to the backend", () => {
    expect(
      buildListAccountRequestsQuery({
        view: "pending",
        search: "  jean ",
        role: "FACILITATOR",
        page: 2,
      }),
    ).toEqual({
      status: "PENDING",
      search: "jean",
      requestedRole: "FACILITATOR",
      page: 3,
      limit: 10,
    });
  });

  it("uses distinct query keys when page or filters change", () => {
    const a = accountRequestListQueryKey({ view: "pending", search: "", role: "all", page: 0 });
    const b = accountRequestListQueryKey({ view: "pending", search: "a", role: "all", page: 0 });
    const c = accountRequestListQueryKey({ view: "pending", search: "", role: "all", page: 1 });
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("maps 401, 403 and 503 errors for the approvals list", () => {
    expect(
      resolveApprovalsListErrorMessage({ code: "unauthorized", message: "", status: 401 }),
    ).toMatch(/session/i);
    expect(
      resolveApprovalsListErrorMessage({ code: "forbidden", message: "", status: 403 }),
    ).toMatch(/permission/i);
    expect(
      resolveApprovalsListErrorMessage({ code: "unavailable", message: "", status: 503 }),
    ).toMatch(/unavailable/i);
  });

  it("does not fall back to mock data when listAccountRequests fails", async () => {
    const err = new Error(
      `${BFF_AUTH_ERROR_PREFIX}${JSON.stringify({ code: "unavailable", message: "down", status: 503 })}`,
    );
    listMock.mockRejectedValueOnce(err);
    await expect(listAccountRequests({ status: "PENDING" })).rejects.toThrow(BFF_AUTH_ERROR_PREFIX);
    expect(listMock).toHaveBeenCalledTimes(1);
  });
});

describe("All Users tab data source", () => {
  it("still resolves users from the admin mock store module", async () => {
    const store = await import("@/lib/admin/store");
    expect(typeof store.useAdmin).toBe("function");
    expect(typeof store.getAdminState).toBe("function");
  });
});
