import {
  BFF_SECRET_HEADER,
  ACCESS_TOKEN_HEADER,
  WEB_SESSION_HEADER,
  redactHeaderRecord,
} from "./bff-headers";

describe("redactHeaderRecord", () => {
  it("redacts sensitive backend headers", () => {
    const redacted = redactHeaderRecord({
      [BFF_SECRET_HEADER]: "super-secret",
      [WEB_SESSION_HEADER]: "opaque-session-id",
      [ACCESS_TOKEN_HEADER]: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      "content-type": "application/json",
    });
    expect(redacted[BFF_SECRET_HEADER]).toBe("[redacted]");
    expect(redacted[WEB_SESSION_HEADER]).toBe("[redacted]");
    expect(redacted[ACCESS_TOKEN_HEADER]).toBe("[redacted]");
    expect(redacted["content-type"]).toBe("application/json");
  });
});