import { afterEach, describe, expect, it, vi } from "vitest";
import { dailySeries, manageableActions } from "../admin/backend-people";
import { addUserSchema } from "../api/add-user-types";
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
  createUserFromSession,
  getAdminDashboardFromSession,
  listUsersFromSession,
  resetAdminPeopleBackendClientFactory,
  setAdminPeopleBackendClientFactory,
  updateUserStatusFromSession,
} from "./admin-people-service";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin people BFF", () => {
  afterEach(() => resetAdminPeopleBackendClientFactory());

  it("lists users from GET /users with the session token and filters", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: [], meta: { page: 2, limit: 10, total: 0, totalPages: 0 } }),
      );
    setAdminPeopleBackendClientFactory(() => createBackendClient({ fetchFn }));

    await listUsersFromSession({
      search: " jeanne ",
      role: "FACILITATOR",
      status: "ACTIVE",
      page: 2,
      limit: 10,
    });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://api.test/api/v1/users?search=jeanne&status=ACTIVE&role=FACILITATOR&page=2&limit=10",
    );
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("changes a status with PATCH /users/:id/status", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ id: "u-1", status: "SUSPENDED" }));
    setAdminPeopleBackendClientFactory(() => createBackendClient({ fetchFn }));

    await updateUserStatusFromSession("u-1", {
      status: "SUSPENDED",
      reason: "Shared misleading advice",
    });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/users/u-1/status");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      status: "SUSPENDED",
      reason: "Shared misleading advice",
    });
  });

  it("loads all-time dashboard totals and range-limited registrations", async () => {
    const fetchFn = vi
      .fn()
      .mockImplementation((url: string) => Promise.resolve(jsonResponse({ url })));
    setAdminPeopleBackendClientFactory(() => createBackendClient({ fetchFn }));

    const result = await getAdminDashboardFromSession({ startDate: "2026-11-01T00:00:00.000Z" });

    expect(result.dashboard).toEqual({ url: "http://api.test/api/v1/admin/reports/dashboard" });
    expect(result.registrations).toEqual({
      url: "http://api.test/api/v1/admin/reports/registrations?startDate=2026-11-01T00%3A00%3A00.000Z",
    });
  });

  it("surfaces backend permission errors instead of returning data", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { statusCode: 403, error: "Forbidden", message: "Insufficient permissions" },
          403,
        ),
      );
    setAdminPeopleBackendClientFactory(() => createBackendClient({ fetchFn }));

    await expect(listUsersFromSession({})).rejects.toMatchObject({ status: 403 });
  });
});

describe("admin people helpers", () => {
  it("offers only the status transitions the backend accepts", () => {
    expect(manageableActions("ACTIVE")).toEqual(["SUSPENDED", "INACTIVE"]);
    expect(manageableActions("SUSPENDED")).toEqual(["ACTIVE", "INACTIVE"]);
    expect(manageableActions("INACTIVE")).toEqual(["ACTIVE"]);
    expect(manageableActions("PENDING")).toEqual([]);
    expect(manageableActions("REJECTED")).toEqual([]);
  });

  it("fills days without registrations with zero", () => {
    const today = new Date().toISOString().slice(0, 10);
    const series = dailySeries([{ date: today, count: 3 }], 7);
    expect(series).toHaveLength(7);
    expect(series.at(-1)).toEqual({ day: today.slice(5), count: 3 });
    expect(series.slice(0, 6).every((row) => row.count === 0)).toBe(true);
  });
});

describe("Users → Add user", () => {
  afterEach(() => resetAdminPeopleBackendClientFactory());

  const account = {
    fullName: "Uwase Aline",
    phoneNumber: "0788 123 456",
    email: "Aline@Example.rw",
    preferredLanguage: "rw" as const,
    password: "",
  };

  function capture() {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { userId: "u-9", fullName: "Uwase Aline", email: "aline@example.rw", emailSent: true },
          201,
        ),
      );
    setAdminPeopleBackendClientFactory(() => createBackendClient({ fetchFn }));
    return () => {
      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      return { url, body: JSON.parse(String(init.body)) as Record<string, unknown> };
    };
  }

  it("creates a smartphone farmer through POST /farmers with the full address", async () => {
    const sent = capture();
    const input = addUserSchema.parse({
      ...account,
      role: "SMARTPHONE_FARMER",
      farmerCategory: "SMALLHOLDER",
      location: {
        province: "KIGALI_CITY",
        district: "Gasabo",
        sector: "Kimironko",
        cell: "Bibare",
        village: "Imena",
      },
    });
    const result = await createUserFromSession(input);

    const { url, body } = sent();
    expect(url).toBe("http://api.test/api/v1/farmers");
    expect(body).toEqual({
      fullName: "Uwase Aline",
      phoneNumber: "0788123456",
      email: "aline@example.rw",
      preferredLanguage: "rw",
      farmerType: "SMARTPHONE",
      farmerCategory: "SMALLHOLDER",
      location: {
        province: "KIGALI_CITY",
        district: "Gasabo",
        sector: "Kimironko",
        cell: "Bibare",
        village: "Imena",
      },
    });
    expect(result).toEqual({
      userId: "u-9",
      fullName: "Uwase Aline",
      email: "aline@example.rw",
      role: "SMARTPHONE_FARMER",
      emailSent: true,
    });
  });

  it("creates a facilitator through POST /facilitators without empty optional address parts", async () => {
    const sent = capture();
    await createUserFromSession(
      addUserSchema.parse({
        ...account,
        role: "FACILITATOR",
        professionalTitle: "Agronomist",
        organization: "Rwanda Agriculture Board",
        location: { province: "SOUTHERN", district: "Huye", sector: "", cell: "", village: "" },
      }),
    );
    const { url, body } = sent();
    expect(url).toBe("http://api.test/api/v1/facilitators");
    expect(body).toMatchObject({
      professionalTitle: "Agronomist",
      location: { province: "SOUTHERN", district: "Huye" },
    });
    expect(body["location"]).toEqual({ province: "SOUTHERN", district: "Huye" });
    expect(body).not.toHaveProperty("password");
  });

  it("creates an administrator through POST /users with the ADMIN role", async () => {
    const sent = capture();
    await createUserFromSession(
      addUserSchema.parse({ ...account, role: "ADMIN", password: "Admin2026x" }),
    );
    const { url, body } = sent();
    expect(url).toBe("http://api.test/api/v1/users");
    expect(body).toMatchObject({ roles: ["ADMIN"], password: "Admin2026x" });
  });

  it("rejects incomplete forms before any request", () => {
    expect(
      addUserSchema.safeParse({ ...account, role: "ADMIN", email: "not-an-email" }).success,
    ).toBe(false);
    expect(
      addUserSchema.safeParse({
        ...account,
        role: "SMARTPHONE_FARMER",
        farmerCategory: "SMALLHOLDER",
        location: {
          province: "KIGALI_CITY",
          district: "Gasabo",
          sector: "Kimironko",
          cell: "",
          village: "",
        },
      }).success,
    ).toBe(false);
    expect(addUserSchema.safeParse({ ...account, role: "ADMIN", password: "short" }).success).toBe(
      false,
    );
  });
});
