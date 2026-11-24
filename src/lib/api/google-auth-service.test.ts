import { beforeEach, describe, expect, it, vi } from "vitest";
import { bffGoogleOAuthComplete, bffGoogleOAuthStart, bffGoogleOAuthStatus } from "@/lib/auth/google-server-fns";
import { beginGoogleSignIn, completeGoogleSignIn, getGoogleSignInStatus } from "./google-auth-service";

vi.mock("@/lib/auth/google-server-fns", () => ({
  bffGoogleOAuthStatus: vi.fn(),
  bffGoogleOAuthStart: vi.fn(),
  bffGoogleOAuthComplete: vi.fn(),
}));

const statusMock = vi.mocked(bffGoogleOAuthStatus);
const startMock = vi.mocked(bffGoogleOAuthStart);
const completeMock = vi.mocked(bffGoogleOAuthComplete);

describe("google auth service", () => {
  beforeEach(() => {
    statusMock.mockReset();
    startMock.mockReset();
    completeMock.mockReset();
  });

  it("calls BFF start with mode only for login", async () => {
    startMock.mockResolvedValueOnce({ authorizationUrl: "https://accounts.google.com/o/oauth2" });
    const result = await beginGoogleSignIn({ mode: "login" });
    expect(startMock).toHaveBeenCalledWith({ data: { mode: "login" } });
    expect(result.authorizationUrl).toContain("google");
  });

  it("calls BFF complete without exposing tokens", async () => {
    completeMock.mockResolvedValueOnce({
      user: {
        id: "u1",
        fullName: "Test",
        phoneNumber: "+250788123456",
        email: "t@example.rw",
        status: "ACTIVE",
        statusReason: null,
        statusChangedAt: null,
        preferredLanguage: "rw",
        roles: ["SMARTPHONE_FARMER"],
        lastLoginAt: null,
        createdAt: "t",
        updatedAt: "t",
      },
      session: { idleExpiresAt: "t", absoluteExpiresAt: "t" },
    });
    await completeGoogleSignIn({ code: "c", state: "s", callbackUrl: "https://localhost/cb" });
    expect(completeMock).toHaveBeenCalledWith({
      data: { code: "c", state: "s", callbackUrl: "https://localhost/cb" },
    });
  });

  it("reads enabled status from BFF", async () => {
    statusMock.mockResolvedValueOnce({ enabled: true, clientId: "public-id" });
    await expect(getGoogleSignInStatus()).resolves.toEqual({ enabled: true, clientId: "public-id" });
  });
});