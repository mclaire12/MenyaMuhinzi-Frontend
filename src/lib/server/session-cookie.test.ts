import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetServerRuntimeEnvCache } from "./runtime-env";

const setCookie = vi.fn();
const deleteCookie = vi.fn();
const getCookie = vi.fn();
const getRequestProtocol = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
  setCookie,
  deleteCookie,
  getCookie,
  getRequestProtocol,
}));

vi.mock("./session-cookie-security", () => ({
  shouldUseSecureSessionCookie: () => getRequestProtocol() === "https",
}));

const ENV = {
  API_BASE_URL: "http://localhost:4000/api/v1",
  MENYA_BFF_SHARED_SECRET: "test-bff-shared-secret-0123456789abcdefghi",
  SITE_ORIGIN: "http://localhost:3000",
  WEB_SESSION_COOKIE_NAME: "mm_session",
};

describe("session cookie helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    setCookie.mockClear();
    deleteCookie.mockClear();
    getCookie.mockClear();
    resetServerRuntimeEnvCache();
    Object.assign(process.env, ENV);
    getRequestProtocol.mockReturnValue("http");
  });

  it("sets HttpOnly lax cookies without a Domain attribute", async () => {
    const { writeSessionCookie, sessionCookieOptionsForTest } = await import("./session-cookie");
    writeSessionCookie("opaque-id");
    expect(setCookie).toHaveBeenCalledWith(
      "mm_session",
      "opaque-id",
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      }),
    );
    expect(sessionCookieOptionsForTest()).toMatchObject({ secure: false, httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("sets Secure in production HTTPS requests", async () => {
    getRequestProtocol.mockReturnValue("https");
    const { writeSessionCookie } = await import("./session-cookie");
    writeSessionCookie("opaque-id");
    expect(setCookie).toHaveBeenCalledWith("mm_session", "opaque-id", expect.objectContaining({ secure: true }));
  });

  it("clears the session cookie", async () => {
    const { clearSessionCookie } = await import("./session-cookie");
    clearSessionCookie();
    expect(deleteCookie).toHaveBeenCalledWith("mm_session", expect.objectContaining({ path: "/" }));
  });

  it("reads the configured cookie name", async () => {
    getCookie.mockReturnValue(" cookie-value ");
    const { readSessionCookie } = await import("./session-cookie");
    expect(readSessionCookie()).toBe("cookie-value");
  });
});