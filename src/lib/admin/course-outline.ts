import type { ChapterOutline } from "@/lib/admin/backend-courses";

/** Course structure designed by the administrator: chapters with sub-chapters. Limits match the backend. */
export const MAX_CHAPTERS = 20;
export const MAX_SUB_CHAPTERS = 30;

export const emptyChapter = (): ChapterOutline => ({
  title: "",
  description: "",
  subChapters: [{ title: "", description: "" }],
});

export function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as T);
  return next;
}

/** Errors keyed by path: "chapters", "chapter.0", "sub.0.1". */
export function validateOutline(chapters: ChapterOutline[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (chapters.length === 0) errors["chapters"] = "Add at least one chapter.";
  if (chapters.length > MAX_CHAPTERS) errors["chapters"] = `Use at most ${MAX_CHAPTERS} chapters.`;
  chapters.forEach((chapter, index) => {
    if (!chapter.title.trim()) errors[`chapter.${index}`] = "Give the chapter a title.";
    else if (chapter.title.trim().length > 200)
      errors[`chapter.${index}`] = "Use at most 200 characters.";
    if (chapter.subChapters.length === 0)
      errors[`chapter.${index}`] = "Add at least one sub-chapter.";
    if (chapter.subChapters.length > MAX_SUB_CHAPTERS)
      errors[`chapter.${index}`] = `Use at most ${MAX_SUB_CHAPTERS} sub-chapters.`;
    chapter.subChapters.forEach((sub, subIndex) => {
      if (!sub.title.trim()) errors[`sub.${index}.${subIndex}`] = "Give the sub-chapter a title.";
      else if (sub.title.trim().length > 200)
        errors[`sub.${index}.${subIndex}`] = "Use at most 200 characters.";
    });
  });
  return errors;
}

/** Cleans the outline for the API: trimmed titles, empty descriptions dropped. */
export function outlineBody(chapters: ChapterOutline[]): ChapterOutline[] {
  return chapters.map((chapter) => ({
    title: chapter.title.trim(),
    ...(chapter.description?.trim() ? { description: chapter.description.trim() } : {}),
    subChapters: chapter.subChapters.map((sub) => ({
      title: sub.title.trim(),
      ...(sub.description?.trim() ? { description: sub.description.trim() } : {}),
    })),
  }));
}
