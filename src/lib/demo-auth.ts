/**
 * Legacy local-demo identities. The public login page no longer shows or accepts demo
 * credentials; real users sign in through the BFF. Only ids/roles remain so that an old
 * browser session stored under USER_KEY can still be recognised (and cleared) by the mock
 * learning store. No emails or passwords are kept here.
 */
export const demoAccounts = [
  { id: "demo-farmer", role: "farmer" as const, label: "Umuhinzi", name: "Mukamana Aline" },
  { id: "demo-facilitator", role: "facilitator" as const, label: "Umufashamyumvire", name: "Habimana Jean" },
  { id: "demo-admin", role: "admin" as const, label: "Umuyobozi", name: "Uwase Diane" },
  { id: "demo-basic-phone", role: "basic_phone_farmer" as const, label: "Umuhinzi (telefoni isanzwe)", name: "Mukeshimana Vestine" },
];

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

export function signOutDemo() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("mm-demo-auth"));
}
