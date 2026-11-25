import { afterEach, describe, expect, it, vi } from "vitest";
import type { CurrentUserResponse } from "../api/types";
import { facilitatorFromAccount } from "../facilitator/dashboard";
import { createBackendClient } from "./backend-client";

vi.mock("./auth-service", () => ({
  obtainAccessTokenFromSession: vi.fn().mockResolvedValue("access-token"),
}));

vi.mock("./runtime-env", () => ({
  getServerRuntimeEnv: () => ({
    apiBaseUrl: "http://api.test/api/v1",
    bffSharedSecret: "secret-for-tests-32-characters-min",
  }),
}));

import {
  getFacilitatorDashboardFromSession,
  resetFacilitatorDashboardBackendClientFactory,
  setFacilitatorDashboardBackendClientFactory,
} from "./facilitator-dashboard-service";

describe("facilitator dashboard BFF", () => {
  afterEach(() => resetFacilitatorDashboardBackendClientFactory());

  it("reads GET /facilitator/reports/dashboard with the session token and range", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ groups: [], farmersInScope: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    setFacilitatorDashboardBackendClientFactory(() => createBackendClient({ fetchFn }));

    await getFacilitatorDashboardFromSession({ startDate: "2026-11-01T00:00:00.000Z" });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://api.test/api/v1/facilitator/reports/dashboard?startDate=2026-11-01T00%3A00%3A00.000Z",
    );
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token");
  });
});

describe("facilitatorFromAccount", () => {
  it("builds the portal profile from a backend facilitator account", () => {
    const user = {
      id: "f-1",
      fullName: "Niyonsaba Claudine",
      phoneNumber: "+250788111222",
      email: "claudine@rab.gov.rw",
      preferredLanguage: "en",
      location: { province: "SOUTHERN", district: "Huye", sector: null, cell: null, village: null },
      facilitatorProfile: {
        id: "p-1",
        professionalTitle: "Agronomist",
        organization: "Rwanda Agriculture Board",
        contactEmail: null,
        contactPhone: null,
      },
    } as unknown as CurrentUserResponse;

    expect(facilitatorFromAccount(user)).toMatchObject({
      id: "f-1",
      accountId: "f-1",
      name: "Niyonsaba Claudine",
      title: "Agronomist",
      organisation: "Rwanda Agriculture Board",
      district: "Huye",
      language: "en",
    });
  });
});
