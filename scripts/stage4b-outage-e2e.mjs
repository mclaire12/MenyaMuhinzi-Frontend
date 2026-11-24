export default async (page) => {
  const base = "http://localhost:3000";
  await page.goto(`${base}/auth`, { waitUntil: "networkidle" });
  await page.locator("#email").fill("jeanne@example.rw");
  await page.locator("#password").fill("Umuhinzi2026");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  const cookieBefore = await page.context().cookies(base);
  const hadCookie = cookieBefore.some((c) => c.name === "mm_session");

  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });

  return {
    id: "G-outage-prep",
    pass: hadCookie,
    note: "Backend should be stopped externally before a manual rerun with step=g-only",
    cookieBefore: hadCookie,
  };
};