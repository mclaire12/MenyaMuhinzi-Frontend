import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BasicPhoneFarmerForm } from "./basic-phone-farmer-form";

const { bffCreateBasicPhoneFarmer } = vi.hoisted(() => ({ bffCreateBasicPhoneFarmer: vi.fn() }));
vi.mock("@/lib/auth/basic-phone-farmer-server-fns", () => ({ bffCreateBasicPhoneFarmer }));
vi.mock("@/components/ui/dialog", () => ({
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

async function fill(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    "Full name": "Mukeshimana Vestine",
    "Phone number": "0788 555 100",
    "Personal email": "vestine@example.rw",
    District: "Gasabo",
    Sector: "Kimironko",
    Cell: "Bibare",
    Village: "Imena",
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    // Each place is listed once the level above it is chosen and the locations are loaded.
    if (value && ["Sector", "Cell", "Village"].includes(label)) {
      await screen.findByRole("option", { name: value });
    }
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

describe("BasicPhoneFarmerForm", () => {
  beforeEach(() => {
    bffCreateBasicPhoneFarmer.mockReset();
  });

  it("refuses to submit without a personal email, cell or village", async () => {
    render(<BasicPhoneFarmerForm mode="direct" onCreated={vi.fn()} onCancel={vi.fn()} />);
    await fill({ "Personal email": "", Cell: "", Village: "" });
    fireEvent.click(screen.getByRole("button", { name: "Register farmer" }));

    expect(await screen.findByText("Enter a valid personal email address.")).toBeInTheDocument();
    expect(screen.getByText("Cell is required.")).toBeInTheDocument();
    expect(screen.getByText("Village is required.")).toBeInTheDocument();
    expect(bffCreateBasicPhoneFarmer).not.toHaveBeenCalled();
  });

  it("creates directly for administrators", async () => {
    const onCreated = vi.fn();
    bffCreateBasicPhoneFarmer.mockResolvedValue({
      mode: "direct",
      fullName: "Mukeshimana Vestine",
    });
    render(<BasicPhoneFarmerForm mode="direct" onCreated={onCreated} onCancel={vi.fn()} />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Register farmer" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(bffCreateBasicPhoneFarmer).toHaveBeenCalledWith({
      data: {
        mode: "direct",
        farmer: expect.objectContaining({
          phoneNumber: "0788555100",
          email: "vestine@example.rw",
          location: {
            province: "KIGALI_CITY",
            district: "Gasabo",
            sector: "Kimironko",
            cell: "Bibare",
            village: "Imena",
          },
        }),
      },
    });
  });

  it("submits facilitator registrations for approval and explains a permission error", async () => {
    bffCreateBasicPhoneFarmer.mockImplementation(async () => {
      throw new Error(
        `__BFF_AUTH__:${JSON.stringify({ code: "forbidden", message: "Forbidden", status: 403 })}`,
      );
    });
    render(<BasicPhoneFarmerForm mode="request" onCreated={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText("Initial password (optional)")).toBeNull();
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "You do not have permission to register basic-phone farmers.",
      ),
    );
    expect(bffCreateBasicPhoneFarmer).toHaveBeenCalledWith({
      data: expect.objectContaining({ mode: "request" }),
    });
  });
});
