import { z } from "zod";
import type { FarmerCategory, Province, RegistrationRequest } from "@/lib/api/types";

export const districtsByProvince: Record<Province, readonly string[]> = {
  KIGALI_CITY: ["Gasabo", "Kicukiro", "Nyarugenge"],
  NORTHERN: ["Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo"],
  SOUTHERN: [
    "Gisagara",
    "Huye",
    "Kamonyi",
    "Muhanga",
    "Nyamagabe",
    "Nyanza",
    "Nyaruguru",
    "Ruhango",
  ],
  EASTERN: ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"],
  WESTERN: ["Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro"],
};

const provinces = Object.keys(districtsByProvince) as Province[];
const farmerCategories: FarmerCategory[] = [
  "SMALLHOLDER",
  "MEDIUM_SCALE",
  "COMMERCIAL",
  "COOPERATIVE_MEMBER",
  "LEAD_FARMER",
];

export const registrationSchema = z
  .object({
    accountType: z.enum(["SMARTPHONE_FARMER", "FACILITATOR"]),
    fullName: z.string().trim().min(1, "Andika amazina yawe.").max(150),
    phoneNumber: z
      .string()
      .trim()
      .transform(normalizeRwandanPhone)
      .refine((value) => /^\+2507[2389]\d{7}$/.test(value), {
        message: "Andika nimero ya telefoni yo mu Rwanda yemewe, urugero: 0788123456.",
      }),
    email: z.string().trim().toLowerCase().max(254),
    password: z
      .string()
      .min(8, "Ijambo ry'ibanga rigomba kugira nibura inyuguti 8.")
      .max(128, "Ijambo ry'ibanga ntirishobora kurenza inyuguti 128.")
      .regex(/[A-Za-z]/, "Ijambo ry'ibanga rigomba kugira inyuguti nibura imwe.")
      .regex(/\d/, "Ijambo ry'ibanga rigomba kugira umubare nibura umwe."),
    preferredLanguage: z.enum(["rw", "en"]),
    province: z.enum(provinces as [Province, ...Province[]]),
    district: z.string().trim().min(1, "Hitamo akarere."),
    sector: z.string().trim(),
    farmerCategory: z.union([
      z.enum(farmerCategories as [FarmerCategory, ...FarmerCategory[]]),
      z.literal(""),
    ]),
    professionalTitle: z.string().trim(),
    organization: z.string().trim(),
    contactEmail: z.string().trim(),
    contactPhone: z.string().trim(),
  })
  .superRefine((values, context) => {
    const districts = districtsByProvince[values.province];
    if (!districts.some((district) => district.toLowerCase() === values.district.toLowerCase())) {
      context.addIssue({
        code: "custom",
        path: ["district"],
        message: "Hitamo akarere kari muri iyi ntara.",
      });
    }

    if (values.accountType === "SMARTPHONE_FARMER" && !values.sector) {
      context.addIssue({
        code: "custom",
        path: ["sector"],
        message: "Hitamo umurenge.",
      });
    } else if (values.sector.length > 80) {
      context.addIssue({
        code: "custom",
        path: ["sector"],
        message: "Umurenge ntugomba kurenza inyuguti 80.",
      });
    }

    if (values.accountType === "FACILITATOR" && !values.email) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Andika email yawe.",
      });
    } else if (values.email && !z.string().email().safeParse(values.email).success) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Andika email yemewe.",
      });
    }

    if (values.accountType === "FACILITATOR") {
      if (!values.professionalTitle) {
        context.addIssue({
          code: "custom",
          path: ["professionalTitle"],
          message: "Andika umwanya wawe w'akazi.",
        });
      } else if (values.professionalTitle.length > 150) {
        context.addIssue({
          code: "custom",
          path: ["professionalTitle"],
          message: "Umwanya w'akazi ntugomba kurenza inyuguti 150.",
        });
      }

      if (!values.organization) {
        context.addIssue({
          code: "custom",
          path: ["organization"],
          message: "Andika izina ry'umuryango cyangwa ikigo ukorera.",
        });
      } else if (values.organization.length > 200) {
        context.addIssue({
          code: "custom",
          path: ["organization"],
          message: "Izina ry'ikigo ntirigomba kurenza inyuguti 200.",
        });
      }

      if (values.contactEmail && !z.string().email().safeParse(values.contactEmail).success) {
        context.addIssue({
          code: "custom",
          path: ["contactEmail"],
          message: "Andika email y'akazi yemewe.",
        });
      }

      if (values.contactPhone && !isRwandanPhone(values.contactPhone)) {
        context.addIssue({
          code: "custom",
          path: ["contactPhone"],
          message: "Andika nimero y'akazi yo mu Rwanda yemewe.",
        });
      }
    }
  })
  .transform((values): RegistrationRequest => {
    const district =
      districtsByProvince[values.province].find(
        (name) => name.toLowerCase() === values.district.toLowerCase(),
      ) ?? values.district;
    const base = {
      fullName: values.fullName,
      phoneNumber: values.phoneNumber,
      password: values.password,
      preferredLanguage: values.preferredLanguage,
      ...(values.email ? { email: values.email } : {}),
    };

    if (values.accountType === "SMARTPHONE_FARMER") {
      return {
        ...base,
        accountType: "SMARTPHONE_FARMER",
        location: { province: values.province, district, sector: values.sector },
        ...(values.farmerCategory ? { farmerCategory: values.farmerCategory } : {}),
      };
    }

    return {
      ...base,
      accountType: "FACILITATOR",
      email: values.email,
      location: { province: values.province, district },
      facilitator: {
        professionalTitle: values.professionalTitle,
        organization: values.organization,
        ...(values.contactEmail ? { contactEmail: values.contactEmail.toLowerCase() } : {}),
        ...(values.contactPhone
          ? { contactPhone: normalizeRwandanPhone(values.contactPhone) }
          : {}),
      },
    };
  });

export type RegistrationFormValues = z.input<typeof registrationSchema>;

export function normalizeRwandanPhone(input: string): string {
  const compact = input.replace(/[\s\-().]/g, "");
  const match = /^(?:\+?250|0)?(7\d{8})$/.exec(compact);
  return match ? `+250${match[1]}` : input;
}

function isRwandanPhone(input: string): boolean {
  return /^\+2507[2389]\d{7}$/.test(normalizeRwandanPhone(input));
}
