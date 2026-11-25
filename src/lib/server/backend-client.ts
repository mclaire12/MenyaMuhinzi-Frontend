import { getApiErrorMessage, isApiErrorResponse } from "../api/api-error";
import type { ApiErrorResponse } from "../api/types";
import {
  ACCESS_EXPIRES_HEADER,
  ACCESS_TOKEN_HEADER,
  BFF_SECRET_HEADER,
  redactHeaderRecord,
  WEB_SESSION_HEADER,
} from "./bff-headers";
import { BffAuthError, mapHttpStatusToBffCode, safeBackendMessage } from "./bff-error";
import { getServerRuntimeEnv } from "./runtime-env";

const DEFAULT_TIMEOUT_MS = 15_000;

export interface WebSessionCreatedBody {
  user: import("../api/types").UserResponse;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export interface BackendClientOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export interface WebSessionRefreshResult {
  sessionId: string;
  accessToken: string;
  expiresIn: number;
}

function joinUrl(base: string, path: string): string {
  return `${base}/${path.replace(/^\/+/, "")}`;
}

function reportRange(query: {
  startDate?: string | undefined;
  endDate?: string | undefined;
}): string {
  const params = new URLSearchParams();
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function headerValue(headers: Headers, name: string): string | undefined {
  const value = headers.get(name);
  return value && value.trim() ? value.trim() : undefined;
}

export function createBackendClient(options: BackendClientOptions = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  function bffHeaders(sessionId?: string): Headers {
    const env = getServerRuntimeEnv();
    const headers = new Headers({
      Accept: "application/json",
      [BFF_SECRET_HEADER]: env.bffSharedSecret,
    });
    if (sessionId) headers.set(WEB_SESSION_HEADER, sessionId);
    return headers;
  }

  async function request(
    path: string,
    init: { method: string; body?: unknown; sessionId?: string; accessToken?: string },
  ): Promise<{ response: Response; payload: unknown }> {
    const env = getServerRuntimeEnv();
    const headers = bffHeaders(init.sessionId);
    if (init.accessToken) headers.set("Authorization", `Bearer ${init.accessToken}`);
    let body: BodyInit | undefined;
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(joinUrl(env.apiBaseUrl, path), {
        method: init.method,
        headers,
        body,
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: unknown;
      if (text) {
        try {
          payload = JSON.parse(text) as unknown;
        } catch {
          payload = undefined;
        }
      }

      if (!response.ok) {
        const code = mapHttpStatusToBffCode(response.status);
        throw new BffAuthError(safeBackendMessage(payload, response.status), {
          code,
          status: response.status,
        });
      }

      return { response, payload };
    } catch (cause) {
      if (cause instanceof BffAuthError) throw cause;
      if (controller.signal.aborted) {
        throw new BffAuthError("Serivisi yatinze.", { code: "timeout", cause });
      }
      throw new BffAuthError("Ntitubashije guhuza na serivisi.", { code: "network", cause });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async getGoogleOAuthStatus(): Promise<{ enabled: boolean; clientId?: string }> {
      const { payload } = await request("auth/web-sessions/google/status", { method: "GET" });
      return payload as { enabled: boolean; clientId?: string };
    },

    async startGoogleOAuth(input: {
      mode: "login" | "register";
      redirectUri: string;
      accountType?: string;
      phoneNumber?: string;
      fullName?: string;
      preferredLanguage?: string;
    }): Promise<{ authorizationUrl: string }> {
      const { payload } = await request("auth/web-sessions/google/start", {
        method: "POST",
        body: input,
      });
      return payload as { authorizationUrl: string };
    },

    async completeGoogleOAuth(input: {
      code: string;
      state: string;
      callbackUrl: string;
    }): Promise<{ sessionId: string; body: WebSessionCreatedBody }> {
      const { response, payload } = await request("auth/web-sessions/google/complete", {
        method: "POST",
        body: input,
      });
      const sessionId = headerValue(response.headers, WEB_SESSION_HEADER);
      if (!sessionId) {
        throw new BffAuthError("Serivisi ntiboneka.", { code: "unavailable", status: 502 });
      }
      return { sessionId, body: payload as WebSessionCreatedBody };
    },

    async createWebSession(
      identifier: string,
      password: string,
    ): Promise<{ sessionId: string; body: WebSessionCreatedBody }> {
      const { response, payload } = await request("auth/web-sessions", {
        method: "POST",
        body: { identifier, password },
      });
      const sessionId = headerValue(response.headers, WEB_SESSION_HEADER);
      if (!sessionId) {
        throw new BffAuthError("Serivisi ntiboneka.", { code: "unavailable", status: 502 });
      }
      return { sessionId, body: payload as WebSessionCreatedBody };
    },

    async getWebSessionUser(
      sessionId: string,
    ): Promise<import("../api/types").CurrentUserResponse> {
      const { payload } = await request("auth/web-sessions/me", { method: "GET", sessionId });
      return payload as import("../api/types").CurrentUserResponse;
    },

    async refreshWebSession(sessionId: string): Promise<WebSessionRefreshResult> {
      const { response } = await request("auth/web-sessions/refresh", {
        method: "POST",
        sessionId,
      });
      const nextSessionId = headerValue(response.headers, WEB_SESSION_HEADER);
      const accessToken = headerValue(response.headers, ACCESS_TOKEN_HEADER);
      const expiresRaw = headerValue(response.headers, ACCESS_EXPIRES_HEADER);
      const expiresIn = expiresRaw ? Number.parseInt(expiresRaw, 10) : Number.NaN;
      if (!nextSessionId || !accessToken || !Number.isFinite(expiresIn)) {
        throw new BffAuthError("Serivisi ntiboneka.", { code: "unavailable", status: 502 });
      }
      return { sessionId: nextSessionId, accessToken, expiresIn };
    },

    async logoutWebSession(sessionId: string): Promise<void> {
      await request("auth/web-sessions/current", { method: "DELETE", sessionId });
    },

    async changePassword(
      accessToken: string,
      input: { currentPassword: string; newPassword: string },
    ): Promise<void> {
      await request("auth/change-password", {
        method: "POST",
        body: input,
        accessToken,
      });
    },

    async forgotPassword(
      identifier: string,
    ): Promise<import("../api/types").ForgotPasswordResponse> {
      const { payload } = await request("auth/forgot-password", {
        method: "POST",
        body: { identifier },
      });
      return payload as import("../api/types").ForgotPasswordResponse;
    },

    async resetPassword(token: string, newPassword: string): Promise<void> {
      await request("auth/reset-password", {
        method: "POST",
        body: { token, newPassword },
      });
    },

    async verifyEmail(token: string, code: string): Promise<void> {
      await request("auth/verify-email", { method: "POST", body: { token, code } });
    },

    async resendVerification(identifier: string): Promise<{ message: string }> {
      const { payload } = await request("auth/resend-verification", {
        method: "POST",
        body: { identifier },
      });
      return payload as { message: string };
    },

    async listAccountRequests(
      accessToken: string,
      query: import("../api/account-request-types").ListAccountRequestsQuery,
    ): Promise<import("../api/account-request-types").PaginatedAccountRequests> {
      const params = new URLSearchParams();
      if (query.status) params.set("status", query.status);
      if (query.requestedRole) params.set("requestedRole", query.requestedRole);
      if (query.search?.trim()) params.set("search", query.search.trim());
      if (query.page !== undefined) params.set("page", String(query.page));
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      const qs = params.toString();
      const { payload } = await request(`accounts/requests${qs ? `?${qs}` : ""}`, {
        method: "GET",
        accessToken,
      });
      return payload as import("../api/account-request-types").PaginatedAccountRequests;
    },

    async getAccountRequest(
      accessToken: string,
      id: string,
    ): Promise<import("../api/account-request-types").AccountRequestResponse> {
      const { payload } = await request(`accounts/requests/${id}`, { method: "GET", accessToken });
      return payload as import("../api/account-request-types").AccountRequestResponse;
    },

    /** POST /farmers — administrators register a farmer directly (requires farmers:create). */
    async createFarmer(
      accessToken: string,
      body: import("../api/basic-phone-farmer-types").CreateBasicPhoneFarmerBody,
    ): Promise<import("../api/basic-phone-farmer-types").CreatedFarmerResponse> {
      const { payload } = await request("farmers", { method: "POST", body, accessToken });
      return payload as import("../api/basic-phone-farmer-types").CreatedFarmerResponse;
    },

    /** POST /accounts/requests — facilitators submit a farmer for administrator approval. */
    async createAccountRequest(
      accessToken: string,
      body: import("../api/basic-phone-farmer-types").CreateBasicPhoneFarmerBody & {
        notes?: string;
      },
    ): Promise<import("../api/account-request-types").AccountRequestResponse> {
      const { payload } = await request("accounts/requests", { method: "POST", body, accessToken });
      return payload as import("../api/account-request-types").AccountRequestResponse;
    },

    async approveAccountRequest(
      accessToken: string,
      id: string,
      body: import("../api/account-request-types").ApproveAccountRequestInput,
    ): Promise<import("../api/account-request-types").AccountRequestResponse> {
      const { payload } = await request(`accounts/requests/${id}/approve`, {
        method: "POST",
        body,
        accessToken,
      });
      return payload as import("../api/account-request-types").AccountRequestResponse;
    },

    async rejectAccountRequest(
      accessToken: string,
      id: string,
      body: import("../api/account-request-types").RejectAccountRequestInput,
    ): Promise<import("../api/account-request-types").AccountRequestResponse> {
      const { payload } = await request(`accounts/requests/${id}/reject`, {
        method: "POST",
        body,
        accessToken,
      });
      return payload as import("../api/account-request-types").AccountRequestResponse;
    },

    /**
     * Creates an account for Users → Add user: POST /users (administrators),
     * POST /facilitators or POST /farmers. The backend checks the caller's permissions.
     */
    async createAccount(
      accessToken: string,
      path: "users" | "facilitators" | "farmers",
      body:
        | import("../api/add-user-types").CreateStaffUserBody
        | import("../api/add-user-types").CreateFacilitatorBody
        | import("../api/add-user-types").CreateSmartphoneFarmerBody,
    ): Promise<import("../api/add-user-types").CreatedAccountResponse> {
      const { payload } = await request(path, { method: "POST", body, accessToken });
      return payload as import("../api/add-user-types").CreatedAccountResponse;
    },

    /** GET /users — administrators (users:read). */
    async listUsers(
      accessToken: string,
      query: import("../api/admin-people-types").ListAdminUsersQuery,
    ): Promise<import("../api/admin-people-types").PaginatedAdminUsers> {
      const params = new URLSearchParams();
      if (query.search?.trim()) params.set("search", query.search.trim());
      if (query.status) params.set("status", query.status);
      if (query.role) params.set("role", query.role);
      if (query.page !== undefined) params.set("page", String(query.page));
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      const qs = params.toString();
      const { payload } = await request(`users${qs ? `?${qs}` : ""}`, {
        method: "GET",
        accessToken,
      });
      return payload as import("../api/admin-people-types").PaginatedAdminUsers;
    },

    /** GET /users/:id — administrators (users:read). */
    async getUser(
      accessToken: string,
      id: string,
    ): Promise<import("../api/admin-people-types").AdminUserResponse> {
      const { payload } = await request(`users/${id}`, { method: "GET", accessToken });
      return payload as import("../api/admin-people-types").AdminUserResponse;
    },

    /** PATCH /users/:id/status — administrators (users:manage-status). */
    async updateUserStatus(
      accessToken: string,
      id: string,
      body: import("../api/admin-people-types").UpdateAdminUserStatusInput,
    ): Promise<import("../api/admin-people-types").AdminUserResponse> {
      const { payload } = await request(`users/${id}/status`, {
        method: "PATCH",
        body,
        accessToken,
      });
      return payload as import("../api/admin-people-types").AdminUserResponse;
    },

    /** GET /admin/reports/dashboard — administrators (reports:read). */
    async getAdminDashboardReport(
      accessToken: string,
      query: import("../api/admin-people-types").ReportRangeQuery,
    ): Promise<import("../api/admin-people-types").AdminDashboardReport> {
      const { payload } = await request(`admin/reports/dashboard${reportRange(query)}`, {
        method: "GET",
        accessToken,
      });
      return payload as import("../api/admin-people-types").AdminDashboardReport;
    },

    /** GET /facilitator/reports/dashboard — facilitators (facilitator-reports:read), own groups only. */
    async getFacilitatorDashboardReport(
      accessToken: string,
      query: import("../api/admin-people-types").ReportRangeQuery,
    ): Promise<import("../api/facilitator-dashboard-types").FacilitatorDashboardReport> {
      const { payload } = await request(`facilitator/reports/dashboard${reportRange(query)}`, {
        method: "GET",
        accessToken,
      });
      return payload as import("../api/facilitator-dashboard-types").FacilitatorDashboardReport;
    },

    /** GET /admin/reports/registrations — administrators (reports:read). */
    async getAdminRegistrationsReport(
      accessToken: string,
      query: import("../api/admin-people-types").ReportRangeQuery,
    ): Promise<import("../api/admin-people-types").AdminRegistrationsReport> {
      const { payload } = await request(`admin/reports/registrations${reportRange(query)}`, {
        method: "GET",
        accessToken,
      });
      return payload as import("../api/admin-people-types").AdminRegistrationsReport;
    },

    /** @internal */
    redactHeadersForLog(headers: Headers): Record<string, string> {
      const record: Record<string, string> = {};
      headers.forEach((value, key) => {
        record[key.toLowerCase()] = value;
      });
      return redactHeaderRecord(record);
    },
  };
}

export type BackendClient = ReturnType<typeof createBackendClient>;

export function isBackendErrorPayload(value: unknown): value is ApiErrorResponse {
  return isApiErrorResponse(value);
}

export function formatBackendError(payload: unknown): string {
  return isApiErrorResponse(payload) ? getApiErrorMessage(payload) : "Igikorwa nticyashoboye.";
}
