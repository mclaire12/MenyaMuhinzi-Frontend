import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getRequestProtocol = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({ getRequestProtocol }));

describe("shouldUseSecureSessionCookie", () => {
  const previousVercel = process.env["VERCEL"];

  beforeEach(() => {
    vi.resetModules();
    getRequestProtocol.mockReset();
    if (previousVercel === undefined) delete process.env["VERCEL"];
    else process.env["VERCEL"] = previousVercel;
  });

  afterEach(() => {
    if (previousVercel === undefined) delete process.env["VERCEL"];
    else process.env["VERCEL"] = previousVercel;
  });

  it("uses Secure=false on local HTTP", async () => {
    getRequestProtocol.mockReturnValue("http");
    const { shouldUseSecureSessionCookie } = await import("./session-cookie-security");
    expect(shouldUseSecureSessionCookie()).toBe(false);
    expect(getRequestProtocol).toHaveBeenCalledWith({});
  });

  it("trusts x-forwarded-proto only on Vercel", async () => {
    process.env["VERCEL"] = "1";
    getRequestProtocol.mockReturnValue("https");
    const { shouldUseSecureSessionCookie } = await import("./session-cookie-security");
    expect(shouldUseSecureSessionCookie()).toBe(true);
    expect(getRequestProtocol).toHaveBeenCalledWith({ xForwardedProto: true });
  });
});