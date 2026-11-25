import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "./auth";

const navigate = vi.fn();
const login = vi.fn();

const router = vi.hoisted(() => ({ childMatches: [] as { id: string }[] }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => navigate,
    // Empty for /auth itself; a child such as /auth/verify-email renders through the Outlet.
    useChildMatches: () => router.childMatches,
    Outlet: () => <p>child page</p>,
    Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, apiRoles: [], isAuthenticated: false, login }),
}));

vi.mock("@/components/auth/google-sign-in-button", () => ({
  GoogleSignInButton: ({ mode }: { mode: string }) => (
    <button type="button">Google ({mode})</button>
  ),
}));

vi.mock("@/components/auth/registration-form", () => ({
  RegistrationForm: () => <div data-testid="registration-form" />,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const AuthPage = Route.options.component as React.ComponentType;

function bffFailure(code: string, message: string, status: number): Error {
  return new Error(`__BFF_AUTH__:${JSON.stringify({ code, message, status })}`);
}

describe("auth route", () => {
  it("renders a child page such as /auth/verify-email instead of the login form", () => {
    router.childMatches = [{ id: "/auth/verify-email" }];
    try {
      render(<AuthPage />);
      expect(screen.getByText("child page")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Injira" })).not.toBeInTheDocument();
    } finally {
      router.childMatches = [];
    }
  });
});

describe("login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only the real sign-in interface: no demo or seed credentials", () => {
    const { container } = render(<AuthPage />);
    const text = container.textContent ?? "";
    for (const leaked of [
      "farmer@menyamuhinzi.rw",
      "facilitator@menyamuhinzi.rw",
      "admin@menyamuhinzi.rw",
      "basicphone@menyamuhinzi.rw",
      "SEED_ADMIN_PASSWORD",
      "Muhinzi2026",
      "igerageza",
    ]) {
      expect(text).not.toContain(leaked);
    }
    expect(container.querySelector(".demo-grid, .demo-card")).toBeNull();
    expect(screen.getByLabelText("Email cyangwa nimero ya telefoni")).toBeInTheDocument();
    expect(screen.getByText("Wibagiwe?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google (login)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iyandikishe/ })).toBeInTheDocument();
  });

  it("accepts an email or a phone number in one identifier field", async () => {
    login.mockResolvedValue({});
    render(<AuthPage />);
    const identifier = screen.getByLabelText("Email cyangwa nimero ya telefoni");
    expect(identifier).toHaveAttribute("type", "text");
    expect(identifier).toHaveAttribute("placeholder", expect.stringContaining("0788123456"));

    fireEvent.change(identifier, { target: { value: "0788123456" } });
    fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga"), {
      target: { value: "Umuhinzi2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Injira" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("0788123456", "Umuhinzi2026"));
  });

  it("toggles password visibility with an accessible control", () => {
    render(<AuthPage />);
    const password = screen.getByLabelText("Ijambo ry'ibanga");
    const toggle = screen.getByRole("button", { name: "Garagaza ijambo ry'ibanga" });
    expect(password).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hisha ijambo ry'ibanga" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("explains an unverified email and links to a new verification email", async () => {
    login.mockRejectedValue(
      bffFailure("forbidden", "Email verification is required before login", 403),
    );
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText("Email cyangwa nimero ya telefoni"), {
      target: { value: "a@b.rw" },
    });
    fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga"), {
      target: { value: "Umuhinzi2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Injira" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Banza wemeze email yawe/);
    expect(screen.getByRole("link", { name: "Saba indi link yo kwemeza email" })).toHaveAttribute(
      "href",
      "/auth/verify-email",
    );
  });

  it("tells a facilitator awaiting approval apart from a wrong password", async () => {
    login.mockRejectedValueOnce(
      bffFailure("forbidden", "Your account is awaiting administrator approval", 403),
    );
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText("Email cyangwa nimero ya telefoni"), {
      target: { value: "a@b.rw" },
    });
    fireEvent.change(screen.getByLabelText("Ijambo ry'ibanga"), {
      target: { value: "Umuhinzi2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Injira" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/tegereje kwemezwa/);
    expect(screen.queryByRole("link", { name: /kwemeza email/ })).toBeNull();
  });
});
