import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-error";
import { createApiClient } from "./api-client";

const baseUrl = "http://localhost:4000/api/v1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  it("performs a successful GET", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ status: "ok" }));
    const client = createApiClient({ baseUrl, fetchFn });
    await expect(client.get("health")).resolves.toEqual({ status: "ok" });
    expect(fetchFn).toHaveBeenCalledWith(`${baseUrl}/health`, expect.objectContaining({ method: "GET" }));
  });

  it("performs a successful POST with a JSON body", async () => {
    const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.body).toBe(JSON.stringify({ email: "a@b.rw" }));
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      return jsonResponse({ id: "1" }, 201);
    });
    const client = createApiClient({ baseUrl, fetchFn });
    await expect(client.post("auth/login", { email: "a@b.rw" })).resolves.toEqual({ id: "1" });
  });

  it("returns undefined for HTTP 204", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl, fetchFn });
    await expect(client.post("auth/logout")).resolves.toBeUndefined();
  });

  it("normalizes an HTTP error envelope", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({
      statusCode: 409,
      error: "Conflict",
      message: ["Phone number already registered"],
      path: "/api/v1/auth/register",
      method: "POST",
      timestamp: "2026-01-01T00:00:00.000Z",
      requestId: "req-1",
    }, 409));
    const client = createApiClient({ baseUrl, fetchFn });
    const error = await client.post("auth/register", {}).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    if (!(error instanceof ApiError)) return;
    expect(error.category()).toBe("conflict");
    expect(error.status).toBe(409);
    expect(error.message).toBe("Phone number already registered");
    expect(error.response?.requestId).toBe("req-1");
  });

  it("reports a network failure", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const client = createApiClient({ baseUrl, fetchFn });
    const error = await client.get("health").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    if (!(error instanceof ApiError)) return;
    expect(error.category()).toBe("network");
  });

  it("reports a timeout", async () => {
    const fetchFn = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const client = createApiClient({ baseUrl, fetchFn, timeoutMs: 15 });
    const error = await client.get("health").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    if (!(error instanceof ApiError)) return;
    expect(error.category()).toBe("timeout");
  });

  it("sends an Authorization header only when a token is provided", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
    const client = createApiClient({ baseUrl, fetchFn });
    await client.get("auth/me");
    const firstHeaders = new Headers(fetchFn.mock.calls[0]?.[1]?.headers);
    expect(firstHeaders.get("Authorization")).toBeNull();

    await client.get("auth/me", { accessToken: "access-token" });
    const secondHeaders = new Headers(fetchFn.mock.calls[1]?.[1]?.headers);
    expect(secondHeaders.get("Authorization")).toBe("Bearer access-token");
  });
});
