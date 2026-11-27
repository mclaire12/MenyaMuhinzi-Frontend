import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { ChapterOutline } from "@/lib/admin/backend-courses";
import { emptyChapter } from "@/lib/admin/course-outline";
import { CourseOutlineBuilder } from "./course-outline-builder";

function Harness({ errors = {} }: { errors?: Record<string, string> }) {
  const [chapters, setChapters] = useState<ChapterOutline[]>([emptyChapter()]);
  return (
    <>
      <CourseOutlineBuilder chapters={chapters} errors={errors} onChange={setChapters} />
      <output data-testid="state">{JSON.stringify(chapters)}</output>
    </>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent ?? "[]") as ChapterOutline[];

describe("CourseOutlineBuilder", () => {
  it("edits chapter and sub-chapter titles through labelled fields", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText(/Chapter 1 title/), {
      target: { value: "Preparing the nursery" },
    });
    fireEvent.change(screen.getByLabelText("Sub-chapter 1.1 title"), {
      target: { value: "Choosing the site" },
    });
    fireEvent.change(screen.getByLabelText(/What this chapter covers/), {
      target: { value: "Site and soil" },
    });

    expect(state()).toEqual([
      {
        title: "Preparing the nursery",
        description: "Site and soil",
        subChapters: [{ title: "Choosing the site", description: "" }],
      },
    ]);
    expect(
      screen.getByText("Each sub-chapter becomes one lesson farmers study."),
    ).toBeInTheDocument();
  });

  it("adds sub-chapters and chapters, focusing the new title field", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add sub-chapter to chapter 1" }));
    expect(screen.getByLabelText("Sub-chapter 1.2 title")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Add chapter 2" }));
    expect(screen.getByLabelText(/Chapter 2 title/)).toHaveFocus();
    expect(state()).toHaveLength(2);
    expect(state()[0]!.subChapters).toHaveLength(2);
  });

  it("removes and reorders, but never below one chapter or one sub-chapter", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Remove chapter 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove sub-chapter 1.1" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Add sub-chapter to chapter 1" }));
    fireEvent.change(screen.getByLabelText("Sub-chapter 1.2 title"), {
      target: { value: "Second" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Move sub-chapter 1.2 up" }));
    expect(state()[0]!.subChapters[0]!.title).toBe("Second");

    fireEvent.click(screen.getByRole("button", { name: "Remove sub-chapter 1.2" }));
    expect(state()[0]!.subChapters.map((sub) => sub.title)).toEqual(["Second"]);
  });

  it("collapses a chapter to a one-line summary and expands it again", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Sub-chapter 1.1 title"), {
      target: { value: "Choosing the site" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Collapse chapter 1" }));
    expect(screen.queryByLabelText("Sub-chapter 1.1 title")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Choosing the site \(click to expand\)/ }));
    expect(screen.getByLabelText("Sub-chapter 1.1 title")).toBeInTheDocument();
  });

  it("shows validation errors next to the fields", () => {
    render(
      <Harness
        errors={{
          "chapter.0": "Give the chapter a title.",
          "sub.0.0": "Give the sub-chapter a title.",
        }}
      />,
    );
    expect(screen.getByLabelText(/Chapter 1 title/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Give the chapter a title.")).toBeInTheDocument();
    expect(screen.getByText("Give the sub-chapter a title.")).toBeInTheDocument();
  });
});
