import { getAdminState, updateAdmin } from "@/lib/admin/store";
import type { AccountStatus, AdminState, PortalUser } from "@/lib/admin/types";
import { saveFarmerSettings, settingsFor } from "@/lib/mock/services/farmer";
import { getLearningState, mutate, nowIso } from "@/lib/mock/store";
import type { CropSlug, Farmer, LearningState, Location } from "@/lib/mock/types";

export type PhoneLanguage = "rw" | "en";

export function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+250")) return `0${digits.slice(4)}`;
  if (digits.startsWith("250") && digits.length === 12) return `0${digits.slice(3)}`;
  return digits;
}

export const isRwandanMobile = (phone: string) => /^07[2389]\d{7}$/.test(phone);

const samePhone = (a: string, b: string) => normalizePhone(a) === normalizePhone(b);

export type BasicPhoneFarmer = { account: PortalUser; learner: Farmer | null };

/** A basic-phone farmer is one account (role, status, language) linked by phone to one shared learner profile. */
export function basicPhoneFarmers(admin: AdminState, learning: LearningState): BasicPhoneFarmer[] {
  return admin.users
    .filter((user) => user.role === "BASIC_PHONE_FARMER")
    .map((account) => ({ account, learner: learning.farmers.find((farmer) => samePhone(farmer.phone, account.phone)) ?? null }));
}

export function learnerForAccount(learning: LearningState, account: PortalUser) {
  return learning.farmers.find((farmer) => samePhone(farmer.phone, account.phone)) ?? null;
}

export type Caller = { accountId: string; learnerId: string; name: string; phone: string; language: PhoneLanguage; facilitatorId: string };

export type Identification =
  | { kind: "ok"; caller: Caller }
  | { kind: "missing" }
  | { kind: "unregistered"; phone: string }
  | { kind: "inactive"; phone: string; status: AccountStatus }
  | { kind: "duplicate"; phone: string }
  | { kind: "other_channel"; phone: string }
  | { kind: "no_profile"; phone: string };

export function identifyCaller(admin: AdminState, learning: LearningState, rawPhone: string | null): Identification {
  if (!rawPhone?.trim()) return { kind: "missing" };
  const phone = normalizePhone(rawPhone);
  const accounts = admin.users.filter((user) => samePhone(user.phone, phone) && user.role !== "ADMIN" && user.role !== "FACILITATOR");
  if (accounts.length === 0) return { kind: "unregistered", phone };
  if (accounts.length > 1) return { kind: "duplicate", phone };
  const account = accounts[0]!;
  if (account.role !== "BASIC_PHONE_FARMER") return { kind: "other_channel", phone };
  if (account.status !== "active") return { kind: "inactive", phone, status: account.status };
  const learners = learning.farmers.filter((farmer) => samePhone(farmer.phone, phone));
  if (learners.length > 1) return { kind: "duplicate", phone };
  const learner = learners[0];
  if (!learner) return { kind: "no_profile", phone };
  const saved = learning.settings.find((item) => item.learnerId === learner.id)?.language ?? account.language;
  return { kind: "ok", caller: { accountId: account.id, learnerId: learner.id, name: learner.name, phone, language: saved === "en" ? "en" : "rw", facilitatorId: learner.facilitatorId } };
}

export function rememberLanguage(caller: Caller, language: PhoneLanguage) {
  const settings = settingsFor(getLearningState(), caller.learnerId);
  saveFarmerSettings(caller.learnerId, { ...settings, language });
  updateAdmin(caller.phone, "language", caller.accountId, `USSD language set to ${language}`, (state) => ({
    ...state,
    users: state.users.map((user) => (user.id === caller.accountId ? { ...user, language } : user)),
  }));
}

export type BasicPhoneFarmerValues = Location & {
  name: string;
  phone: string;
  email: string;
  language: PhoneLanguage;
  status: AccountStatus;
  facilitatorId: string;
  cropInterest: CropSlug[];
};

function validate(values: BasicPhoneFarmerValues, ignoreAccountId: string | null) {
  if (values.name.trim().length < 3) return "Enter the farmer's full name.";
  const phone = normalizePhone(values.phone);
  if (!isRwandanMobile(phone)) return "Enter a valid Rwandan mobile number (07X XXX XXXX).";
  if (getAdminState().users.some((user) => user.id !== ignoreAccountId && samePhone(user.phone, phone))) return "This phone number is already registered.";
  if (!values.province || !values.district || !values.sector.trim() || !values.cell.trim() || !values.village.trim()) return "Province, district, sector, cell and village are required.";
  if (!values.facilitatorId) return "Choose the facilitator who will follow this farmer.";
  return null;
}

export function registerBasicPhoneFarmer(actor: string, values: BasicPhoneFarmerValues): { error: string } | { accountId: string } {
  const error = validate(values, null);
  if (error) return { error };
  const phone = normalizePhone(values.phone);
  const accountId = `u-${phone}`;
  const location = { province: values.province, district: values.district, sector: values.sector.trim(), cell: values.cell.trim(), village: values.village.trim() };
  updateAdmin(actor, "create-user", accountId, `Registered basic-phone farmer ${values.name.trim()}`, (state) => ({
    ...state,
    users: [{ id: accountId, name: values.name.trim(), phone, email: values.email.trim(), district: values.district, language: values.language, channel: "basic_phone", role: "BASIC_PHONE_FARMER", status: values.status, registeredAt: nowIso(), lastActiveAt: nowIso(), qualification: "", verified: false, groupId: "", enrollments: [], notes: [] }, ...state.users],
  }));
  mutate((state) => {
    const existing = state.farmers.find((farmer) => samePhone(farmer.phone, phone));
    const farmers = existing
      ? state.farmers.map((farmer) => (farmer === existing ? { ...farmer, ...location, name: values.name.trim(), channel: "basic_phone" as const, facilitatorId: values.facilitatorId, cropInterest: values.cropInterest } : farmer))
      : [...state.farmers, { id: accountId, name: values.name.trim(), phone, channel: "basic_phone" as const, facilitatorId: values.facilitatorId, cropInterest: values.cropInterest, joinedAt: nowIso(), ...location }];
    const learnerId = existing?.id ?? accountId;
    const settings = state.settings.some((item) => item.learnerId === learnerId)
      ? state.settings.map((item) => (item.learnerId === learnerId ? { ...item, language: values.language } : item))
      : [...state.settings, { learnerId, language: values.language, notifyNew: true, notifyAssigned: true, notifyReminder: true, notifyResults: true }];
    return { ...state, farmers, settings };
  });
  return { accountId };
}

const PROVINCE_LABELS: Record<string, string> = {
  KIGALI_CITY: "Kigali City",
  NORTHERN: "Northern Province",
  SOUTHERN: "Southern Province",
  EASTERN: "Eastern Province",
  WESTERN: "Western Province",
};

/**
 * The phone simulator reads the local testing store. A basic-phone farmer who signed in with a
 * real backend account gets a matching local testing profile (same phone, name, email and
 * address) so the USSD/IVR learning flow can be exercised. Returns the normalised phone.
 */
export function ensureBasicPhoneTestingProfile(user: {
  fullName: string;
  phoneNumber: string;
  email: string | null;
  preferredLanguage: string;
  location: { province: string; district: string; sector: string | null; cell: string | null; village: string | null } | null;
}): string {
  const phone = normalizePhone(user.phoneNumber);
  if (getAdminState().users.some((account) => samePhone(account.phone, phone))) return phone;
  const facilitatorId = getLearningState().facilitators[0]?.id ?? "fac1";
  registerBasicPhoneFarmer("self", {
    name: user.fullName,
    phone,
    email: user.email ?? "",
    language: user.preferredLanguage === "en" ? "en" : "rw",
    status: "active",
    facilitatorId,
    cropInterest: ["tomato"],
    province: PROVINCE_LABELS[user.location?.province ?? ""] ?? "Kigali City",
    district: user.location?.district ?? "Gasabo",
    sector: user.location?.sector || "—",
    cell: user.location?.cell || "—",
    village: user.location?.village || "—",
  });
  return phone;
}

export function updateBasicPhoneFarmer(actor: string, accountId: string, values: BasicPhoneFarmerValues) {
  const error = validate(values, accountId);
  if (error) return error;
  const account = getAdminState().users.find((user) => user.id === accountId);
  if (!account) return "Farmer account not found.";
  const phone = normalizePhone(values.phone);
  const learner = learnerForAccount(getLearningState(), account);
  updateAdmin(actor, "update-user", accountId, `Updated basic-phone farmer ${values.name.trim()}`, (state) => ({
    ...state,
    users: state.users.map((user) => (user.id === accountId ? { ...user, name: values.name.trim(), phone, district: values.district, language: values.language, status: values.status } : user)),
  }));
  mutate((state) => ({
    ...state,
    farmers: learner
      ? state.farmers.map((farmer) => (farmer.id === learner.id ? { ...farmer, name: values.name.trim(), phone, province: values.province, district: values.district, sector: values.sector.trim(), cell: values.cell.trim(), village: values.village.trim(), facilitatorId: values.facilitatorId, cropInterest: values.cropInterest } : farmer))
      : [...state.farmers, { id: accountId, name: values.name.trim(), phone, channel: "basic_phone" as const, facilitatorId: values.facilitatorId, cropInterest: values.cropInterest, joinedAt: nowIso(), province: values.province, district: values.district, sector: values.sector.trim(), cell: values.cell.trim(), village: values.village.trim() }],
    settings: learner ? state.settings.map((item) => (item.learnerId === learner.id ? { ...item, language: values.language } : item)) : state.settings,
  }));
  return null;
}
