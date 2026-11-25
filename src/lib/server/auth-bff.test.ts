import { beforeEach, describe, expect, it, vi } from "vitest";
import { isCsrfRequestAllowed } from "@tanstack/react-start";
import { createBackendClient } from "./backend-client";
import { BffAuthError } from "./bff-error";
import {
  changePasswordWithSession,
  getCurrentUserFromSession,
  loginWithPassword,
  logoutSession,
  refreshSessionCredentials,
  resetBackendClientFactory,
  resetRefreshInFlightForTests,
  restoreSessionFromCookie,
  setBackendClientFactory,
} from "./auth-service";
import { resetServerRuntimeEnvCache } from "./runtime-env";
import {
  ACCESS_EXPIRES_HEADER,
  ACCESS_TOKEN_HEADER,
  BFF_SECRET_HEADER,
  WEB_SESSION_HEADER,
} from "./bff-headers";

const ENV = {
  API_BASE_URL: "http://localhost:4000/api/v1",
  MENYA_BFF_SHARED_SECRET: "test-bff-shared-secret-0123456789abcdefghi",
  SITE_ORIGIN: "http://localhost:3000",
  WEB_SESSION_COOKIE_NAME: "mm_session",
};

const user = {
  id: "user-1",
  fullName: "Test Farmer",
  phoneNumber: "+250788000001",
  email: "test@example.rw",
  status: "ACTIVE" as const,
  statusReason: null,
  statusChangedAt: null,
  preferredLanguage: "rw" as const,
  roles: ["SMARTPHONE_FARMER" as const],
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

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

function setupClient(fetchImpl: typeof fetch): void {
  setBackendClientFactory(() => createBackendClient({ fetchFn: fetchImpl }));
}

describe("authentication BFF service", () => {
  beforeEach(() => {
    cookieValue = undefined;
    resetServerRuntimeEnvCache();
    resetBackendClientFactory();
    resetRefreshInFlightForTests();
    Object.assign(process.env, ENV);
  });

  it("logs in, sets the cookie and returns only safe fields", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { user, idleExpiresAt: "2026-11-25T00:00:00.000Z", absoluteExpiresAt: "2026-12-01T00:00:00.000Z" },
        201,
        { [WEB_SESSION_HEADER]: "opaque-session" },
      ),
    );
    setupClient(fetchMock as typeof fetch);
    const result = await loginWithPassword("test@example.rw", "Password2026!");
    expect(cookieValue).toBe("opaque-session");
    expect(result.user.id).toBe(user.id);
    expect(JSON.stringify(result)).not.toMatch(/opaque-session|accessToken|refreshToken/);
    const sent = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((sent[1]?.headers as Headers).get(BFF_SECRET_HEADER)).toBe(ENV.MENYA_BFF_SHARED_SECRET);
  });

  it("surfaces login failures without credentials", async () => {
    setupClient(vi.fn(async () => jsonResponse({ statusCode: 401, error: "Unauthorized", message: "Bad", path: "/", method: "POST", timestamp: "t" }, 401)));
    await expect(loginWithPassword("x@y.rw", "bad")).rejects.toMatchObject({ code: "unauthorized" });
    expect(cookieValue).toBeUndefined();
  });

  it("returns null when no cookie is present", async () => {
    const { getCurrentUserFromSession } = await import("./auth-service");
    await expect(getCurrentUserFromSession()).resolves.toBeNull();
  });

  it("returns the current user when the backend accepts the session", async () => {
    cookieValue = "opaque-session";
    setupClient(
      vi.fn(async () => jsonResponse({ ...user, permissions: [], location: null, farmerProfile: null, facilitatorProfile: null })),
    );
    const current = await getCurrentUserFromSession();
    expect(current?.id).toBe(user.id);
    expect(JSON.stringify(current)).not.toMatch(/opaque-session|eyJ/);
  });

  it("clears the cookie on forbidden account status", async () => {
    cookieValue = "suspended";
    setupClient(vi.fn(async () => jsonResponse({ statusCode: 403, error: "Forbidden", message: "inactive", path: "/", method: "GET", timestamp: "t" }, 403)));
    await expect(getCurrentUserFromSession()).resolves.toBeNull();
    expect(cookieValue).toBeUndefined();
  });

  it("preserves the cookie on backend 503 and network errors", async () => {
    cookieValue = "still-valid";
    setupClient(vi.fn(async () => jsonResponse({ statusCode: 503, error: "Unavailable", message: "redis", path: "/", method: "GET", timestamp: "t" }, 503)));
    await expect(getCurrentUserFromSession()).rejects.toMatchObject({ code: "unavailable" });
    expect(cookieValue).toBe("still-valid");

    setupClient(vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(getCurrentUserFromSession()).rejects.toMatchObject({ code: "network" });
    expect(cookieValue).toBe("still-valid");
  });

  it("preserves the cookie when refresh fails with 503", async () => {
    cookieValue = "session";
    setupClient(vi.fn(async () => jsonResponse({ statusCode: 503, error: "Unavailable", message: "redis", path: "/", method: "POST", timestamp: "t" }, 503)));
    await expect(refreshSessionCredentials()).rejects.toMatchObject({ code: "unavailable" });
    expect(cookieValue).toBe("session");
  });

  it("deduplicates concurrent refresh calls for the same cookie", async () => {
    cookieValue = "same-session";
    let calls = 0;
    setupClient(
      vi.fn(async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 25));
        return new Response(null, {
          status: 200,
          headers: {
            [WEB_SESSION_HEADER]: "rotated-session",
            [ACCESS_TOKEN_HEADER]: "jwt",
            [ACCESS_EXPIRES_HEADER]: "600",
          },
        });
      }),
    );
    const [a, b] = await Promise.all([refreshSessionCredentials(), refreshSessionCredentials()]);
    expect(calls).toBe(1);
    expect(a.expiresIn).toBe(600);
    expect(b.expiresIn).toBe(600);
    expect(cookieValue).toBe("rotated-session");
  });

  it("keeps the cookie when change-password fails validation", async () => {
    cookieValue = "session-1";
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/web-sessions/refresh")) {
        return new Response(null, {
          status: 200,
          headers: {
            [WEB_SESSION_HEADER]: "session-2",
            [ACCESS_TOKEN_HEADER]: "internal-access",
            [ACCESS_EXPIRES_HEADER]: "900",
          },
        });
      }
      if (url.endsWith("/auth/change-password")) {
        return jsonResponse(
          { statusCode: 400, error: "Bad Request", message: "Current password is incorrect", path: "/", method: "POST", timestamp: "t" },
          400,
        );
      }
      throw new Error(`Unexpected ${url}`);
    });
    setupClient(fetchMock as typeof fetch);
    await expect(
      changePasswordWithSession({ currentPassword: "wrong", newPassword: "NewPassword2026!" }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(cookieValue).toBe("session-2");
  });

  it("clears the cookie on expired or revoked sessions", async () => {
    cookieValue = "stale";
    setupClient(vi.fn(async () => jsonResponse({ statusCode: 401, error: "Unauthorized", message: "Session expired", path: "/", method: "GET", timestamp: "t" }, 401)));
    const { getCurrentUserFromSession } = await import("./auth-service");
    await expect(getCurrentUserFromSession()).resolves.toBeNull();
    expect(cookieValue).toBeUndefined();
  });

  it("restores the session from the cookie", async () => {
    cookieValue = "opaque-session";
    setupClient(
      vi.fn(async () => jsonResponse({ ...user, permissions: [], location: null, farmerProfile: null, facilitatorProfile: null })),
    );
    await expect(restoreSessionFromCookie()).resolves.toMatchObject({ id: user.id });
  });

  it("refreshes credentials and rotates the cookie without exposing access tokens", async () => {
    cookieValue = "old-session";
    setupClient(
      vi.fn(async () =>
        new Response(null, {
          status: 200,
          headers: {
            [WEB_SESSION_HEADER]: "new-session",
            [ACCESS_TOKEN_HEADER]: "jwt-access-token",
            [ACCESS_EXPIRES_HEADER]: "900",
          },
        }),
      ),
    );
    const meta = await refreshSessionCredentials();
    expect(cookieValue).toBe("new-session");
    expect(meta.expiresIn).toBe(900);
    expect(JSON.stringify(meta)).not.toContain("jwt-access-token");
  });

  it("logs out and always clears the cookie", async () => {
    cookieValue = "session";
    setupClient(vi.fn(async () => new Response(null, { status: 204 })));
    await expect(logoutSession()).resolves.toEqual({ ok: true });
    expect(cookieValue).toBeUndefined();
  });

  it("still clears the cookie when logout is repeated", async () => {
    cookieValue = "session";
    setupClient(vi.fn(async () => jsonResponse({ statusCode: 401, error: "Unauthorized", message: "gone", path: "/", method: "DELETE", timestamp: "t" }, 401)));
    await expect(logoutSession()).resolves.toEqual({ ok: true });
    expect(cookieValue).toBeUndefined();
  });

  it("changes password using a server-side access token then clears the cookie", async () => {
    cookieValue = "session-1";
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/web-sessions/refresh")) {
        return new Response(null, {
          status: 200,
          headers: {
            [WEB_SESSION_HEADER]: "session-2",
            [ACCESS_TOKEN_HEADER]: "internal-access",
            [ACCESS_EXPIRES_HEADER]: "900",
          },
        });
      }
      if (url.endsWith("/auth/change-password")) {
        expect((init?.headers as Headers).get("authorization")).toBe("Bearer internal-access");
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/auth/web-sessions/current")) return new Response(null, { status: 204 });
      throw new Error(`Unexpected ${url}`);
    });
    setupClient(fetchMock as typeof fetch);
    await expect(
      changePasswordWithSession({ currentPassword: "OldPassword2026!", newPassword: "NewPassword2026!" }),
    ).resolves.toEqual({ ok: true });
    expect(cookieValue).toBeUndefined();
  });

  it("maps rate limits, lockouts and Redis outages", async () => {
    setupClient(
      vi.fn(async () => jsonResponse({ statusCode: 429, error: "Too Many Requests", message: "slow down", path: "/", method: "POST", timestamp: "t" }, 429)),
    );
    await expect(loginWithPassword("a@b.rw", "x")).rejects.toMatchObject<BffAuthError>({ code: "rate_limit", status: 429 });

    setupClient(
      vi.fn(async () => jsonResponse({ statusCode: 503, error: "Service Unavailable", message: "redis", path: "/", method: "POST", timestamp: "t" }, 503)),
    );
    await expect(loginWithPassword("a@b.rw", "x")).rejects.toMatchObject({ code: "unavailable", status: 503 });
  });
});

describe("origin and CSRF guards", () => {
  let isAllowedSiteOrigin: (origin: string | undefined) => boolean;

  beforeEach(async () => {
    resetServerRuntimeEnvCache();
    Object.assign(process.env, ENV);
    ({ isAllowedSiteOrigin } = await import("./auth-middleware"));
  });

  it("rejects cross-origin state-changing requests", async () => {
    expect(isAllowedSiteOrigin("https://evil.example")).toBe(false);
    expect(isAllowedSiteOrigin(ENV.SITE_ORIGIN)).toBe(true);
    expect(isAllowedSiteOrigin("http://172.30.112.1:3000")).toBe(true);
    expect(isAllowedSiteOrigin(undefined)).toBe(true);
  });

  it("fails closed when SITE_ORIGIN is not configured", async () => {
    delete process.env["SITE_ORIGIN"];
    resetServerRuntimeEnvCache();
    ({ isAllowedSiteOrigin } = await import("./auth-middleware"));
    expect(isAllowedSiteOrigin("http://localhost:3000")).toBe(false);
  });

  it("rejects CSRF requests from another origin", async () => {
    const ctx = {
      request: new Request("http://localhost:3000", {
        headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      }),
      pathname: "/_serverFn/bffLogin",
      context: {},
      next: async () => new Response("ok"),
    };
    const allowed = await isCsrfRequestAllowed(
      {
        origin: (value) => isAllowedSiteOrigin(value),
        secFetchSite: "same-origin",
      },
      ctx,
    );
    expect(isAllowedSiteOrigin("https://evil.example")).toBe(false);
    expect(allowed).toBe(false);
  });
});