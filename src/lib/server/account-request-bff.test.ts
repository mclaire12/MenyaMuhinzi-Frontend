import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBackendClient } from "./backend-client";
import { BffAuthError } from "./bff-error";
import {
  approveAccountRequestFromSession,
  getAccountRequestFromSession,
  listAccountRequestsFromSession,
  rejectAccountRequestFromSession,
  resetAccountRequestBackendClientFactory,
  setAccountRequestBackendClientFactory,
} from "./account-request-service";
import {
  obtainAccessTokenFromSession,
  resetBackendClientFactory,
  resetRefreshInFlightForTests,
  setBackendClientFactory,
} from "./auth-service";
import { resetServerRuntimeEnvCache } from "./runtime-env";
import { ACCESS_EXPIRES_HEADER, ACCESS_TOKEN_HEADER, BFF_SECRET_HEADER, WEB_SESSION_HEADER } from "./bff-headers";
import type { AccountRequestResponse, PaginatedAccountRequests } from "../api/account-request-types";

const ENV = {
  API_BASE_URL: "http://localhost:4000/api/v1",
  MENYA_BFF_SHARED_SECRET: "test-bff-shared-secret-0123456789abcdefghi",
  SITE_ORIGIN: "http://localhost:3000",
  WEB_SESSION_COOKIE_NAME: "mm_session",
};

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const APPLICANT_ID = "22222222-2222-4222-8222-222222222222";

let cookieValue: string | undefined;

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => (name === "mm_session" ? cookieValue : undefined),
  setCookie: (_name: string, value: string) => {
    cookieValue = value;
  },
  deleteCookie: () => {
    cookieValue = undefined;
  },
  getRequestProtocol: () => "http",
  getRequestHeader: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const sampleRequest = (): AccountRequestResponse => ({
  id: REQUEST_ID,
  status: "PENDING",
  requestedRole: "SMARTPHONE_FARMER",
  notes: null,
  submittedBy: null,
  decision: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  applicant: {
    id: APPLICANT_ID,
    fullName: "Uwimana Jeanne",
    phoneNumber: "+250788123456",
    email: "jeanne@example.rw",
    status: "PENDING",
    statusReason: null,
    statusChangedAt: null,
    preferredLanguage: "rw",
    roles: ["SMARTPHONE_FARMER"],
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    location: { province: "NORTHERN", district: "Musanze", sector: "Muhoza", cell: null, village: null },
    farmerProfile: {
      id: "farmer-1",
      farmerType: "SMARTPHONE",
      farmerCategory: "SMALLHOLDER",
      registeredAt: "2026-01-01T00:00:00.000Z",
    },
    facilitatorProfile: null,
  },
});

function refreshResponse(overrides: Partial<{ sessionId: string; token: string }> = {}): Response {
  return jsonResponse({}, 200, {
    [WEB_SESSION_HEADER]: overrides.sessionId ?? "rotated-session",
    [ACCESS_TOKEN_HEADER]: overrides.token ?? "server-only-access-token",
    [ACCESS_EXPIRES_HEADER]: "900",
  });
}

function setupClient(fetchImpl: typeof fetch): void {
  const factory = () => createBackendClient({ fetchFn: fetchImpl });
  setBackendClientFactory(factory);
  setAccountRequestBackendClientFactory(factory);
}

describe("account request BFF service", () => {
  beforeEach(() => {
    cookieValue = "opaque-session";
    resetServerRuntimeEnvCache();
    resetBackendClientFactory();
    resetAccountRequestBackendClientFactory();
    resetRefreshInFlightForTests();
    Object.assign(process.env, ENV);
  });

  it("refreshes the session and lists requests with Bearer auth", async () => {
    const listBody: PaginatedAccountRequests = { data: [sampleRequest()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Headers;
      if (String(url).includes("/auth/web-sessions/refresh")) return refreshResponse();
      if (String(url).includes("/accounts/requests?")) {
        expect(headers.get("Authorization")).toBe("Bearer server-only-access-token");
        expect(headers.get(BFF_SECRET_HEADER)).toBe(ENV.MENYA_BFF_SHARED_SECRET);
        return jsonResponse(listBody);
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    setupClient(fetchMock as typeof fetch);

    const result = await listAccountRequestsFromSession({ status: "PENDING", page: 1, limit: 20 });
    expect(result.data[0]?.id).toBe(REQUEST_ID);
    expect(result.data[0]?.applicant.id).toBe(APPLICANT_ID);
    expect(cookieValue).toBe("rotated-session");
    expect(JSON.stringify(result)).not.toMatch(/accessToken|refreshToken|opaque-session|server-only-access-token/);
  });

  it("fails when no session cookie is present", async () => {
    cookieValue = undefined;
    setupClient(vi.fn() as typeof fetch);
    await expect(listAccountRequestsFromSession({})).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  });

  it("retrieves one request by request UUID", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/web-sessions/refresh")) return refreshResponse();
      if (String(url).endsWith(`/accounts/requests/${REQUEST_ID}`)) return jsonResponse(sampleRequest());
      throw new Error(`Unexpected fetch ${url}`);
    });
    setupClient(fetchMock as typeof fetch);
    const item = await getAccountRequestFromSession(REQUEST_ID);
    expect(item.id).toBe(REQUEST_ID);
  });

  it("approves with an optional note", async () => {
    const approved = { ...sampleRequest(), status: "APPROVED" as const };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/web-sessions/refresh")) return refreshResponse();
      if (String(url).includes("/approve")) {
        expect(JSON.parse(String(init?.body))).toEqual({ note: "Identity confirmed" });
        return jsonResponse(approved);
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    setupClient(fetchMock as typeof fetch);
    const result = await approveAccountRequestFromSession(REQUEST_ID, { note: "Identity confirmed" });
    expect(result.status).toBe("APPROVED");
  });

  it("rejects with a required reason", async () => {
    const rejected = { ...sampleRequest(), status: "REJECTED" as const };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/web-sessions/refresh")) return refreshResponse();
      if (String(url).includes("/reject")) {
        expect(JSON.parse(String(init?.body))).toEqual({ reason: "Duplicate phone number" });
        return jsonResponse(rejected);
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    setupClient(fetchMock as typeof fetch);
    const result = await rejectAccountRequestFromSession(REQUEST_ID, { reason: "Duplicate phone number" });
    expect(result.status).toBe("REJECTED");
  });

  it("maps forbidden, not found and conflict responses", async () => {
    const cases = [
      { status: 403, code: "forbidden" },
      { status: 404, code: "unknown", statusCode: 404 },
      { status: 409, code: "unknown", statusCode: 409 },
    ] as const;
    for (const testCase of cases) {
      setupClient(
        vi.fn(async (url: string) => {
          if (String(url).includes("/auth/web-sessions/refresh")) return refreshResponse();
          return jsonResponse(
            { statusCode: testCase.status, error: "Error", message: "fail", path: "/", method: "GET", timestamp: "t" },
            testCase.status,
          );
        }) as typeof fetch,
      );
      await expect(getAccountRequestFromSession(REQUEST_ID)).rejects.toMatchObject({
        code: testCase.code,
        status: testCase.statusCode ?? testCase.status,
      });
    }
  });

  it("surfaces backend outage without clearing the session cookie", async () => {
    setupClient(
      vi.fn(async (url: string) => {
        if (String(url).includes("/auth/web-sessions/refresh")) return jsonResponse({}, 503);
        return jsonResponse({}, 503);
      }) as typeof fetch,
    );
    await expect(obtainAccessTokenFromSession()).rejects.toMatchObject({ code: "unavailable" });
    expect(cookieValue).toBe("opaque-session");
  });
});