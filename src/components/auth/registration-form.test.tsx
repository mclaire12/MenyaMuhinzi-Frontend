import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import type { RegistrationResponse } from "@/lib/api/types";
import { RegistrationForm, getRegistrationErrorMessages } from "./registration-form";

const { registerAccount, bffResendVerification } = vi.hoisted(() => ({
  registerAccount: vi.fn(),
  bffResendVerification: vi.fn(),
}));

vi.mock("@/lib/api/registration-service", () => ({
  registerAccount,
}));

vi.mock("@/lib/auth/email-verification-server-fns", () => ({
  bffResendVerification,
  bffVerifyEmail: vi.fn(),
}));

vi.mock("@/components/auth/google-sign-in-button", () => ({
  GoogleSignInButton: () => null,
}));

const user: RegistrationResponse["user"] = {
  id: "user-1",
  fullName: "Uwimana Jeanne",
  phoneNumber: "+250788123456",
  email: "jeanne@example.rw",
  status: "ACTIVE",
  statusReason: null,
  statusChangedAt: null,
  preferredLanguage: "rw",
  roles: ["SMARTPHONE_FARMER"],
  lastLoginAt: null,
  createdAt: "2026-11-24T00:00:00.000Z",
  updatedAt: "2026-11-24T00:00:00.000Z",
};

const farmerRegistered: RegistrationResponse = {
  user,
  requiresApproval: false,
  requiresEmailVerification: true,
  verificationEmailSent: true,
  accountRequestId: null,
  message: "Registration complete. Check your email to verify your account before signing in.",
};

const facilitatorReceived: RegistrationResponse = {
  user: { ...user, status: "PENDING", roles: ["FACILITATOR"] },
  requiresApproval: true,
  requiresEmailVerification: true,
  verificationEmailSent: false,
  accountRequestId: "request-1",
  message: "Registration received.",
};

function fillCommonFields() {
  fireEvent.change(screen.getByLabelText("Amazina yawe yose"), {
    target: { value: "Uwimana Jeanne" },
  });
  fireEvent.change(screen.getByLabelText("Nimero ya telefoni"), {
    target: { value: "0788123456" },
  });
  fireEvent.change(screen.getByLabelText("Email yawe bwite"), {
    target: { value: "jeanne@example.rw" },
  });
  fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga"), {
    target: { value: "Umuhinzi2026" },
  });
  fireEvent.change(screen.getByLabelText("Akarere"), { target: { value: "Gasabo" } });
}

async function choosePlace(label: string, value: string) {
  // Places are listed once the level above is chosen and the location list has loaded.
  await screen.findByRole("option", { name: value });
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function fillFarmerForm() {
  fillCommonFields();
  await choosePlace("Umurenge", "Remera");
  await choosePlace("Akagari", "Rukiri I");
  await choosePlace("Umudugudu", "Gisimenti");
}

function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: "Ohereza ubusabe" }));
}

describe("RegistrationForm", () => {
  beforeEach(() => {
    registerAccount.mockReset();
    bffResendVerification.mockReset();
    localStorage.clear();
  });

  it("registers a smartphone farmer with the full address and asks them to verify their email", async () => {
    registerAccount.mockResolvedValue(farmerRegistered);
    render(<RegistrationForm onReturnToLogin={() => {}} />);
    await fillFarmerForm();
    submitForm();

    expect(
      await screen.findByRole("heading", { name: "Konti yawe yarafunguwe" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/link yo kwemeza email kuri jeanne@example\.rw/)).toBeInTheDocument();
    expect(localStorage.getItem("mm-demo-user")).toBeNull();
    expect(registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: "SMARTPHONE_FARMER",
        email: "jeanne@example.rw",
        phoneNumber: "+250788123456",
        location: expect.objectContaining({
          sector: "Remera",
          cell: "Rukiri I",
          village: "Gisimenti",
        }),
      }),
    );
  });

  it("does not claim the verification email was sent when delivery failed", async () => {
    registerAccount.mockResolvedValue({ ...farmerRegistered, verificationEmailSent: false });
    render(<RegistrationForm onReturnToLogin={() => {}} />);
    await fillFarmerForm();
    submitForm();

    expect(await screen.findByText(/ntiyashoboye koherezwa/)).toBeInTheDocument();
    expect(screen.queryByText(/Twohereje link/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ohereza indi link" })).toBeInTheDocument();
  });

  it("requires personal email, cell and village before submitting a farmer", async () => {
    render(<RegistrationForm onReturnToLogin={() => {}} />);
    fillCommonFields();
    fireEvent.change(screen.getByLabelText("Email yawe bwite"), { target: { value: "" } });
    submitForm();

    expect(await screen.findByText("Hitamo akagari.")).toBeInTheDocument();
    expect(screen.getByText("Hitamo umudugudu.")).toBeInTheDocument();
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it("makes facilitators pick a title from the dropdown and explains approval comes first", async () => {
    registerAccount.mockResolvedValue(facilitatorReceived);
    render(<RegistrationForm onReturnToLogin={() => {}} />);
    fireEvent.change(screen.getByLabelText("Ubwoko bwa konti"), {
      target: { value: "FACILITATOR" },
    });
    fillCommonFields();
    fireEvent.change(screen.getByLabelText("Umuryango cyangwa ikigo ukorera"), {
      target: { value: "Rwanda Agriculture Board" },
    });
    submitForm();
    expect(await screen.findByText("Hitamo umwanya wawe w'akazi.")).toBeInTheDocument();
    expect(registerAccount).not.toHaveBeenCalled();

    const title = screen.getByLabelText("Umwanya w'akazi");
    expect(title.tagName).toBe("SELECT");
    fireEvent.change(title, { target: { value: "Agronomist" } });
    submitForm();

    expect(
      await screen.findByRole("heading", { name: "Ubusabe bwawe bwakiriwe" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nibwemezwa, uzakira email yo kwemeza/)).toBeInTheDocument();
    expect(screen.getByText("request-1")).toBeInTheDocument();
    expect(registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: "FACILITATOR",
        facilitator: expect.objectContaining({ professionalTitle: "Agronomist" }),
      }),
    );
  });

  it("toggles password visibility", () => {
    render(<RegistrationForm onReturnToLogin={() => {}} />);
    const password = screen.getByLabelText("Ijambo ry'ibanga");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Garagaza ijambo ry'ibanga" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hisha ijambo ry'ibanga" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("explains a network failure without signing in", async () => {
    registerAccount.mockRejectedValue(
      new ApiError("Unable to reach the API.", { kind: "network" }),
    );
    render(<RegistrationForm onReturnToLogin={() => {}} />);
    await fillFarmerForm();
    submitForm();

    expect(
      await screen.findByText(
        "Seriveri ntishobora kugerwaho ubu. Reba internet wongere ugerageze.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Konti yawe yarafunguwe" }),
    ).not.toBeInTheDocument();
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
    ).toEqual(["Ijambo ry'ibanga rigomba kugira umubare nibura umwe.", "Andika email yemewe."]);

    expect(
      getRegistrationErrorMessages(
        new ApiError("conflict", {
          kind: "http",
          status: 409,
          response: {
            ...envelope,
            statusCode: 409,
            message: "An account with this phone number already exists",
          },
        }),
      ),
    ).toEqual(["Iyi nimero ya telefoni isanzwe yanditse."]);

    expect(
      getRegistrationErrorMessages(
        new ApiError("conflict", {
          kind: "http",
          status: 409,
          response: {
            ...envelope,
            statusCode: 409,
            message: "An account with this email address already exists",
          },
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
    expect(
      getRegistrationErrorMessages(new ApiError("down", { kind: "http", status: 500 })),
    ).toEqual(["Habaye ikibazo kuri seriveri. Ongera ugerageze nyuma."]);
  });
});
