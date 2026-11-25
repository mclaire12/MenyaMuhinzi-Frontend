import { z } from "zod";
import { FACILITATOR_TITLE_OPTIONS } from "@/components/auth/facilitator-titles";
import type { FarmerCategory, Language, Province } from "./types";

/** Accounts an administrator adds from Users → Add user. Basic-phone farmers have their own form. */
export const ADD_USER_ROLES = ["SMARTPHONE_FARMER", "FACILITATOR", "ADMIN"] as const;
export type AddUserRole = (typeof ADD_USER_ROLES)[number];

const provinces = [
  "KIGALI_CITY",
  "NORTHERN",
  "SOUTHERN",
  "EASTERN",
  "WESTERN",
] as const satisfies readonly Province[];
const categories = [
  "SMALLHOLDER",
  "MEDIUM_SCALE",
  "COMMERCIAL",
  "COOPERATIVE_MEMBER",
  "LEAD_FARMER",
] as const satisfies readonly FarmerCategory[];
const titles = FACILITATOR_TITLE_OPTIONS.map((option) => option.value) as [string, ...string[]];

const text = (label: string, max = 80) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);
const optionalText = (max = 80) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const account = {
  fullName: text("Full name", 150),
  phoneNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(
      z
        .string()
        .regex(
          /^(?:\+?250|0)7[2389]\d{7}$/,
          "Enter a valid Rwandan mobile number, e.g. 0788123456.",
        ),
    ),
  email: z.string().trim().toLowerCase().email("Enter a valid personal email address.").max(254),
  preferredLanguage: z.enum(["rw", "en"]),
  password: z
    .string()
    .max(128)
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine(
      (value) =>
        value === undefined || (value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value)),
      {
        message: "Initial password needs at least 8 characters with a letter and a digit.",
      },
    ),
};

export const addUserSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("SMARTPHONE_FARMER"),
    ...account,
    farmerCategory: z.enum(categories),
    location: z.object({
      province: z.enum(provinces),
      district: text("District", 50),
      sector: text("Sector"),
      cell: text("Cell"),
      village: text("Village"),
    }),
  }),
  z.object({
    role: z.literal("FACILITATOR"),
    ...account,
    professionalTitle: z.enum(titles, { message: "Choose a professional title." }),
    organization: text("Organisation", 150),
    location: z.object({
      province: z.enum(provinces),
      district: text("District", 50),
      sector: optionalText(),
      cell: optionalText(),
      village: optionalText(),
    }),
  }),
  z.object({ role: z.literal("ADMIN"), ...account }),
]);

export type AddUserInput = z.infer<typeof addUserSchema>;

export interface AddUserResult {
  userId: string;
  fullName: string;
  email: string | null;
  role: AddUserRole;
  /** True only when the SMTP server accepted the verification email. */
  emailSent: boolean;
}

type AccountBody = {
  fullName: string;
  phoneNumber: string;
  email: string;
  preferredLanguage: Language;
  password?: string;
};

export type CreateStaffUserBody = AccountBody & { roles: ["ADMIN"] };
export type CreateFacilitatorBody = AccountBody & {
  professionalTitle: string;
  organization: string;
  location: {
    province: Province;
    district: string;
    sector?: string;
    cell?: string;
    village?: string;
  };
};
export type CreateSmartphoneFarmerBody = AccountBody & {
  farmerType: "SMARTPHONE";
  farmerCategory: FarmerCategory;
  location: { province: Province; district: string; sector: string; cell: string; village: string };
};

/** Shape returned by POST /users, /facilitators and /farmers that the BFF reads. */
export interface CreatedAccountResponse {
  id?: string;
  userId?: string;
  fullName: string;
  email: string | null;
  emailSent?: boolean;
}
