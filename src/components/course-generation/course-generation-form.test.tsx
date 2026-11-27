import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { bffAdminApi } = vi.hoisted(() => ({ bffAdminApi: vi.fn() }));
vi.mock("@/lib/auth/admin-api-server-fns", () => ({ bffAdminApi }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { CourseGenerationForm } from "./course-generation-form";

const tomato = { id: "crop-tomato", code: "TOMATO", nameEn: "Tomatoes", nameRw: "Inyanya" };
const cabbage = { id: "crop-cabbage", code: "CABBAGE", nameEn: "Cabbages", nameRw: "Amashu" };

function renderForm(props: Parameters<typeof CourseGenerationForm>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CourseGenerationForm {...props} />
    </QueryClientProvider>,
  );
}

function fillCommonFields() {
  fireEvent.change(screen.getByLabelText("Course title"), { target: { value: "Tomato nursery" } });
  fireEvent.change(screen.getByLabelText("Short description"), {
    target: { value: "Raise seedlings" },
  });
  fireEvent.change(screen.getByLabelText(/Learning objectives/), {
    target: { value: "Prepare a bed" },
  });
  fireEvent.change(screen.getByLabelText("Instructions for the AI"), {
    target: { value: "Smallholders" },
  });
  fireEvent.change(screen.getByLabelText(/Chapter 1 title/), { target: { value: "Nursery" } });
  fireEvent.change(screen.getByLabelText("Sub-chapter 1.1 title"), { target: { value: "Site" } });
}

describe("CourseGenerationForm", () => {
  beforeEach(() => {
    bffAdminApi.mockReset();
    bffAdminApi.mockImplementation(({ data }: { data: { method: string; path: string } }) => {
      if (data.path === "crops") return Promise.resolve([tomato, cabbage]);
      if (data.path === "knowledge/sources") {
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        });
      }
      if (data.method === "POST" && data.path === "course-generations") {
        return Promise.resolve({
          id: "gen-1",
          course: { id: "course-1", title: "Tomato nursery", status: "DRAFT" },
        });
      }
      return Promise.reject(new Error(`unexpected ${data.method} ${data.path}`));
    });
  });

  it("has no group choice: admins and facilitators submit the same structure", async () => {
    const onCreated = vi.fn();
    renderForm({ onCreated });
    expect(screen.queryByLabelText(/For which of your groups/)).not.toBeInTheDocument();
    await screen.findByRole("option", { name: /Tomatoes/ });
    fillCommonFields();
    fireEvent.change(screen.getByLabelText("Crop"), { target: { value: "crop-cabbage" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate course/ }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const post = bffAdminApi.mock.calls.find(([arg]) => arg.data.method === "POST")?.[0].data;
    expect(post.body.cropId).toBe("crop-cabbage");
    expect(post.body).not.toHaveProperty("facilitatorGroupId");
  });
});
