import { describe, expect, it } from "vitest";
import {
  isSiteOriginAllowed,
  matchesConfiguredSiteOrigin,
  matchesLocalDevSiteOrigin,
  normalizeOrigin,
} from "./site-origin";

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

  it("treats WSL/LAN dev origins on the same port as configured localhost", () => {
    const configured = "http://localhost:3000";
    expect(matchesLocalDevSiteOrigin("http://127.0.0.1:3000", configured)).toBe(true);
    expect(matchesLocalDevSiteOrigin("http://172.30.112.1:3000", configured)).toBe(true);
    expect(matchesLocalDevSiteOrigin("http://192.168.1.42:3000", configured)).toBe(true);
    expect(matchesLocalDevSiteOrigin("https://172.30.112.1:3000", configured)).toBe(false);
    expect(matchesLocalDevSiteOrigin("http://172.30.112.1:5173", configured)).toBe(false);
    expect(
      isSiteOriginAllowed("http://172.30.112.1:3000", configured, { allowLocalDevAliases: true }),
    ).toBe(true);
    expect(
      isSiteOriginAllowed("http://172.30.112.1:3000", configured, { allowLocalDevAliases: false }),
    ).toBe(false);
    expect(
      isSiteOriginAllowed("https://evil.example", configured, { allowLocalDevAliases: true }),
    ).toBe(false);
  });
});