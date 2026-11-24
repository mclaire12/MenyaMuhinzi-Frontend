import { ApiError, getApiErrorMessage, isApiErrorResponse } from "./api-error";

const DEFAULT_TIMEOUT_MS = 10_000;

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Sent as `Authorization: Bearer` only when provided. This client does not store tokens. */
  accessToken?: string;
  headers?: HeadersInit;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  /** Absolute API root, or a function so a missing env var fails at request time. */
  baseUrl: string | (() => string);
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

function resolveBaseUrl(baseUrl: string | (() => string)): string {
  const value = (typeof baseUrl === "function" ? baseUrl() : baseUrl).trim().replace(/\/+$/, "");
  if (!value) {
    throw new ApiError("VITE_API_BASE_URL is not configured.", { kind: "configuration" });
  }
  return value;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export function readApiBaseUrl(): string {
  const configured = import.meta.env["VITE_API_BASE_URL"];
  if (typeof configured !== "string" || !configured.trim()) {
    throw new ApiError("VITE_API_BASE_URL is not configured.", { kind: "configuration" });
  }
  return configured.trim().replace(/\/+$/, "");
}

export function createApiClient(options: ApiClientOptions) {
  const fetchFn = options.fetchFn ?? fetch;
  const defaultTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
    const { method = "GET", body, accessToken, headers: requestHeaders, signal, timeoutMs } = requestOptions;
    const headers = new Headers(requestHeaders);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    let requestBody: BodyInit | undefined;
    if (body !== undefined) {
      if (isFormData(body)) {
        requestBody = body;
      } else {
        if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        const serialized = JSON.stringify(body);
        if (serialized === undefined) {
          throw new ApiError("Request body must be JSON serializable.", { kind: "response" });
        }
        requestBody = serialized;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs ?? defaultTimeout);
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) abortFromCaller();
      else signal.addEventListener("abort", abortFromCaller, { once: true });
    }

    const url = joinUrl(resolveBaseUrl(options.baseUrl), path);
    try {
      const response = await fetchFn(url, {
        method,
        headers,
        ...(requestBody !== undefined ? { body: requestBody } : {}),
        signal: controller.signal,
      });

      if (response.status === 204 || response.status === 205) return undefined as T;

      const text = await response.text();
      let payload: unknown;
      if (text) {
        try {
          payload = JSON.parse(text) as unknown;
        } catch (cause) {
          throw new ApiError("The API returned an invalid JSON response.", {
            kind: "response",
            status: response.status,
            cause,
          });
        }
      }

      if (!response.ok) {
        const apiError = isApiErrorResponse(payload) ? payload : undefined;
        throw new ApiError(
          apiError ? getApiErrorMessage(apiError) : `API request failed with status ${response.status}.`,
          { kind: "http", status: response.status, ...(apiError ? { response: apiError } : {}) },
        );
      }

      return payload as T;
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      if (controller.signal.aborted) {
        const timedOut = !signal?.aborted;
        throw new ApiError(timedOut ? "The API request timed out." : "The API request was aborted.", {
          kind: timedOut ? "timeout" : "aborted",
          cause,
        });
      }
      throw new ApiError("Unable to reach the API.", { kind: "network", cause });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  return {
    request,
    get<T>(path: string, requestOptions?: Omit<ApiRequestOptions, "method" | "body">) {
      return request<T>(path, { ...requestOptions, method: "GET" });
    },
    post<T>(path: string, body?: unknown, requestOptions?: Omit<ApiRequestOptions, "method" | "body">) {
      return request<T>(path, { ...requestOptions, method: "POST", ...(body !== undefined ? { body } : {}) });
    },
    patch<T>(path: string, body?: unknown, requestOptions?: Omit<ApiRequestOptions, "method" | "body">) {
      return request<T>(path, { ...requestOptions, method: "PATCH", ...(body !== undefined ? { body } : {}) });
    },
    put<T>(path: string, body?: unknown, requestOptions?: Omit<ApiRequestOptions, "method" | "body">) {
      return request<T>(path, { ...requestOptions, method: "PUT", ...(body !== undefined ? { body } : {}) });
    },
    delete<T>(path: string, requestOptions?: Omit<ApiRequestOptions, "method" | "body">) {
      return request<T>(path, { ...requestOptions, method: "DELETE" });
    },
  };
}

/** Shared client. Reads `VITE_API_BASE_URL` when a request is made. Does not store tokens. */
export const api = createApiClient({ baseUrl: readApiBaseUrl });
