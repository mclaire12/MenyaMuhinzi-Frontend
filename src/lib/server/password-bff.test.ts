import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBackendClient } from "./backend-client";
import {
  requestPasswordReset,
  resetPasswordBackendClientFactory,
  resetPasswordWithToken,
  setPasswordBackendClientFactory,
  toSafeForgotPasswordResult,
} from "./password-service";
import { resetServerRuntimeEnvCache } from "./runtime-env";

const ENV = {
  API_BASE_URL: "http://localhost:4000/api/v1",
  MENYA_BFF_SHARED_SECRET: "test-bff-shared-secret-0123456789abcdefghi",
  SITE_ORIGIN: "http://localhost:3000",
  WEB_SESSION_COOKIE_NAME: "mm_session",
};

describe("password BFF service", () => {
  beforeEach(() => {
    resetServerRuntimeEnvCache();
    resetPasswordBackendClientFactory();
    Object.assign(process.env, ENV);
  });

  it("strips reset tokens from forgot-password responses", () => {
    const safe = toSafeForgotPasswordResult({
      message: "If an active account matches, password reset instructions have been sent.",
      resetToken: "opaque-dev-token",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    expect(safe).toEqual({
      message: "If an active account matches, password reset instructions have been sent.",
    });
    expect("resetToken" in safe).toBe(false);
  });

  it("calls forgot-password and reset-password on the backend", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/forgot-password")) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            message: "If an active account matches, password reset instructions have been sent.",
            resetToken: "dev-only",
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/auth/reset-password")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          token: "reset-token",
          newPassword: "Ibihingwa2027",
        });
        return new Response(null, { status: 204 });
      }
      return new Response("not found", { status: 404 });
    });
    setPasswordBackendClientFactory(() => createBackendClient({ fetchFn: fetchMock as typeof fetch }));

    const forgot = await requestPasswordReset("jeanne@example.rw");
    expect(forgot.resetToken).toBe("dev-only");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await resetPasswordWithToken("reset-token", "Ibihingwa2027");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});