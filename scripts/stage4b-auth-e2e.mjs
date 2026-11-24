export default async (page) => {
  const base = "http://localhost:3000";
  const outcomes = [];
  const fnResponses = [];

  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("/_serverFn/")) return;
    const body = await res.text().catch(() => "");
    fnResponses.push({
      export: decodeURIComponent(url.split("/_serverFn/")[1] ?? ""),
      status: res.status(),
      hasError: body.includes("BFF_AUTH") || body.includes("$TSR/Error") || body.includes('"s":1'),
      body: body.slice(0, 220),
    });
  });

  const storageKeys = async () =>
    page.evaluate(() => ({
      localKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
      demoUser: localStorage.getItem("mm-demo-user"),
    }));

  const sessionCookie = async () => {
    const cookies = await page.context().cookies(base);
    const session = cookies.find((c) => c.name === "mm_session");
    if (!session) return { present: false };
    return {
      present: true,
      httpOnly: session.httpOnly,
      secure: session.secure,
      sameSite: session.sameSite,
      valueLength: session.value?.length ?? 0,
      looksOpaque: typeof session.value === "string" && !session.value.includes(".") && session.value.length >= 16,
    };
  };

  const login = async (email, password) => {
    await page.goto(`${base}/auth`, { waitUntil: "networkidle" });
    await page.waitForSelector("#email");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    const fnBefore = fnResponses.length;
    await page.locator('form button[type="submit"]').click();
    await page.waitForTimeout(4000);
    return fnResponses.slice(fnBefore);
  };

  const pendingFns = await login("stage2-farmer-370237@example.rw", "Umuhinzi2026");
  outcomes.push({
    id: "A-pending",
    pass:
      page.url().split("?")[0] === `${base}/auth` &&
      !(await sessionCookie()).present &&
      !page.url().includes("password="),
    url: page.url(),
    pendingToast: await page.getByText(/tegereje kwemezwa/i).isVisible().catch(() => false),
    serverFns: pendingFns,
  });

  await login("missing-user@example.rw", "WrongPassword9!");
  outcomes.push({
    id: "B-invalid",
    pass: page.url().split("?")[0] === `${base}/auth` && !(await sessionCookie()).present,
    toastWrong: await page.getByText(/ibanga si byo/i).isVisible().catch(() => false),
    url: page.url(),
  });

  const approvedFns = await login("jeanne@example.rw", "Umuhinzi2026");
  outcomes.push({
    id: "C-approved",
    pass: page.url().includes("/dashboard") && (await sessionCookie()).present,
    url: page.url(),
    cookie: await sessionCookie(),
    storage: await storageKeys(),
    serverFns: approvedFns,
  });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  outcomes.push({
    id: "D-refresh",
    pass: page.url().includes("/dashboard") && (await sessionCookie()).present,
    url: page.url(),
  });

  const logoutBtn = page.getByRole("button", { name: /Sohoka/i }).first();
  if (await logoutBtn.isVisible().catch(() => false)) await logoutBtn.click();
  await page.waitForTimeout(2000);
  outcomes.push({
    id: "E-logout",
    pass: page.url().includes("/auth") && !(await sessionCookie()).present,
    url: page.url(),
  });

  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  outcomes.push({
    id: "F-protected-after-logout",
    pass: page.url().includes("/auth"),
    url: page.url(),
  });

  return { outcomes, fnResponses: fnResponses.slice(-8) };
};