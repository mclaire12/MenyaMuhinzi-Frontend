import { describe, expect, it } from "vitest";
import { homeForApiRoles } from "./auth-routing";
import { toAppRoles } from "./app-roles";

describe("post-login navigation", () => {
  it("routes roles to the existing portals", () => {
    expect(homeForApiRoles(["ADMIN"])).toBe("/admin");
    expect(homeForApiRoles(["FACILITATOR"])).toBe("/facilitator");
    expect(homeForApiRoles(["SMARTPHONE_FARMER"])).toBe("/dashboard");
    expect(homeForApiRoles(["BASIC_PHONE_FARMER"])).toBe("/phone");
  });

  it("maps backend roles for legacy UI checks", () => {
    expect(toAppRoles(["ADMIN", "FACILITATOR"])).toEqual(["admin", "facilitator"]);
    expect(toAppRoles(["SMARTPHONE_FARMER"])).toEqual(["farmer"]);
  });
});