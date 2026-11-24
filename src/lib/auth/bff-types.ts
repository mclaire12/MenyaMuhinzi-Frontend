import type { UserResponse } from "@/lib/api/types";

export interface WebSessionPublicMeta {
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export interface BffLoginResult {
  user: UserResponse;
  session: WebSessionPublicMeta;
}