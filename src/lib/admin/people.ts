import { getAdminState, updateAdmin } from "@/lib/admin/store";
import type { AccountStatus, PlatformLanguage, PortalRole, PortalUser } from "@/lib/admin/types";
import { isRwandanMobile, learnerForAccount, normalizePhone, registerBasicPhoneFarmer, updateBasicPhoneFarmer } from "@/lib/basic-phone/farmers";
import { getLearningState, mutate, nowIso } from "@/lib/mock/store";
import type { CropSlug, Facilitator, LearningState, Location } from "@/lib/mock/types";

export const roleLabels: Record<PortalRole, string> = {
  ADMIN: "Administrator",
  FACILITATOR: "Facilitator",
  SMARTPHONE_FARMER: "Smartphone farmer",
  BASIC_PHONE_FARMER: "Basic-phone farmer",
};

export const accountStatusLabels: Record<AccountStatus, string> = {
  active: "Active",
  pending: "Pending",
  suspended: "Suspended",
  deactivated: "Inactive",
  rejected: "Rejected",
};

export const isFarmerRole = (role: PortalRole) => role === "SMARTPHONE_FARMER" || role === "BASIC_PHONE_FARMER";

export type UserValues = Location & {
  role: PortalRole;
  name: string;
  phone: string;
  email: string;
  language: PlatformLanguage;
  status: AccountStatus;
  facilitatorId: string;
  cropInterest: CropSlug[];
  qualification: string;
};

export const emptyUser = (role: PortalRole = "SMARTPHONE_FARMER", language: PlatformLanguage = "rw"): UserValues => ({
  role, name: "", phone: "", email: "", language, status: "active", facilitatorId: "fac1", cropInterest: ["tomato"], qualification: "",
  province: "Northern Province", district: "Musanze", sector: "", cell: "", village: "",
});

export function locationOf(learning: LearningState, user: PortalUser): Location {
  const learner = isFarmerRole(user.role) ? learnerForAccount(learning, user) : null;
  if (learner) return { province: learner.province, district: learner.district, sector: learner.sector, cell: learner.cell, village: learner.village };
  return user.location ?? { province: "", district: user.district, sector: "", cell: "", village: "" };
}

export function valuesFor(learning: LearningState, user: PortalUser): UserValues {
  const learner = isFarmerRole(user.role) ? learnerForAccount(learning, user) : null;
  return {
    ...locationOf(learning, user),
    role: user.role, name: user.name, phone: user.phone, email: user.email, language: user.language, status: user.status,
    facilitatorId: learner?.facilitatorId ?? "fac1", cropInterest: learner?.cropInterest ?? ["tomato"], qualification: user.qualification,
  };
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUser(values: UserValues, ignoreId: string | null): string | null {
  if (values.name.trim().length < 3) return "Enter the full name (at least 3 characters).";
  const phone = normalizePhone(values.phone);
  if (!isRwandanMobile(phone)) return "Enter a valid Rwandan mobile number (07X XXX XXXX).";
  if (getAdminState().users.some((user) => user.id !== ignoreId && normalizePhone(user.phone) === phone)) return "This phone number is already registered.";
  const email = values.email.trim();
  const staff = values.role === "ADMIN" || values.role === "FACILITATOR";
  if (staff && !email) return "Administrators and facilitators sign in on the web, so an email is required.";
  if (email && !emailPattern.test(email)) return "Enter a valid email address.";
  if (email && getAdminState().users.some((user) => user.id !== ignoreId && user.email.toLowerCase() === email.toLowerCase())) return "This email is already used by another account.";
  if (!values.province || !values.district) return "Choose the province and district.";
  if (isFarmerRole(values.role) && (!values.sector.trim() || !values.cell.trim() || !values.village.trim())) return "Sector, cell and village are required for farmers.";
  if (isFarmerRole(values.role) && !values.cropInterest.length) return "Choose at least one crop of interest.";
  return null;
}

const locationFrom = (values: UserValues): Location => ({ province: values.province, district: values.district, sector: values.sector.trim(), cell: values.cell.trim(), village: values.village.trim() });

function facilitatorProfile(id: string, values: UserValues): Facilitator {
  return {
    id, accountId: id, name: values.name.trim(), email: values.email.trim(), phone: normalizePhone(values.phone), title: "Agricultural facilitator", organisation: "MenyaMuhinzi",
    qualification: values.qualification.trim(), yearsOfExperience: 0, district: values.district, specialties: ["tomato", "cabbage", "carrot"], language: values.language,
    notifications: { reviewDecisions: true, farmerQuestions: true, weeklySummary: true, smsAlerts: false }, responsibilities: [],
  };
}

/** Creates the learner profile a farmer account needs, matched by phone so no second record is made. */
function ensureLearner(accountId: string, values: UserValues) {
  const phone = normalizePhone(values.phone);
  const channel = values.role === "BASIC_PHONE_FARMER" ? "basic_phone" as const : "smartphone" as const;
  mutate((state) => {
    const existing = state.farmers.find((farmer) => normalizePhone(farmer.phone) === phone);
    const patch = { ...locationFrom(values), name: values.name.trim(), phone, channel, facilitatorId: values.facilitatorId, cropInterest: values.cropInterest };
    return { ...state, farmers: existing ? state.farmers.map((farmer) => (farmer === existing ? { ...farmer, ...patch } : farmer)) : [...state.farmers, { id: accountId, joinedAt: nowIso(), ...patch }] };
  });
}

export function registerUser(actor: string, values: UserValues): { error: string } | { accountId: string } {
  const error = validateUser(values, null);
  if (error) return { error };
  const phone = normalizePhone(values.phone);
  if (values.role === "BASIC_PHONE_FARMER") {
    return registerBasicPhoneFarmer(actor, { ...locationFrom(values), name: values.name, phone, email: values.email, language: values.language === "en" ? "en" : "rw", status: values.status, facilitatorId: values.facilitatorId, cropInterest: values.cropInterest });
  }
  const accountId = `u-${phone}`;
  const at = nowIso();
  const user: PortalUser = {
    id: accountId, name: values.name.trim(), phone, email: values.email.trim(), district: values.district, language: values.language, channel: "smartphone", role: values.role,
    status: values.status, registeredAt: at, lastActiveAt: at, qualification: values.qualification.trim(), verified: values.role !== "FACILITATOR", groupId: "", enrollments: [], notes: [],
    location: locationFrom(values), ...(values.status === "active" ? { approvedAt: at, reviewedBy: actor } : {}),
  };
  updateAdmin(actor, "create-user", accountId, `Registered ${roleLabels[values.role].toLowerCase()} ${user.name}`, (state) => ({ ...state, users: [user, ...state.users] }));
  if (values.role === "SMARTPHONE_FARMER") ensureLearner(accountId, values);
  if (values.role === "FACILITATOR") mutate((state) => ({ ...state, facilitators: state.facilitators.some((item) => item.id === accountId) ? state.facilitators : [...state.facilitators, facilitatorProfile(accountId, values)] }));
  return { accountId };
}

/** Farmers can switch between smartphone and basic phone; staff between facilitator and administrator. */
export function allowedRoles(role: PortalRole): PortalRole[] {
  return isFarmerRole(role) ? ["SMARTPHONE_FARMER", "BASIC_PHONE_FARMER"] : ["FACILITATOR", "ADMIN"];
}

export function updateUser(actor: string, accountId: string, values: UserValues): string | null {
  const user = getAdminState().users.find((item) => item.id === accountId);
  if (!user) return "User not found.";
  if (!allowedRoles(user.role).includes(values.role)) return "Farmer and staff accounts cannot be converted into each other. Register a separate account instead.";
  const error = validateUser(values, accountId);
  if (error) return error;
  const phone = normalizePhone(values.phone);
  if (user.role === "BASIC_PHONE_FARMER" && values.role === "BASIC_PHONE_FARMER") {
    return updateBasicPhoneFarmer(actor, accountId, { ...locationFrom(values), name: values.name, phone, email: values.email, language: values.language === "en" ? "en" : "rw", status: values.status, facilitatorId: values.facilitatorId, cropInterest: values.cropInterest });
  }
  updateAdmin(actor, "update-user", accountId, `Updated ${values.name.trim()}${values.role !== user.role ? ` (role ${roleLabels[user.role]} → ${roleLabels[values.role]})` : ""}`, (state) => ({
    ...state,
    users: state.users.map((item) => (item.id === accountId ? {
      ...item, name: values.name.trim(), phone, email: values.role === "BASIC_PHONE_FARMER" ? "" : values.email.trim(), district: values.district, language: values.language, status: values.status, role: values.role,
      channel: values.role === "BASIC_PHONE_FARMER" ? "basic_phone" : "smartphone", qualification: values.qualification.trim(), location: locationFrom(values),
    } : item)),
  }));
  if (isFarmerRole(values.role)) ensureLearner(accountId, values);
  if (values.role === "FACILITATOR") {
    mutate((state) => ({ ...state, facilitators: state.facilitators.map((item) => (item.id === accountId || item.accountId === accountId ? { ...item, name: values.name.trim(), email: values.email.trim(), phone, district: values.district, qualification: values.qualification.trim() } : item)) }));
  }
  return null;
}

export function setUserStatus(actor: string, ids: string[], status: AccountStatus) {
  updateAdmin(actor, "set-status", ids.join(","), accountStatusLabels[status], (state) => ({ ...state, users: state.users.map((user) => (ids.includes(user.id) ? { ...user, status } : user)) }));
}

export function approveUser(actor: string, accountId: string): string | null {
  const user = getAdminState().users.find((item) => item.id === accountId);
  if (!user) return "User not found.";
  if (user.status !== "pending") return "Only pending accounts can be approved.";
  const at = nowIso();
  updateAdmin(actor, "approve-account", accountId, `Approved ${roleLabels[user.role].toLowerCase()} ${user.name}`, (state) => ({
    ...state,
    users: state.users.map((item) => (item.id === accountId ? { ...item, status: "active", verified: true, approvedAt: at, reviewedAt: at, reviewedBy: actor } : item)),
  }));
  const learning = getLearningState();
  if (isFarmerRole(user.role) && !learnerForAccount(learning, user)) {
    const location = user.location ?? { province: "", district: user.district, sector: "", cell: "", village: "" };
    ensureLearner(user.id, { ...emptyUser(user.role, user.language), ...location, name: user.name, phone: user.phone, email: user.email });
  }
  if (user.role === "FACILITATOR" && !learning.facilitators.some((item) => item.id === user.id || item.accountId === user.id)) {
    const location = user.location ?? { province: "", district: user.district, sector: "", cell: "", village: "" };
    mutate((state) => ({ ...state, facilitators: [...state.facilitators, facilitatorProfile(user.id, { ...emptyUser("FACILITATOR", user.language), ...location, name: user.name, phone: user.phone, email: user.email, qualification: user.qualification })] }));
  }
  return null;
}

export function rejectUser(actor: string, accountId: string, reason: string): string | null {
  const user = getAdminState().users.find((item) => item.id === accountId);
  if (!user) return "User not found.";
  if (user.status !== "pending") return "Only pending accounts can be rejected.";
  const at = nowIso();
  updateAdmin(actor, "reject-account", accountId, `Rejected ${user.name}${reason.trim() ? `: ${reason.trim()}` : ""}`, (state) => ({
    ...state,
    users: state.users.map((item) => (item.id === accountId ? { ...item, status: "rejected", reviewedAt: at, reviewedBy: actor, rejectionReason: reason.trim() } : item)),
  }));
  return null;
}

export type ApprovalState = "pending" | "approved" | "rejected";

export function approvalState(user: PortalUser): ApprovalState | null {
  if (user.status === "pending") return "pending";
  if (user.status === "rejected") return "rejected";
  return user.approvedAt ? "approved" : null;
}
