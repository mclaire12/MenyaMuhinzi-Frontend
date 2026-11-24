import { describe, expect, it, vi, beforeEach } from "vitest";
import { bffChangePassword } from "@/lib/auth/auth-server-fns";
import { bffForgotPassword, bffResetPassword } from "@/lib/auth/password-server-fns";
import { changePassword, requestPasswordReset, resetPassword } from "./password-service";

vi.mock("@/lib/auth/auth-server-fns", () => ({
  bffChangePassword: vi.fn(),
}));

vi.mock("@/lib/auth/password-server-fns", () => ({
  bffForgotPassword: vi.fn(),
  bffResetPassword: vi.fn(),
}));

const changeMock = vi.mocked(bffChangePassword);
const forgotMock = vi.mocked(bffForgotPassword);
const resetMock = vi.mocked(bffResetPassword);

describe("password service", () => {
  beforeEach(() => {
    changeMock.mockReset();
    forgotMock.mockReset();
    resetMock.mockReset();
  });

  it("calls BFF forgot password without exposing tokens in the service layer", async () => {
    forgotMock.mockResolvedValueOnce({
      message: "If an active account matches, password reset instructions have been sent.",
    });
    const result = await requestPasswordReset("0788123456");
    expect(forgotMock).toHaveBeenCalledWith({ data: { identifier: "0788123456" } });
    expect(result).not.toHaveProperty("resetToken");
  });

  it("calls BFF reset password with token and new password", async () => {
    resetMock.mockResolvedValueOnce({ ok: true });
    await resetPassword({ token: "opaque", newPassword: "Ibihingwa2027" });
    expect(resetMock).toHaveBeenCalledWith({
      data: { token: "opaque", newPassword: "Ibihingwa2027" },
    });
  });

  it("calls BFF change password with current and new password", async () => {
    changeMock.mockResolvedValueOnce({ ok: true });
    await changePassword({ currentPassword: "OldPass1", newPassword: "Ibihingwa2027" });
    expect(changeMock).toHaveBeenCalledWith({
      data: { currentPassword: "OldPass1", newPassword: "Ibihingwa2027" },
    });
  });
});