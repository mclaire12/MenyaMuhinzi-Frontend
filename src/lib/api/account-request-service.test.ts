import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRequestResponse, PaginatedAccountRequests } from "./account-request-types";

const bffMocks = vi.hoisted(() => ({
  bffListAccountRequests: vi.fn(),
  bffGetAccountRequest: vi.fn(),
  bffApproveAccountRequest: vi.fn(),
  bffRejectAccountRequest: vi.fn(),
}));

vi.mock("@/lib/auth/account-request-server-fns", () => bffMocks);

import {
  approveAccountRequest,
  getAccountRequest,
  listAccountRequests,
  rejectAccountRequest,
} from "./account-request-service";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

const item = { id: REQUEST_ID } as AccountRequestResponse;
const page: PaginatedAccountRequests = { data: [item], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } };

describe("account-request-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates list, get, approve and reject to BFF server functions", async () => {
    bffMocks.bffListAccountRequests.mockResolvedValue(page);
    bffMocks.bffGetAccountRequest.mockResolvedValue(item);
    bffMocks.bffApproveAccountRequest.mockResolvedValue(item);
    bffMocks.bffRejectAccountRequest.mockResolvedValue(item);

    await listAccountRequests({ status: "PENDING", search: "Jeanne" });
    await getAccountRequest(REQUEST_ID);
    await approveAccountRequest(REQUEST_ID, { note: "OK" });
    await rejectAccountRequest(REQUEST_ID, { reason: "Duplicate phone" });

    expect(bffMocks.bffListAccountRequests).toHaveBeenCalledWith({ data: { status: "PENDING", search: "Jeanne" } });
    expect(bffMocks.bffGetAccountRequest).toHaveBeenCalledWith({ data: { id: REQUEST_ID } });
    expect(bffMocks.bffApproveAccountRequest).toHaveBeenCalledWith({ data: { id: REQUEST_ID, note: "OK" } });
    expect(bffMocks.bffRejectAccountRequest).toHaveBeenCalledWith({ data: { id: REQUEST_ID, reason: "Duplicate phone" } });
    expect(JSON.stringify(page)).not.toMatch(/accessToken|refreshToken|mm_session/);
  });
});