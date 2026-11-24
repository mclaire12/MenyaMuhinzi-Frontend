import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUserResponse } from "@/lib/api/types";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";
import { BffAuthError } from "@/lib/server/bff-error";

const bffMocks = vi.hoisted(() => ({
  bffRestoreSession: vi.fn(),
  bffGetCurrentUser: vi.fn(),
  bffLogin: vi.fn(),
  bffLogout: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server-fns", () => ({
  bffRestoreSession: bffMocks.bffRestoreSession,
  bffGetCurrentUser: bffMocks.bffGetCurrentUser,
  bffLogin: bffMocks.bffLogin,
  bffLogout: bffMocks.bffLogout,
}));

const { bffRestoreSession, bffGetCurrentUser, bffLogin, bffLogout } = bffMocks;

import { AuthProvider, useAuth } from "./use-auth";

const activeUser: CurrentUserResponse = {
  id: "u1",
  fullName: "Test",
  phoneNumber: "+250788000001",
  email: "test@example.rw",
  status: "ACTIVE",
  statusReason: null,
  statusChangedAt: null,
  preferredLanguage: "rw",
  roles: ["SMARTPHONE_FARMER"],
  permissions: [],
  location: null,
  farmerProfile: null,
  facilitatorProfile: null,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffRestoreSession.mockResolvedValue(null);
  });

  it("restores a session from the BFF without browser token storage", async () => {
    bffRestoreSession.mockResolvedValue(activeUser);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe("u1");
    expect(localStorage.getItem("mm-demo-user")).toBeNull();
  });

  it("treats a missing session as unauthenticated", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("keeps unavailable state instead of logging out on backend outage", async () => {
    bffRestoreSession.mockRejectedValue(
      serializeBffAuthFailure(new BffAuthError("Serivisi ntiboneka.", { code: "unavailable", status: 503 })),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessionUnavailable).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("rejects invalid credentials without persisting tokens", async () => {
    bffRestoreSession.mockResolvedValue(null);
    bffLogin.mockRejectedValue(
      serializeBffAuthFailure(new BffAuthError("Email cyangwa ijambo ry'ibanga si byo.", { code: "unauthorized", status: 401 })),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login("wrong@example.rw", "bad");
      }),
    ).rejects.toThrow(/__BFF_AUTH__/);

    expect(result.current.isAuthenticated).toBe(false);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem("mm_session")).toBeNull();
  });

  it("logs in and logs out through the BFF", async () => {
    bffLogin.mockResolvedValue({
      user: activeUser,
      session: { idleExpiresAt: "2026-11-25T00:00:00.000Z", absoluteExpiresAt: "2026-12-01T00:00:00.000Z" },
    });
    bffGetCurrentUser.mockResolvedValue(activeUser);
    bffLogout.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login("test@example.rw", "Password2026!");
    });
    expect(bffLogin).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.signOut();
    });
    expect(bffLogout).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });
});