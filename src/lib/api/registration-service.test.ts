import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistrationRequest, RegistrationResponse } from "./types";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("./api-client", () => ({
  api: { post },
}));

import { registerAccount } from "./registration-service";

const request: RegistrationRequest = {
  accountType: "SMARTPHONE_FARMER",
  fullName: "Uwimana Jeanne",
  phoneNumber: "+250788123456",
  password: "Umuhinzi2026",
  preferredLanguage: "rw",
  location: { province: "NORTHERN", district: "Musanze", sector: "Muhoza" },
  farmerCategory: "SMALLHOLDER",
};

const response: RegistrationResponse = {
  user: {
    id: "user-1",
    fullName: "Uwimana Jeanne",
    phoneNumber: "+250788123456",
    email: null,
    status: "PENDING",
    statusReason: null,
    statusChangedAt: null,
    preferredLanguage: "rw",
    roles: ["SMARTPHONE_FARMER"],
    lastLoginAt: null,
    createdAt: "2026-11-24T00:00:00.000Z",
    updatedAt: "2026-11-24T00:00:00.000Z",
  },
  requiresApproval: true,
  accountRequestId: "request-1",
  message: "Registration received. An administrator will review your account.",
};

describe("registerAccount", () => {
  beforeEach(() => {
    post.mockReset();
    localStorage.clear();
  });

  it("posts the registration and does not write the mock store or a demo session", async () => {
    post.mockResolvedValue(response);
    localStorage.setItem("mm-admin-mock-v1", "{\"users\":[]}");
    localStorage.setItem("mm-demo-user", "{\"role\":\"farmer\"}");

    await expect(registerAccount(request)).resolves.toEqual(response);
    expect(post).toHaveBeenCalledWith("auth/register", request);
    expect(localStorage.getItem("mm-admin-mock-v1")).toBe("{\"users\":[]}");
    expect(localStorage.getItem("mm-demo-user")).toBe("{\"role\":\"farmer\"}");
  });
});
