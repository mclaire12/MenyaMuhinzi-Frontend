import { z } from "zod";

/**
 * Server-only configuration for the Vercel BFF layer (Stage 3B.4+).
 * Import only from server functions or other server-only modules — never from client components.
 */
const serverRuntimeSchema = z.object({
  /** NestJS `/api/v1` root for server-side upstream calls. */
  apiBaseUrl: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.replace(/\/+$/, "")),
  bffSharedSecret: z.string().min(32),
  siteOrigin: z
    .string()
    .trim()
    .url()
    .transform((value) => value.replace(/\/+$/, "")),
  webSessionCookieName: z.string().trim().min(1),
});

export type ServerRuntimeEnv = z.infer<typeof serverRuntimeSchema>;

const DEFAULT_WEB_SESSION_COOKIE_NAME = "mm_session";

let cached: ServerRuntimeEnv | undefined;

export function getServerRuntimeEnv(): ServerRuntimeEnv {
  if (cached) return cached;

  const parsed = serverRuntimeSchema.safeParse({
    apiBaseUrl: process.env["API_BASE_URL"],
    bffSharedSecret: process.env["MENYA_BFF_SHARED_SECRET"],
    siteOrigin: process.env["SITE_ORIGIN"],
    webSessionCookieName: process.env["WEB_SESSION_COOKIE_NAME"] ?? DEFAULT_WEB_SESSION_COOKIE_NAME,
  });

  if (!parsed.success) {
    throw new Error(
      `Server runtime configuration is invalid or incomplete: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** @internal Test helper */
export function resetServerRuntimeEnvCache(): void {
  cached = undefined;
}