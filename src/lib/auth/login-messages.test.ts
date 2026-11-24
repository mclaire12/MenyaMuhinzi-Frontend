import { describe, expect, it } from "vitest";
import { loginErrorToast } from "./login-messages";

describe("loginErrorToast", () => {
  it("maps pending approval separately from wrong password", () => {
    expect(loginErrorToast({ code: "unauthorized", message: "x" })).toMatch(/ibanga si byo/i);
    expect(
      loginErrorToast({ code: "forbidden", message: "Your account is awaiting administrator approval" }),
    ).toMatch(/tegereje kwemezwa/i);
  });

  it("maps suspended and rejected accounts", () => {
    expect(loginErrorToast({ code: "forbidden", message: "Your account has been suspended" })).toMatch(/ihagaritswe/i);
    expect(loginErrorToast({ code: "forbidden", message: "Your account request was rejected" })).toMatch(/yanze/i);
  });

  it("maps service unavailability", () => {
    expect(loginErrorToast({ code: "unavailable", message: "redis" })).toMatch(/Serivisi ntiboneka/i);
  });
});