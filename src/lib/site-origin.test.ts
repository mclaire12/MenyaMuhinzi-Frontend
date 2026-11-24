import { describe, expect, it } from "vitest";
import { matchesConfiguredSiteOrigin, normalizeOrigin } from "./site-origin";

describe("site origin matching", () => {
  it("compares scheme, host and port", () => {
    expect(normalizeOrigin("https://app.example.rw/")).toBe("https://app.example.rw");
    expect(
      matchesConfiguredSiteOrigin("https://app.example.rw:443", "https://app.example.rw/"),
    ).toBe(true);
    expect(matchesConfiguredSiteOrigin("http://app.example.rw", "https://app.example.rw")).toBe(false);
  });

  it("allows requests with no Origin header", () => {
    expect(matchesConfiguredSiteOrigin(undefined, "https://app.example.rw")).toBe(true);
  });
});