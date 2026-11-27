import { describe, expect, it } from "vitest";
import { isAllowedAdminApiPath } from "../api/admin-api-routes";
import { emptyChapter, MAX_CHAPTERS, move, outlineBody, validateOutline } from "./course-outline";

describe("course outline (chapters and sub-chapters)", () => {
  it("starts with one chapter holding one sub-chapter", () => {
    expect(emptyChapter()).toEqual({
      title: "",
      description: "",
      subChapters: [{ title: "", description: "" }],
    });
  });

  it("requires titles for every chapter and sub-chapter", () => {
    const errors = validateOutline([
      {
        title: "Preparing the nursery",
        subChapters: [{ title: "Choosing the site" }, { title: "  " }],
      },
      { title: "", subChapters: [{ title: "Sowing depth" }] },
    ]);
    expect(errors).toEqual({
      "sub.0.1": "Give the sub-chapter a title.",
      "chapter.1": "Give the chapter a title.",
    });
  });

  it("rejects empty outlines, empty chapters and too many chapters", () => {
    expect(validateOutline([])).toEqual({ chapters: "Add at least one chapter." });
    expect(validateOutline([{ title: "Empty", subChapters: [] }])).toEqual({
      "chapter.0": "Add at least one sub-chapter.",
    });
    const many = Array.from({ length: MAX_CHAPTERS + 1 }, (_, index) => ({
      title: `C${index}`,
      subChapters: [{ title: "S" }],
    }));
    expect(validateOutline(many)["chapters"]).toMatch(/at most/);
  });

  it("trims titles and drops empty descriptions for the API", () => {
    expect(
      outlineBody([
        {
          title: " Preparing ",
          description: " ",
          subChapters: [
            { title: " Site ", description: " shade " },
            { title: "Soil", description: "" },
          ],
        },
      ]),
    ).toEqual([
      {
        title: "Preparing",
        subChapters: [{ title: "Site", description: "shade" }, { title: "Soil" }],
      },
    ]);
  });

  it("reorders items within bounds", () => {
    expect(move(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });

  it("lets the admin portal reach the generation and training endpoints", () => {
    expect(isAllowedAdminApiPath("course-generations")).toBe(true);
    expect(
      isAllowedAdminApiPath("course-generations/7c3d8b3e-0000-4000-8000-000000000000/cancel"),
    ).toBe(true);
    expect(isAllowedAdminApiPath("knowledge/training-corpus")).toBe(true);
  });
});
