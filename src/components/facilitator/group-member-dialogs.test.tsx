import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { bffAdminApi, bffImportGroupMembers, bffDownloadMemberTemplate, toast } = vi.hoisted(() => ({
  bffAdminApi: vi.fn(),
  bffImportGroupMembers: vi.fn(),
  bffDownloadMemberTemplate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/lib/auth/admin-api-server-fns", () => ({ bffAdminApi }));
vi.mock("@/lib/auth/group-members-server-fns", () => ({
  bffImportGroupMembers,
  bffDownloadMemberTemplate,
  MEMBER_IMPORT_MAX_BYTES: 2 * 1024 * 1024,
}));
vi.mock("sonner", () => ({ toast }));

import {
  AddExistingMemberDialog,
  ImportMembersDialog,
  NewMemberDialog,
} from "./group-member-dialogs";

const group = { id: "7c3d8b3e-0000-4000-8000-000000000001", name: "Kinigi growers" };

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe("group member dialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers one new farmer with the same information as registration", async () => {
    bffAdminApi.mockResolvedValue({
      userId: "u-1",
      fullName: "Uwase Aline",
      email: "aline@example.rw",
      phoneNumber: "+250788555201",
      emailSent: true,
    });
    const onClose = vi.fn();
    wrap(<NewMemberDialog group={group} open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Register and add to group" }));
    expect(await screen.findByText("Enter the full name.")).toBeInTheDocument();
    expect(bffAdminApi).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "Uwase Aline" } });
    fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: "0788 555 201" } });
    fireEvent.change(screen.getByLabelText(/Personal email/), {
      target: { value: "Aline@Example.rw" },
    });
    fireEvent.change(screen.getByLabelText(/Phone type/), { target: { value: "BASIC_PHONE" } });
    fireEvent.change(screen.getByLabelText(/^Province/), { target: { value: "NORTHERN" } });
    fireEvent.change(screen.getByLabelText(/District/), { target: { value: "Musanze" } });
    // Each level lists only the places inside the one chosen above it.
    await screen.findByRole("option", { name: "Kinigi" });
    expect(screen.queryByRole("option", { name: "Kimironko" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Sector/), { target: { value: "Kinigi" } });
    await screen.findByRole("option", { name: "Nyonirima" });
    fireEvent.change(screen.getByLabelText(/^Cell/), { target: { value: "Nyonirima" } });
    await screen.findByRole("option", { name: "Kansoro" });
    fireEvent.change(screen.getByLabelText(/Village/), { target: { value: "Kansoro" } });
    fireEvent.click(screen.getByRole("button", { name: "Register and add to group" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bffAdminApi).toHaveBeenCalledWith({
      data: {
        method: "POST",
        path: `facilitator/groups/${group.id}/members/register`,
        body: {
          fullName: "Uwase Aline",
          phoneNumber: "0788555201",
          email: "aline@example.rw",
          farmerType: "BASIC_PHONE",
          farmerCategory: "SMALLHOLDER",
          preferredLanguage: "rw",
          location: {
            province: "NORTHERN",
            district: "Musanze",
            sector: "Kinigi",
            cell: "Nyonirima",
            village: "Kansoro",
          },
        },
      },
    });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/verification email was sent to aline@example\.rw/),
    );
  });

  it("imports the filled template and lists the rows that need fixing", async () => {
    bffImportGroupMembers.mockResolvedValue({
      total: 2,
      created: [
        {
          row: 2,
          userId: "u-1",
          fullName: "Uwase Aline",
          email: "aline@example.rw",
          phoneNumber: "+250788555201",
          emailSent: true,
        },
      ],
      failed: [{ row: 3, fullName: "Bad Row", errors: ["email must be an email"] }],
    });
    wrap(<ImportMembersDialog group={group} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Import farmers/ }));
    expect(await screen.findByText("Choose the filled Excel template.")).toBeInTheDocument();

    const file = new File(["xlsx"], "members.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(screen.getByLabelText("Filled Excel template"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Import farmers/ }));

    expect(await screen.findByText(/Row 2: Uwase Aline/)).toBeInTheDocument();
    expect(screen.getByText("email must be an email")).toBeInTheDocument();
    const data = bffImportGroupMembers.mock.calls[0]?.[0].data as FormData;
    expect(data.get("groupId")).toBe(group.id);
    expect(data.get("file")).toBe(file);
  });

  it("finds an existing farmer by email and adds them to the group", async () => {
    bffAdminApi.mockImplementation(({ data }: { data: { method: string; path: string } }) =>
      data.method === "GET"
        ? Promise.resolve({
            data: [
              {
                userId: "u-9",
                fullName: "Existing Farmer",
                phoneNumber: "+250788000009",
                email: "existing@example.rw",
                status: "ACTIVE",
                farmerType: "SMARTPHONE",
                location: null,
              },
            ],
            meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
          })
        : Promise.resolve([]),
    );
    wrap(<AddExistingMemberDialog group={group} memberIds={new Set()} open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Search farmers by email"), {
      target: { value: "existing@example.rw" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Add" }, { timeout: 2000 }));

    await waitFor(() =>
      expect(bffAdminApi).toHaveBeenCalledWith({
        data: {
          method: "POST",
          path: `facilitator/groups/${group.id}/members`,
          body: { userIds: ["u-9"] },
        },
      }),
    );
    expect(await screen.findByText("In this group")).toBeInTheDocument();
  });
});
