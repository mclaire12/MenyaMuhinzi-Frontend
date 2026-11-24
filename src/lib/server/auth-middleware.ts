import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { matchesConfiguredSiteOrigin } from "../site-origin";
import { getServerRuntimeEnv } from "./runtime-env";

export function isAllowedSiteOrigin(origin: string | undefined): boolean {
  try {
    return matchesConfiguredSiteOrigin(origin, getServerRuntimeEnv().siteOrigin);
  } catch {
    return !origin;
  }
}

/** Rejects cross-origin state-changing server-function calls even if CSRF headers are present. */
export const bffStateChangeOriginMiddleware = createMiddleware().server(async ({ next }) => {
  await assertBffStateChangeOrigin();
  return next();
});

export async function assertBffStateChangeOrigin(): Promise<void> {
  const origin = getRequestHeader("origin");
  if (isAllowedSiteOrigin(origin)) return;
  throw new Response("Forbidden", { status: 403 });
}