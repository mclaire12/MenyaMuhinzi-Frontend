import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";

describe("account request detail routing", () => {
  it("matches /admin/users/requests/:requestId and preserves mock user detail", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const requestId = "11111111-1111-4111-8111-111111111111";
    const requestMatches = router.matchRoutes(`/admin/users/requests/${requestId}`);
    const userMatches = router.matchRoutes("/admin/users/u-demo-1");
    expect(requestMatches.at(-1)?.routeId).toContain("requests");
    expect(requestMatches.at(-1)?.routeId).toContain("requestId");
    expect(userMatches.at(-1)?.routeId).toContain("$userId");
    expect(userMatches.at(-1)?.routeId).not.toContain("requests");
  });
});
