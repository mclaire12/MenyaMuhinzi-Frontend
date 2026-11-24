import { describe, expect, it } from "vitest";
import {
  changePasswordFormSchema,
  changePasswordSubmitSchema,
  forgotPasswordSchema,
  normalizeForgotIdentifier,
  resetPasswordSchema,
} from "@/lib/auth/password-schema";

describe("password schema", () => {
  it("normalizes phone identifiers for forgot password", () => {
    expect(normalizeForgotIdentifier("0788123456")).toBe("+250788123456");
    expect(normalizeForgotIdentifier("Jeanne@Example.RW")).toBe("jeanne@example.rw");
  });

  it("rejects weak or mismatched reset passwords", () => {
    const weak = resetPasswordSchema.safeParse({
      token: "abc",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(weak.success).toBe(false);

    const mismatch = resetPasswordSchema.safeParse({
      token: "abc",
      newPassword: "Ibihingwa2027",
      confirmPassword: "Other2028",
    });
    expect(mismatch.success).toBe(false);

    const valid = resetPasswordSchema.safeParse({
      token: "abc",
      newPassword: "Ibihingwa2027",
      confirmPassword: "Ibihingwa2027",
    });
    expect(valid.success).toBe(true);
  });

  it("requires identifier for forgot password", () => {
    expect(forgotPasswordSchema.safeParse({ identifier: "" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ identifier: "0788123456" }).success).toBe(true);
  });

  it("rejects weak or mismatched change passwords", () => {
    const weak = changePasswordFormSchema.safeParse({
      currentPassword: "OldPass1",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(weak.success).toBe(false);

    const mismatch = changePasswordFormSchema.safeParse({
      currentPassword: "OldPass1",
      newPassword: "Ibihingwa2027",
      confirmPassword: "Other2028",
    });
    expect(mismatch.success).toBe(false);

    const valid = changePasswordFormSchema.safeParse({
      currentPassword: "OldPass1",
      newPassword: "Ibihingwa2027",
      confirmPassword: "Ibihingwa2027",
    });
    expect(valid.success).toBe(true);

    expect(
      changePasswordSubmitSchema.safeParse({
        currentPassword: "OldPass1",
        newPassword: "Ibihingwa2027",
      }).success,
    ).toBe(true);
  });
});