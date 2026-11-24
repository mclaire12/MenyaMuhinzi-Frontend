import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("login form markup", () => {
  it("uses POST so a native submit does not leak credentials in the query string", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "auth.tsx"), "utf8");
    expect(source).toMatch(/<form[^>]*method="post"[^>]*onSubmit=\{submit\}/);
  });
});