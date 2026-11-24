/** Safe browser-facing forgot-password response (reset tokens are stripped by the BFF). */
export interface ForgotPasswordResult {
  message: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}