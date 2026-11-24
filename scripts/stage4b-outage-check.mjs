/** Run after logging in (session stage4b): backend must be down. */
export default async (page) => {
  const base = "http://localhost:3000";
  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const cookies = await page.context().cookies(base);
  const session = cookies.find((c) => c.name === "mm_session");
  const unavailable = await page
    .getByText(/Serivisi ntiboneka/i)
    .isVisible()
    .catch(() => false);
  const url = page.url();
  const onAuth = url.includes("/auth");
  return {
    id: "G-backend-outage",
    pass: unavailable && !onAuth && Boolean(session),
    unavailable,
    url,
    cookieRetained: Boolean(session),
    httpOnly: session?.httpOnly ?? null,
    secure: session?.secure ?? null,
  };
};