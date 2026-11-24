export default async (page) => {
  const base = "http://localhost:3000";
  await page.goto(`${base}/auth`, { waitUntil: "networkidle" });
  await page.locator("#email").fill("jeanne@example.rw");
  await page.locator("#password").fill("Umuhinzi2026");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  const cookies = await page.context().cookies(base);
  const session = cookies.find((c) => c.name === "mm_session");
  return { ok: true, cookie: session ? { httpOnly: session.httpOnly, secure: session.secure, len: session.value?.length } : null };
};