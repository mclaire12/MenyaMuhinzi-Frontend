import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import type { RegistrationResponse } from "@/lib/api/types";
import { RegistrationForm, getRegistrationErrorMessages } from "./registration-form";

const { registerAccount } = vi.hoisted(() => ({ registerAccount: vi.fn() }));

vi.mock("@/lib/api/registration-service", () => ({
  registerAccount,
}));

const success: RegistrationResponse = {
  user: {
    id: "user-1",
    fullName: "Uwimana Jeanne",
    phoneNumber: "+250788123456",
    email: "jeanne@example.rw",
    status: "PENDING",
    statusReason: null,
    statusChangedAt: null,
    preferredLanguage: "rw",
    roles: ["SMARTPHONE_FARMER"],
    lastLoginAt: null,
    createdAt: "2026-11-24T00:00:00.000Z",
    updatedAt: "2026-11-24T00:00:00.000Z",
  },
  requiresApproval: true,
  accountRequestId: "request-1",
  message: "Registration received. An administrator will review your account.",
};

function fillFarmerForm() {
  fireEvent.change(screen.getByLabelText("Amazina yawe yose"), { target: { value: "Uwimana Jeanne" } });
  fireEvent.change(screen.getByLabelText("Nimero ya telefoni"), { target: { value: "0788123456" } });
  fireEvent.change(screen.getByLabelText("Email (si ngombwa)"), { target: { value: "jeanne@example.rw" } });
  fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga"), { target: { value: "Umuhinzi2026" } });
  fireEvent.change(screen.getByLabelText("Akarere"), { target: { value: "Gasabo" } });
  fireEvent.change(screen.getByLabelText("Umurenge"), { target: { value: "Remera" } });
}

describe("RegistrationForm", () => {
  beforeEach(() => {
    registerAccount.mockReset();
    localStorage.clear();
  });

  it("shows the request-received screen and does not sign the user in", async () => {
    registerAccount.mockResolvedValue(success);
    render(<RegistrationForm onReturnToLogin={() => {}} />);
    fillFarmerForm();
    fireEvent.click(screen.getByRole("button", { name: "Ohereza ubusabe" }));

    expect(await screen.findByRole("heading", { name: "Ubusabe bwawe bwakiriwe" })).toBeInTheDocument();
    expect(screen.getByText(success.message)).toBeInTheDocument();
    expect(screen.getByText("request-1")).toBeInTheDocument();
    expect(localStorage.getItem("mm-demo-user")).toBeNull();
    expect(localStorage.getItem("mm-admin-mock-v1")).toBeNull();
    expect(registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: "SMARTPHONE_FARMER",
        email: "jeanne@example.rw",
        phoneNumber: "+250788123456",
      }),
    );
  });

  it("explains a network failure without signing in", async () => {
    registerAccount.mockRejectedValue(new ApiError("Unable to reach the API.", { kind: "network" }));
    render(<RegistrationForm onReturnToLogin={() => {}} />);
    fillFarmerForm();
    fireEvent.click(screen.getByRole("button", { name: "Ohereza ubusabe" }));

    expect(
      await screen.findByText("Seriveri ntishobora kugerwaho ubu. Reba internet wongere ugerageze."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ubusabe bwawe bwakiriwe" })).not.toBeInTheDocument();
    expect(localStorage.getItem("mm-demo-user")).toBeNull();
  });
});

describe("getRegistrationErrorMessages", () => {
  it("maps validation, conflicts, timeout and server errors", () => {
    const envelope = {
      statusCode: 400,
      error: "Bad Request",
      path: "/api/v1/auth/register",
      method: "POST",
      timestamp: "2026-11-24T00:00:00.000Z",
    };

    expect(
      getRegistrationErrorMessages(
        new ApiError("invalid", {
          kind: "http",
          status: 400,
          response: {
            ...envelope,
            message: [
              "password must contain at least one digit",
              "email must be a valid email address",
            ],
          },
        }),
      ),
    ).toEqual([
      "Ijambo ry'ibanga rigomba kugira umubare nibura umwe.",
      "Andika email yemewe.",
    ]);

    expect(
      getRegistrationErrorMessages(
        new ApiError("conflict", {
          kind: "http",
          status: 409,
          response: { ...envelope, statusCode: 409, message: "An account with this phone number already exists" },
        }),
      ),
    ).toEqual(["Iyi nimero ya telefoni isanzwe yanditse."]);

    expect(
      getRegistrationErrorMessages(
        new ApiError("conflict", {
          kind: "http",
          status: 409,
          response: { ...envelope, statusCode: 409, message: "An account with this email address already exists" },
        }),
      ),
    ).toEqual(["Iyi email isanzwe yanditse."]);

    expect(
      getRegistrationErrorMessages(
        new ApiError("conflict", {
          kind: "http",
          status: 409,
          response: {
            ...envelope,
            statusCode: 409,
            message: "An account request for this phone number is already pending approval",
          },
        }),
      ),
    ).toEqual(["Hari ubusabe bwa iyi nimero ya telefoni bugisuzumwa."]);

    expect(getRegistrationErrorMessages(new ApiError("slow", { kind: "timeout" }))).toEqual([
      "Ibyo wohereje byatinze. Ongera ugerageze.",
    ]);
    expect(getRegistrationErrorMessages(new ApiError("down", { kind: "http", status: 500 }))).toEqual([
      "Habaye ikibazo kuri seriveri. Ongera ugerageze nyuma.",
    ]);
  });
});
