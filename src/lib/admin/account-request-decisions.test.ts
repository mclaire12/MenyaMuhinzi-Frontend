import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  REJECT_REASON_MAX,
  REJECT_REASON_MIN,
  accountRequestQueriesPredicate,
  invalidateAccountRequestQueries,
  resolveAccountRequestDecisionError,
  validateRejectReason,
} from "@/lib/admin/account-request-decisions";
import { accountRequestDetailQueryKey } from "@/lib/admin/account-request-detail";
import { approveAccountRequest, rejectAccountRequest } from "@/lib/api/account-request-service";

vi.mock("@/lib/api/account-request-service", () => ({
  approveAccountRequest: vi.fn(),
  rejectAccountRequest: vi.fn(),
  getAccountRequest: vi.fn(),
  listAccountRequests: vi.fn(),
}));

describe("account request decisions", () => {
  it("validates rejection reason length and whitespace", () => {
    expect(validateRejectReason("")).toMatch(/enter a reason/i);
    expect(validateRejectReason("   ")).toMatch(/enter a reason/i);
    expect(validateRejectReason("abc")).toMatch(String(REJECT_REASON_MIN));
    expect(validateRejectReason("a".repeat(REJECT_REASON_MAX + 1))).toMatch(String(REJECT_REASON_MAX));
    expect(validateRejectReason("  valid reason  ")).toBeNull();
  });

  it("resolves 401, 403, 404, 409 and 503 decision errors", () => {
    expect(resolveAccountRequestDecisionError({ code: "unauthorized", message: "", status: 401 })).toMatch(
      /session/i,
    );
    expect(resolveAccountRequestDecisionError({ code: "forbidden", message: "", status: 403 })).toMatch(
      /permission/i,
    );
    expect(resolveAccountRequestDecisionError({ code: "unknown", message: "", status: 404 })).toMatch(/not found/i);
    expect(resolveAccountRequestDecisionError({ code: "unknown", message: "", status: 409 })).toMatch(/already/i);
    expect(resolveAccountRequestDecisionError({ code: "unavailable", message: "", status: 503 })).toMatch(
      /try again/i,
    );
  });

  it("invalidates account request list, count and detail queries", () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const requestId = "11111111-1111-4111-8111-111111111111";
    invalidateAccountRequestQueries(qc, requestId);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountRequestDetailQueryKey(requestId),
    });
    expect(invalidate).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    });
    const predicate = invalidate.mock.calls.find((call) => "predicate" in call[0])?.[0].predicate;
    expect(accountRequestQueriesPredicate(["account-requests", "list"])).toBe(true);
    expect(accountRequestQueriesPredicate(["courses"])).toBe(false);
    expect(predicate?.({ queryKey: ["account-requests", "count", "PENDING"] } as never)).toBe(true);
    expect(predicate?.({ queryKey: ["mm-admin"] } as never)).toBe(false);
  });

  it("calls approve with request id and optional note via the service layer", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    vi.mocked(approveAccountRequest).mockResolvedValueOnce({
      id,
      status: "APPROVED",
    } as never);
    await approveAccountRequest(id, { note: "Welcome" });
    expect(approveAccountRequest).toHaveBeenCalledWith(id, { note: "Welcome" });
    vi.mocked(approveAccountRequest).mockResolvedValueOnce({ id, status: "APPROVED" } as never);
    await approveAccountRequest(id, {});
    expect(approveAccountRequest).toHaveBeenLastCalledWith(id, {});
  });

  it("rejects with trimmed reason through the service layer", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    vi.mocked(rejectAccountRequest).mockResolvedValueOnce({ id, status: "REJECTED" } as never);
    await rejectAccountRequest(id, { reason: "Duplicate number on file" });
    expect(rejectAccountRequest).toHaveBeenCalledWith(id, { reason: "Duplicate number on file" });
  });
});