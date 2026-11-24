import { describe, expect, it } from "vitest";
import { validateRejectReason } from "@/lib/admin/account-request-decisions";

/** Mirrors scripts/stage5f-approval-e2e.mjs — regression for invalid test phone generation. */
function stage5fTestPhone(counter: number): string {
  const digits = String(((Date.now() + counter) % 900000) + 100000).slice(-6);
  return `0788${digits}`;
}

describe("Stage 5F verification helpers", () => {
  it("generates Rwandan mobile numbers suitable for registration", () => {
    for (let i = 0; i < 5; i++) {
      expect(stage5fTestPhone(i)).toMatch(/^078[2389]\d{6}$/);
    }
  });

  it("blocks empty and short reject reasons before API submission", () => {
    expect(validateRejectReason("")).not.toBeNull();
    expect(validateRejectReason("   ")).not.toBeNull();
    expect(validateRejectReason("1234")).not.toBeNull();
    expect(validateRejectReason("Valid rejection reason here.")).toBeNull();
  });
});