import type { BffLoginResult } from "@/lib/auth/bff-types";
import {
  bffGoogleOAuthComplete,
  bffGoogleOAuthStart,
  bffGoogleOAuthStatus,
} from "@/lib/auth/google-server-fns";

export type GoogleOAuthStartInput = {
  mode: "login" | "register";
  accountType?: "SMARTPHONE_FARMER" | "FACILITATOR";
  phoneNumber?: string;
  fullName?: string;
  preferredLanguage?: "rw" | "en" | "fr";
};

export async function getGoogleSignInStatus(): Promise<{ enabled: boolean; clientId?: string }> {
  return bffGoogleOAuthStatus();
}

export async function beginGoogleSignIn(input: GoogleOAuthStartInput): Promise<{ authorizationUrl: string }> {
  return bffGoogleOAuthStart({ data: input });
}

export async function completeGoogleSignIn(input: {
  code: string;
  state: string;
  callbackUrl: string;
}): Promise<BffLoginResult> {
  return bffGoogleOAuthComplete({ data: input });
}