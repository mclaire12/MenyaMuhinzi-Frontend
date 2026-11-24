import type { ParsedBffError } from "@/lib/auth/parse-bff-error";

export function googleErrorToast(error: ParsedBffError): string {
  if (error.code === "unavailable" || error.code === "network" || error.code === "timeout") {
    return "Google sign-in ntiboneka ubu. Ongera ugerageze cyangwa ukoreshe email.";
  }
  if (error.status === 403) return error.message;
  if (error.status === 409) return error.message;
  if (error.status === 401) return error.message;
  return error.message || "Google sign-in ntiyashoboye.";
}