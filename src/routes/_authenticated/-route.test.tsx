import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "./route";

const navigate = vi.fn();
let pathname = "/dashboard";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => navigate,
    useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
      select({ location: { pathname } }),
    Outlet: () => <div data-testid="outlet" />,
  };
});

const useAuthMock = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}));

const AuthenticatedGate = Route.options.component as React.ComponentType;

describe("AuthenticatedGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/dashboard";
  });

  it("redirects unauthenticated users to /auth after session restoration", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
      sessionUnavailable: false,
      roles: [],
    });
    render(<AuthenticatedGate />);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/auth", replace: true });
    });
  });

  it("shows an outage message when the backend is unavailable", () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
      sessionUnavailable: true,
      roles: [],
    });
    const { getByText } = render(<AuthenticatedGate />);
    expect(getByText(/Serivisi ntiboneka by'agateganyo/i)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("renders child routes for authenticated users", () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", status: "ACTIVE" },
      loading: false,
      isAuthenticated: true,
      sessionUnavailable: false,
      roles: ["farmer"],
    });
    const { getByTestId } = render(<AuthenticatedGate />);
    expect(getByTestId("outlet")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("redirects basic phone farmers away from most authenticated routes", async () => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", status: "ACTIVE" },
      loading: false,
      isAuthenticated: true,
      sessionUnavailable: false,
      roles: ["basic_phone_farmer"],
    });
    render(<AuthenticatedGate />);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/phone", replace: true });
    });
  });

  it.each(["/admin", "/admin/users", "/facilitator", "/dashboard", "/assistant"])(
    "never renders %s for a basic phone farmer and redirects to the portal",
    async (path) => {
      pathname = path;
      useAuthMock.mockReturnValue({
        user: { id: "u1", status: "ACTIVE" },
        loading: false,
        isAuthenticated: true,
        sessionUnavailable: false,
        roles: ["basic_phone_farmer"],
      });
      const { queryByTestId } = render(<AuthenticatedGate />);
      expect(queryByTestId("outlet")).toBeNull();
      await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/phone", replace: true }));
    },
  );

  it("renders the testing portal for a basic phone farmer", () => {
    pathname = "/phone";
    useAuthMock.mockReturnValue({
      user: { id: "u1", status: "ACTIVE" },
      loading: false,
      isAuthenticated: true,
      sessionUnavailable: false,
      roles: ["basic_phone_farmer"],
    });
    const { getByTestId } = render(<AuthenticatedGate />);
    expect(getByTestId("outlet")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("allows basic phone farmers on the change-password page", () => {
    pathname = "/account/password";
    useAuthMock.mockReturnValue({
      user: { id: "u1", status: "ACTIVE" },
      loading: false,
      isAuthenticated: true,
      sessionUnavailable: false,
      roles: ["basic_phone_farmer"],
    });
    const { getByTestId } = render(<AuthenticatedGate />);
    expect(getByTestId("outlet")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});