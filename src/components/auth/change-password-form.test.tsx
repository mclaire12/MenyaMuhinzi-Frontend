import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BFF_AUTH_ERROR_PREFIX } from "@/lib/auth/parse-bff-error";
import { ChangePasswordForm } from "./change-password-form";

const { changePasswordMock } = vi.hoisted(() => ({ changePasswordMock: vi.fn() }));

vi.mock("@/lib/api/password-service", () => ({
  changePassword: changePasswordMock,
}));

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    changePasswordMock.mockReset();
  });

  it("submits a valid password change", async () => {
    changePasswordMock.mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    render(<ChangePasswordForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga rya none"), {
      target: { value: "OldPass2026" },
    });
    fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga rishya"), {
      target: { value: "Ibihingwa2027" },
    });
    fireEvent.change(screen.getByLabelText("Emeza ijambo ry'ibanga"), {
      target: { value: "Ibihingwa2027" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hindura ijambo ry'ibanga" }));

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith({
        currentPassword: "OldPass2026",
        newPassword: "Ibihingwa2027",
      });
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("shows a validation toast when confirmation does not match", async () => {
    const onSuccess = vi.fn();
    render(<ChangePasswordForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga rya none"), {
      target: { value: "OldPass2026" },
    });
    fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga rishya"), {
      target: { value: "Ibihingwa2027" },
    });
    fireEvent.change(screen.getByLabelText("Emeza ijambo ry'ibanga"), {
      target: { value: "Other2028" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hindura ijambo ry'ibanga" }));

    expect(changePasswordMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("surfaces BFF errors without calling onSuccess", async () => {
    const payload = JSON.stringify({
      code: "validation",
      message: "Ijambo ry'ibanga rya none si ryo.",
      status: 400,
    });
    changePasswordMock.mockRejectedValue(new Error(`${BFF_AUTH_ERROR_PREFIX}${payload}`));
    const onSuccess = vi.fn();
    render(<ChangePasswordForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga rya none"), {
      target: { value: "WrongPass1" },
    });
    fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga rishya"), {
      target: { value: "Ibihingwa2027" },
    });
    fireEvent.change(screen.getByLabelText("Emeza ijambo ry'ibanga"), {
      target: { value: "Ibihingwa2027" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hindura ijambo ry'ibanga" }));

    await waitFor(() => expect(changePasswordMock).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});