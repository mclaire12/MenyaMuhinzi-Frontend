import { describe, expect, it } from "vitest";
import {
  registrationSchema,
  type RegistrationFormValues,
} from "@/components/auth/registration-schema";

const validFarmer: RegistrationFormValues = {
  accountType: "SMARTPHONE_FARMER",
  fullName: " Uwimana Jeanne ",
  phoneNumber: "0788 123 456",
  email: "JEANNE@example.rw",
  password: "Umuhinzi2026",
  preferredLanguage: "rw",
  province: "NORTHERN",
  district: "musanze",
  sector: "Muhoza",
  cell: "Ruhengeri",
  village: "Kigombe",
  farmerCategory: "SMALLHOLDER",
  professionalTitle: "",
  organization: "",
  contactEmail: "",
  contactPhone: "",
};

describe("registrationSchema", () => {
  it("normalizes farmer inputs and emits only the farmer registration fields", () => {
    const result = registrationSchema.safeParse(validFarmer);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      accountType: "SMARTPHONE_FARMER",
      fullName: "Uwimana Jeanne",
      phoneNumber: "+250788123456",
      email: "jeanne@example.rw",
      password: "Umuhinzi2026",
      preferredLanguage: "rw",
      location: {
        province: "NORTHERN",
        district: "Musanze",
        sector: "Muhoza",
        cell: "Ruhengeri",
        village: "Kigombe",
      },
      farmerCategory: "SMALLHOLDER",
    });
  });

  it("requires facilitator details and excludes farmer-only fields", () => {
    const result = registrationSchema.safeParse({
      ...validFarmer,
      accountType: "FACILITATOR",
      sector: "",
      cell: "",
      village: "",
      professionalTitle: "Agronomist",
      organization: "Rwanda Agriculture Board",
      contactPhone: "0788 654 321",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      accountType: "FACILITATOR",
      location: { province: "NORTHERN", district: "Musanze" },
      facilitator: {
        professionalTitle: "Agronomist",
        organization: "Rwanda Agriculture Board",
        contactPhone: "+250788654321",
      },
    });
    expect(result.data).not.toHaveProperty("farmerCategory");
    expect(result.data).not.toHaveProperty("location.sector");
  });

  it("lets a farmer omit the farmer category", () => {
    const result = registrationSchema.safeParse({ ...validFarmer, farmerCategory: "" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("farmerCategory");
  });

  it("requires a valid personal email for every account type", () => {
    for (const accountType of ["SMARTPHONE_FARMER", "FACILITATOR"] as const) {
      const base = {
        ...validFarmer,
        accountType,
        professionalTitle: "Agronomist",
        organization: "Rwanda Agriculture Board",
      };
      expect(registrationSchema.safeParse({ ...base, email: "  " }).success).toBe(false);
      expect(registrationSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    }
  });

  it("requires cell and village for farmers but not for facilitators", () => {
    const missingCell = registrationSchema.safeParse({ ...validFarmer, cell: "" });
    expect(missingCell.success).toBe(false);
    if (!missingCell.success) {
      expect(missingCell.error.issues.map((issue) => issue.path.join("."))).toContain("cell");
    }
    expect(registrationSchema.safeParse({ ...validFarmer, village: "" }).success).toBe(false);
  });

  it("only accepts facilitator titles from the dropdown list", () => {
    const facilitator = {
      ...validFarmer,
      accountType: "FACILITATOR" as const,
      organization: "Rwanda Agriculture Board",
    };
    expect(registrationSchema.safeParse({ ...facilitator, professionalTitle: "" }).success).toBe(
      false,
    );
    expect(
      registrationSchema.safeParse({ ...facilitator, professionalTitle: "Wizard" }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...facilitator, professionalTitle: "Farmer Promoter" })
        .success,
    ).toBe(true);
  });

  it("requires a facilitator email and rejects a weak password or missing sector", () => {
    expect(
      registrationSchema.safeParse({ ...validFarmer, accountType: "FACILITATOR", email: "" })
        .success,
    ).toBe(false);
    expect(registrationSchema.safeParse({ ...validFarmer, password: "onlyletters" }).success).toBe(
      false,
    );
    expect(registrationSchema.safeParse({ ...validFarmer, sector: "" }).success).toBe(false);
    expect(
      registrationSchema.safeParse({ ...validFarmer, fullName: "", district: "", phoneNumber: "" })
        .success,
    ).toBe(false);
  });

  it("rejects weak passwords, invalid phone numbers, mismatched districts and unsupported roles", () => {
    expect(
      registrationSchema.safeParse({
        ...validFarmer,
        password: "onlyletters",
        phoneNumber: "123",
        district: "Rubavu",
      }).success,
    ).toBe(false);
    expect(registrationSchema.safeParse({ ...validFarmer, accountType: "ADMIN" }).success).toBe(
      false,
    );
  });
});
