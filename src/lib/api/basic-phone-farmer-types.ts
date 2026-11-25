import { z } from "zod";
import type { FarmerCategory, Language, Province } from "./types";

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

const required = (label: string, max = 80) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

/**
 * Staff-entered details for a basic-phone farmer. Mirrors the backend
 * FarmerRegistrationFieldsDto: personal email and the full address are mandatory.
 */
export const basicPhoneFarmerInputSchema = z.object({
  fullName: required("Full name", 150),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^(?:\+?250|0)7[2389]\d{7}$/, "Enter a valid Rwandan mobile number, e.g. 0788123456."),
  email: z.string().trim().toLowerCase().email("Enter a valid personal email address.").max(254),
  preferredLanguage: z.enum(["rw", "en"]),
  farmerCategory: z.enum(categories).optional(),
  password: z
    .string()
    .min(8, "Initial password must have at least 8 characters.")
    .max(128)
    .regex(/[A-Za-z]/, "Initial password needs a letter.")
    .regex(/\d/, "Initial password needs a digit.")
    .optional(),
  notes: z.string().trim().max(1000).optional(),
  location: z.object({
    province: z.enum(provinces),
    district: required("District", 50),
    sector: required("Sector"),
    cell: required("Cell"),
    village: required("Village"),
  }),
});

export type BasicPhoneFarmerInput = z.infer<typeof basicPhoneFarmerInputSchema>;

/** Administrators create directly; facilitators submit for approval. */
export type BasicPhoneFarmerSubmission = "direct" | "request";

export interface CreateBasicPhoneFarmerBody {
  fullName: string;
  phoneNumber: string;
  email: string;
  preferredLanguage: Language;
  farmerType: "BASIC_PHONE";
  farmerCategory?: FarmerCategory;
  password?: string;
  location: { province: Province; district: string; sector: string; cell: string; village: string };
}

export interface CreatedFarmerResponse {
  userId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  status: string;
  farmerType: "BASIC_PHONE" | "SMARTPHONE";
  /** Present on create: whether the SMTP server accepted the verification email. */
  emailSent?: boolean;
}

export interface BasicPhoneFarmerCreated {
  mode: BasicPhoneFarmerSubmission;
  userId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  status: string;
  accountRequestId: string | null;
  /** Direct creation only: true when the verification email was accepted for delivery. */
  emailSent: boolean | null;
}
