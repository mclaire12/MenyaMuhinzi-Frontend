import { describe, expect, it } from "vitest";
import { ApiError } from "./api-error";
import { api } from "./api-client";
import { registerAccount } from "./registration-service";
import type { RegistrationRequest } from "./types";

const live = process.env["MENYA_LIVE_API"] === "1";
const stamp = Date.now().toString().slice(-6);

function phone(prefix: "078" | "079", slot: number): string {
  return `${prefix}${stamp}${slot}`;
}

function farmer(slot: number, email?: string): RegistrationRequest {
  return {
    accountType: "SMARTPHONE_FARMER",
    fullName: "Stage Two Farmer",
    phoneNumber: phone("078", slot),
    password: "Umuhinzi2026",
    preferredLanguage: "rw",
    location: {
      province: "NORTHERN",
      district: "Musanze",
      sector: "Muhoza",
    },
    farmerCategory: "SMALLHOLDER",
    ...(email ? { email } : {}),
  };
}

describe.skipIf(!live)("POST /auth/register", () => {
  it("registers a smartphone farmer and a facilitator without a local session", async () => {
    localStorage.clear();
    const farmerEmail = `stage2-farmer-${stamp}@example.rw`;
    const createdFarmer = await registerAccount(farmer(1, farmerEmail));
    const facilitatorPhone = phone("079", 2);
    const facilitatorEmail = `stage2-facilitator-${stamp}@example.rw`;
    const createdFacilitator = await registerAccount({
      accountType: "FACILITATOR",
      fullName: "Stage Two Facilitator",
      phoneNumber: facilitatorPhone,
      email: facilitatorEmail,
      password: "Umuhinzi2026",
      preferredLanguage: "rw",
      location: { province: "NORTHERN", district: "Musanze", sector: "Muhoza" },
      facilitator: {
        professionalTitle: "Agronomist",
        organization: "Agriculture Organization",
        contactEmail: facilitatorEmail,
        contactPhone: facilitatorPhone,
      },
    });

    expect(createdFarmer.requiresApproval).toBe(true);
    expect(createdFarmer.accountRequestId).toEqual(expect.any(String));
    expect(createdFarmer.user.status).toBe("PENDING");
    expect(createdFacilitator.requiresApproval).toBe(true);
    expect(createdFacilitator.user.roles).toContain("FACILITATOR");
    expect(localStorage.getItem("mm-demo-user")).toBeNull();
    expect(localStorage.getItem("mm-admin-mock-v1")).toBeNull();

    console.info("STAGE2_CREATED", {
      farmer: {
        userId: createdFarmer.user.id,
        accountRequestId: createdFarmer.accountRequestId,
        phone: createdFarmer.user.phoneNumber,
        email: farmerEmail,
      },
      facilitator: {
        userId: createdFacilitator.user.id,
        accountRequestId: createdFacilitator.accountRequestId,
        phone: createdFacilitator.user.phoneNumber,
        email: facilitatorEmail,
      },
    });
  });

  it("rejects a duplicate phone number and a duplicate email", async () => {
    const email = `stage2-dup-${stamp}@example.rw`;
    const original = farmer(3, email);
    await registerAccount(original);

    const duplicatePhone = await registerAccount({
      ...farmer(4),
      phoneNumber: original.phoneNumber,
      email: `stage2-other-${stamp}@example.rw`,
    }).catch((error: unknown) => error);
    expect(duplicatePhone).toBeInstanceOf(ApiError);
    if (duplicatePhone instanceof ApiError) expect(duplicatePhone.status).toBe(409);

    const duplicateEmail = await registerAccount({
      ...farmer(5),
      email,
    }).catch((error: unknown) => error);
    expect(duplicateEmail).toBeInstanceOf(ApiError);
    if (duplicateEmail instanceof ApiError) expect(duplicateEmail.status).toBe(409);
  });

  it("returns field validation errors for a missing password and an invalid password", async () => {
    const missing = await api.post("auth/register", {
      accountType: "SMARTPHONE_FARMER",
      fullName: "Stage Two Farmer",
      phoneNumber: phone("078", 6),
      preferredLanguage: "rw",
      location: { province: "NORTHERN", district: "Musanze" },
    }).catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(ApiError);
    if (missing instanceof ApiError) {
      expect(missing.status).toBe(400);
      expect(missing.response?.message).toEqual(expect.anything());
    }

    const weak = await api.post("auth/register", {
      ...farmer(7),
      password: "onlyletters",
    }).catch((error: unknown) => error);
    expect(weak).toBeInstanceOf(ApiError);
    if (weak instanceof ApiError) expect(weak.status).toBe(400);
  });
});
