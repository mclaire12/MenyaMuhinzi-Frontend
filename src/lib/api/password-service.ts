import type { ForgotPasswordResult, ResetPasswordInput } from "./password-types";
import { bffChangePassword } from "@/lib/auth/auth-server-fns";
import { bffForgotPassword, bffResetPassword } from "@/lib/auth/password-server-fns";

export type { ForgotPasswordResult, ResetPasswordInput } from "./password-types";

export async function requestPasswordReset(identifier: string): Promise<ForgotPasswordResult> {
  return bffForgotPassword({ data: { identifier } });
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  await bffResetPassword({ data: { token: input.token, newPassword: input.newPassword } });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await bffChangePassword({ data: input });
}