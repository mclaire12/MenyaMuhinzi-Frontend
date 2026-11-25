import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  basicPhoneFarmerInputSchema,
  type BasicPhoneFarmerInput,
} from "../api/basic-phone-farmer-types";

vi.mock("./auth-service", () => ({
  obtainAccessTokenFromSession: vi.fn().mockResolvedValue("access-token"),
}));

import {
  createBasicPhoneFarmerFromSession,
  resetBasicPhoneFarmerBackendClientFactory,
  setBasicPhoneFarmerBackendClientFactory,
} from "./basic-phone-farmer-service";

const input: BasicPhoneFarmerInput = {
  fullName: "Mukeshimana Vestine",
  phoneNumber: "0788555100",
  email: "vestine@example.rw",
  preferredLanguage: "rw",
  password: "Umuhinzi2026",
  notes: "Field visit",
  location: {
    province: "EASTERN",
    district: "Nyagatare",
    sector: "Karangazi",
    cell: "Rwimiyaga",
    village: "Rwisirabo",
  },
};

const createFarmer = vi.fn();
const createAccountRequest = vi.fn();

describe("basic-phone farmer BFF service", () => {
  beforeEach(() => {
    createFarmer.mockReset();
    createAccountRequest.mockReset();
    setBasicPhoneFarmerBackendClientFactory(
      () =>
        ({ createFarmer, createAccountRequest }) as unknown as ReturnType<
          typeof import("./backend-client").createBackendClient
        >,
    );
  });

  afterEach(() => resetBasicPhoneFarmerBackendClientFactory());

  it("lets administrators create the farmer directly with the session access token", async () => {
    createFarmer.mockResolvedValue({
      userId: "u-1",
      fullName: input.fullName,
      phoneNumber: "+250788555100",
      email: input.email,
      status: "ACTIVE",
      farmerType: "BASIC_PHONE",
    });

    const created = await createBasicPhoneFarmerFromSession("direct", input);

    expect(createFarmer).toHaveBeenCalledWith("access-token", {
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      email: input.email,
      preferredLanguage: "rw",
      farmerType: "BASIC_PHONE",
      password: "Umuhinzi2026",
      location: input.location,
    });
    expect(createAccountRequest).not.toHaveBeenCalled();
    expect(created).toMatchObject({ mode: "direct", userId: "u-1", accountRequestId: null });
    expect(JSON.stringify(created)).not.toMatch(/access-token|Umuhinzi2026/);
  });

  it("sends facilitator submissions to the approval queue without a password", async () => {
    createAccountRequest.mockResolvedValue({
      id: "req-1",
      applicant: {
        id: "u-2",
        fullName: input.fullName,
        phoneNumber: "+250788555100",
        email: input.email,
        status: "PENDING",
      },
    });

    const created = await createBasicPhoneFarmerFromSession("request", input);

    const [, body] = createAccountRequest.mock.calls[0]!;
    expect(body).toMatchObject({
      farmerType: "BASIC_PHONE",
      email: input.email,
      notes: "Field visit",
    });
    expect(body).not.toHaveProperty("password");
    expect(created).toMatchObject({
      mode: "request",
      userId: "u-2",
      status: "PENDING",
      accountRequestId: "req-1",
    });
  });
});

describe("basic-phone farmer input validation", () => {
  it("requires a personal email and the full address", () => {
    const { email: _email, ...noEmail } = input;
    expect(basicPhoneFarmerInputSchema.safeParse(noEmail).success).toBe(false);
    expect(basicPhoneFarmerInputSchema.safeParse({ ...input, email: "nope" }).success).toBe(false);
    for (const part of ["sector", "cell", "village"] as const) {
      const result = basicPhoneFarmerInputSchema.safeParse({
        ...input,
        location: { ...input.location, [part]: " " },
      });
      expect(result.success).toBe(false);
    }
  });

  it("validates phone numbers with the Rwandan country-code conventions", () => {
    for (const phone of ["0788555100", "250788555100", "+250788555100"]) {
      expect(basicPhoneFarmerInputSchema.safeParse({ ...input, phoneNumber: phone }).success).toBe(
        true,
      );
    }
    expect(
      basicPhoneFarmerInputSchema.safeParse({ ...input, phoneNumber: "0712345678" }).success,
    ).toBe(false);
  });
});
