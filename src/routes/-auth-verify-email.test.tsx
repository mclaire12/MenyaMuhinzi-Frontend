import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attemptsRemaining } from "@/lib/auth/verification-code";
import { Route } from "./auth.verify-email";

let search: { token?: string } = {};
const { bffVerifyEmail, bffResendVerification } = vi.hoisted(() => ({
  bffVerifyEmail: vi.fn(),
  bffResendVerification: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

vi.mock("@/lib/auth/email-verification-server-fns", () => ({
  bffVerifyEmail,
  bffResendVerification,
}));

(Route as unknown as { useSearch: () => typeof search }).useSearch = () => search;
const VerifyEmailPage = Route.options.component as React.ComponentType;

function bffFailure(code: string, message: string, status: number): Error {
  return new Error(`__BFF_AUTH__:${JSON.stringify({ code, message, status })}`);
}

function enterCode(value: string) {
  fireEvent.change(screen.getByLabelText("Kode yo kwemeza"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Emeza" }));
}

describe("email verification page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = {};
  });

  it("does not verify on page load; asks for the code from the email", () => {
    search = { token: "link-token" };
    render(<VerifyEmailPage />);

    expect(screen.getByRole("heading", { name: "Kwemeza email" })).toBeInTheDocument();
    expect(screen.getByLabelText("Kode yo kwemeza")).toBeInTheDocument();
    expect(bffVerifyEmail).not.toHaveBeenCalled();
  });

  it("checks the code locally before calling the server", () => {
    search = { token: "link-token" };
    render(<VerifyEmailPage />);
    enterCode("12a4");

    expect(screen.getByRole("alert")).toHaveTextContent(/imibare 6/);
    expect(bffVerifyEmail).not.toHaveBeenCalled();
  });

  it("verifies the link with the code and sends the user back to sign in", async () => {
    search = { token: "link-token" };
    bffVerifyEmail.mockResolvedValue({ ok: true });
    render(<VerifyEmailPage />);
    enterCode("482913");

    expect(await screen.findByRole("heading", { name: "Email yawe yemejwe" })).toBeInTheDocument();
    expect(bffVerifyEmail).toHaveBeenCalledTimes(1);
    expect(bffVerifyEmail).toHaveBeenCalledWith({ data: { token: "link-token", code: "482913" } });
    expect(screen.getByRole("link", { name: "Subira ku injira" })).toHaveAttribute("href", "/auth");
  });

  it("shows the attempts left after a wrong code and lets the user retry", async () => {
    search = { token: "link-token" };
    bffVerifyEmail.mockRejectedValueOnce(
      bffFailure("validation", "The verification code is incorrect. 3 attempt(s) remaining.", 400),
    );
    render(<VerifyEmailPage />);
    enterCode("000000");

    expect(await screen.findByRole("alert")).toHaveTextContent("Usigaranye amahirwe 3");
    expect(screen.getByLabelText("Kode yo kwemeza")).toBeInTheDocument();
  });

  it("explains an invalid, expired or retired link and offers a new email", async () => {
    search = { token: "used-token" };
    bffVerifyEmail.mockRejectedValue(
      bffFailure("validation", "Email verification link is invalid or has expired", 400),
    );
    render(<VerifyEmailPage />);
    enterCode("123456");

    expect(await screen.findByRole("alert")).toHaveTextContent(/yarakoreshejwe, yararengeje igihe/);
    expect(screen.getByRole("button", { name: "Ohereza indi link" })).toBeInTheDocument();
  });

  it("requests a new email with a generic confirmation", async () => {
    bffResendVerification.mockResolvedValue({ message: "generic" });
    render(<VerifyEmailPage />);
    expect(bffVerifyEmail).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ohereza indi link" }));
    expect(await screen.findByText("Andika email cyangwa telefoni.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email cyangwa nimero ya telefoni"), {
      target: { value: "jeanne@example.rw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ohereza indi link" }));

    await waitFor(() =>
      expect(bffResendVerification).toHaveBeenCalledWith({
        data: { identifier: "jeanne@example.rw" },
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/Niba hari konti ihuye/);
  });
});

describe("attemptsRemaining", () => {
  it("reads the count from the backend message", () => {
    expect(attemptsRemaining("The verification code is incorrect. 4 attempt(s) remaining.")).toBe(
      4,
    );
    expect(attemptsRemaining("Email verification link is invalid or has expired")).toBeNull();
  });
});
