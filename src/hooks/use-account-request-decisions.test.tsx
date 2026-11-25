import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAccountRequestDecisions } from "@/hooks/use-account-request-decisions";
import { approveAccountRequest } from "@/lib/api/account-request-service";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.mock("@/lib/api/account-request-service", () => ({
  approveAccountRequest: vi.fn(),
  rejectAccountRequest: vi.fn(),
}));

const requestId = "11111111-1111-4111-8111-111111111111";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useAccountRequestDecisions", () => {
  beforeEach(() => {
    vi.mocked(approveAccountRequest).mockReset();
  });

  it("prevents overlapping approve submissions for the same request", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(approveAccountRequest).mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res;
        }),
    );
    const { result } = renderHook(() => useAccountRequestDecisions(), { wrapper: wrapper() });
    result.current.approve.mutate({ requestId });
    await waitFor(() => expect(result.current.isDeciding).toBe(true));
    expect(result.current.isDecidingRequest(requestId)).toBe(true);
    resolve({ id: requestId, applicant: { fullName: "Jean" }, status: "APPROVED" });
    await waitFor(() => expect(result.current.isDeciding).toBe(false));
    expect(approveAccountRequest).toHaveBeenCalledTimes(1);
    expect(approveAccountRequest).toHaveBeenCalledWith(requestId, {});
  });

  it("does not call mock approveUser", async () => {
    const people = await import("@/lib/admin/people");
    expect(people.approveUser).toBeDefined();
    vi.mocked(approveAccountRequest).mockResolvedValueOnce({
      id: requestId,
      status: "APPROVED",
      applicant: { fullName: "Jean" },
    } as never);
    const approveUserSpy = vi.spyOn(people, "approveUser");
    const { result } = renderHook(() => useAccountRequestDecisions(), { wrapper: wrapper() });
    result.current.approve.mutate({ requestId });
    await waitFor(() => expect(result.current.approve.isSuccess).toBe(true));
    expect(approveUserSpy).not.toHaveBeenCalled();
    approveUserSpy.mockRestore();
  });
});
