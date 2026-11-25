export const demoAccounts = [
  { id: "demo-farmer", role: "farmer" as const, label: "Umuhinzi", email: "farmer@menyamuhinzi.rw", password: "Muhinzi2026", name: "Mukamana Aline", note: "Kwiga amasomo" },
  { id: "demo-facilitator", role: "facilitator" as const, label: "Umufashamyumvire", email: "facilitator@menyamuhinzi.rw", password: "Muhinzi2026", name: "Habimana Jean", note: "Gucunga amasomo" },
  {
    id: "demo-admin",
    role: "admin" as const,
    label: "Umuyobozi",
    email: "admin@menyamuhinzi.rw",
    password: "",
    name: "Uwase Diane",
    note: "Ijambo ry'ibanga: SEED_ADMIN_PASSWORD",
  },
  { id: "demo-basic-phone", role: "basic_phone_farmer" as const, label: "Umuhinzi (telefoni isanzwe)", email: "basicphone@menyamuhinzi.rw", password: "Muhinzi2026", name: "Mukeshimana Vestine", note: "Igerageza USSD/IVR" },
];

/** The basic-phone farmer never uses a web portal; this login only opens the testing phone. */
export const basicPhoneTester = { accountId: "demo-basic-phone", phone: "0788555100" };

export const homeFor = (role: DemoRole | undefined) => (role === "basic_phone_farmer" ? "/phone" : "/dashboard");

export type DemoRole = (typeof demoAccounts)[number]["role"];
export type DemoSession = { id: string; email: string; role: DemoRole; name: string; label: string };

const USER_KEY = "mm-demo-user";

export function isDemoUserId(id: string | undefined) {
  return !!id && demoAccounts.some((account) => account.id === id);
}

export function readDemoUser(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_KEY) ?? "") as DemoSession;
    return demoAccounts.some((account) => account.id === parsed.id && account.role === parsed.role) ? parsed : null;
  } catch {
    return null;
  }
}

export function signInDemo(email: string, password: string) {
  const account = demoAccounts.find((item) => item.email === email.trim().toLowerCase() && item.password === password);
  if (!account) return null;
  const session: DemoSession = { id: account.id, email: account.email, role: account.role, name: account.name, label: account.label };
  localStorage.setItem(USER_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("mm-demo-auth"));
  return session;
}

export function signOutDemo() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("mm-demo-auth"));
}
