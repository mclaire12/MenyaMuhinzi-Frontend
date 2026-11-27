import { afterEach, describe, expect, it, vi } from "vitest";
import { adminApiQueryString, isAllowedAdminApiPath } from "../api/admin-api-routes";
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
  callAdminApiFromSession,
  resetAdminApiBackendClientFactory,
  setAdminApiBackendClientFactory,
  stripSensitive,
} from "./admin-api-service";

function json(body: unknown, status = 200) {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin API allow-list", () => {
  it.each([
    "admin/groups",
    "admin/groups/7c3d8b3e-0000-4000-8000-000000000000/courses",
    "courses/abc/publish",
    "modules/abc/lessons",
    "lessons/abc",
    "knowledge/sources/abc/submit-review",
    "admin/ai/assistants/abc/prompts",
    "admin/ussd/configuration",
    "admin/notifications/deliveries",
    "admin/audit-logs",
    "settings",
    "health",
    "crops",
    "farmers",
    "facilitator/groups/7c3d8b3e-0000-4000-8000-000000000000/members",
  ])("allows %s", (path) => {
    expect(isAllowedAdminApiPath(path)).toBe(true);
  });

  it.each([
    "auth/login",
    "auth/web-sessions/me",
    "users",
    "accounts/requests",
    "admin/groups/../users",
    "courses//publish",
    "/courses",
    "courses?status=DRAFT",
    "ai/conversations",
    "admin/groups/a/b/c/d/e",
  ])("refuses %s", (path) => {
    expect(isAllowedAdminApiPath(path)).toBe(false);
  });

  it("builds query strings without empty values", () => {
    expect(
      adminApiQueryString({ page: 2, search: "tomato farmers", status: undefined, q: "" }),
    ).toBe("?page=2&search=tomato+farmers");
    expect(adminApiQueryString(undefined)).toBe("");
  });
});

describe("admin API service", () => {
  afterEach(() => resetAdminApiBackendClientFactory());

  it("forwards GET with the session token and the query", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ data: [], meta: { total: 0 } }));
    setAdminApiBackendClientFactory(() => createBackendClient({ fetchFn }));

    await callAdminApiFromSession({
      method: "GET",
      path: "admin/groups",
      query: { page: 1, status: "ACTIVE" },
    });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/admin/groups?page=1&status=ACTIVE");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("sends a JSON body for state changes and an empty object when none is given", async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(json({ ok: true })));
    setAdminApiBackendClientFactory(() => createBackendClient({ fetchFn }));

    await callAdminApiFromSession({ method: "POST", path: "courses/c-1/unpublish" });
    await callAdminApiFromSession({
      method: "PATCH",
      path: "admin/groups/g-1",
      body: { status: "INACTIVE" },
    });

    expect(JSON.parse(String((fetchFn.mock.calls[0] as [string, RequestInit])[1].body))).toEqual(
      {},
    );
    expect(JSON.parse(String((fetchFn.mock.calls[1] as [string, RequestInit])[1].body))).toEqual({
      status: "INACTIVE",
    });
  });

  it("returns null for empty 204 responses (DELETE)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    setAdminApiBackendClientFactory(() => createBackendClient({ fetchFn }));
    await expect(
      callAdminApiFromSession({ method: "DELETE", path: "lessons/l-1" }),
    ).resolves.toBeNull();
  });

  it("refuses endpoints outside the allow-list before calling the backend", async () => {
    const fetchFn = vi.fn();
    setAdminApiBackendClientFactory(() => createBackendClient({ fetchFn }));
    await expect(
      callAdminApiFromSession({ method: "GET", path: "auth/web-sessions/me" }),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("passes backend errors on with their status", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json(
        {
          statusCode: 409,
          error: "Conflict",
          message: "Course is already published",
          path: "/api/v1/courses/c-1/publish",
          method: "POST",
          timestamp: "2026-11-27T10:00:00.000Z",
          requestId: "r-1",
        },
        409,
      ),
    );
    setAdminApiBackendClientFactory(() => createBackendClient({ fetchFn }));
    await expect(
      callAdminApiFromSession({
        method: "POST",
        path: "courses/c-1/publish",
        body: { scope: "PLATFORM" },
      }),
    ).rejects.toMatchObject({ status: 409, message: "Course is already published" });
  });

  it("never forwards token or secret fields to the browser", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        json({ id: "m-1", apiKey: "sk-123", nested: [{ tokenHash: "x", name: "ok" }] }),
      );
    setAdminApiBackendClientFactory(() => createBackendClient({ fetchFn }));
    await expect(
      callAdminApiFromSession({ method: "GET", path: "admin/ai/models" }),
    ).resolves.toEqual({
      id: "m-1",
      nested: [{ name: "ok" }],
    });
  });

  it("strips nested sensitive keys", () => {
    expect(
      stripSensitive({
        a: 1,
        refreshToken: "r",
        b: { passwordHash: "h", c: [1, { secret: "s", d: 2 }] },
      }),
    ).toEqual({
      a: 1,
      b: { c: [1, { d: 2 }] },
    });
  });
});
