import { z } from "zod";
import { normalizeRwandanPhone } from "@/components/auth/registration-schema";

const passwordField = z
  .string()
  .min(8, "Ijambo ry'ibanga rigomba kugira nibura inyuguti 8.")
  .max(128, "Ijambo ry'ibanga ntirishobora kurenza inyuguti 128.")
  .regex(/[A-Za-z]/, "Ijambo ry'ibanga rigomba kugira inyuguti nibura imwe.")
  .regex(/\d/, "Ijambo ry'ibanga rigomba kugira umubare nibura umwe.");

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, "Andika email cyangwa telefoni.").max(254),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "Token yo gusubiza ijambo ry'ibanga irabura."),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, "Emeza ijambo ry'ibanga."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Ijambo ry'ibanga n'iyemeza ntibihura.",
    path: ["confirmPassword"],
  });

/** Payload sent to the BFF (confirm field is validated client-side only). */
export const changePasswordSubmitSchema = z.object({
  currentPassword: z.string().min(1, "Andika ijambo ry'ibanga rya none."),
  newPassword: passwordField,
});

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Andika ijambo ry'ibanga rya none."),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, "Emeza ijambo ry'ibanga."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Ijambo ry'ibanga n'iyemeza ntibihura.",
    path: ["confirmPassword"],
  });

export const CHANGE_PASSWORD_SUCCESS_MESSAGE =
  "Ijambo ry'ibanga ryahinduwe. Injira ukoresheje ijambo rishya.";

export function normalizeForgotIdentifier(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  if (/^[\d\s+()-]+$/.test(trimmed)) {
    try {
      return normalizeRwandanPhone(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export const FORGOT_PASSWORD_CONFIRMATION =
  "Niba konti ifite akazi, ubutumwa bwo gusubiza ijambo ry'ibanga bwoherejwe.";