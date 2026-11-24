import {
  getServerRuntimeEnv,
  resetServerRuntimeEnvCache,
} from "./runtime-env";

const VALID = {
  API_BASE_URL: "http://localhost:4000/api/v1",
  MENYA_BFF_SHARED_SECRET: "test-bff-shared-secret-0123456789abcdefghi",
  SITE_ORIGIN: "http://localhost:3000",
  WEB_SESSION_COOKIE_NAME: "mm_session",
} as const;

const ENV_KEYS = [
  "API_BASE_URL",
  "MENYA_BFF_SHARED_SECRET",
  "SITE_ORIGIN",
  "WEB_SESSION_COOKIE_NAME",
] as const;

describe("getServerRuntimeEnv", () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) snapshot[key] = process.env[key];
  });

  beforeEach(() => {
    resetServerRuntimeEnvCache();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    resetServerRuntimeEnvCache();
    for (const key of ENV_KEYS) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  });

  it("parses server-only variables without VITE_ prefixes", () => {
    Object.assign(process.env, VALID);
    const env = getServerRuntimeEnv();
    expect(env.apiBaseUrl).toBe("http://localhost:4000/api/v1");
    expect(env.bffSharedSecret).toBe(VALID.MENYA_BFF_SHARED_SECRET);
    expect(env.siteOrigin).toBe("http://localhost:3000");
    expect(env.webSessionCookieName).toBe("mm_session");
  });

  it("strips trailing slashes from URL values", () => {
    Object.assign(process.env, {
      ...VALID,
      API_BASE_URL: "http://localhost:4000/api/v1/",
      SITE_ORIGIN: "http://localhost:3000/",
    });
    const env = getServerRuntimeEnv();
    expect(env.apiBaseUrl).toBe("http://localhost:4000/api/v1");
    expect(env.siteOrigin).toBe("http://localhost:3000");
  });

  it("defaults the web session cookie name", () => {
    Object.assign(process.env, VALID);
    delete process.env["WEB_SESSION_COOKIE_NAME"];
    expect(getServerRuntimeEnv().webSessionCookieName).toBe("mm_session");
  });

  it("fails closed when required variables are missing", () => {
    expect(() => getServerRuntimeEnv()).toThrow(/invalid or incomplete/i);
  });
});