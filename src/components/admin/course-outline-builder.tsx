import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ListTree,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChapterOutline } from "@/lib/admin/backend-courses";
import { emptyChapter, MAX_CHAPTERS, MAX_SUB_CHAPTERS, move } from "@/lib/admin/course-outline";
import { cn } from "@/lib/utils";

type Sub = ChapterOutline["subChapters"][number];

function IconAction({
  label,
  disabled,
  onClick,
  danger,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(danger && "text-destructive hover:bg-destructive/10 hover:text-destructive")}
    >
      {children}
    </Button>
  );
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

/**
 * The administrator designs the course structure: chapters and their sub-chapters.
 * The AI model writes the content of every sub-chapter in the chosen learning formats.
 */
export function CourseOutlineBuilder({
  chapters,
  errors,
  onChange,
}: {
  chapters: ChapterOutline[];
  errors: Record<string, string>;
  onChange: (chapters: ChapterOutline[]) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  /** Field to focus after adding a chapter or sub-chapter, e.g. "chapter-2" or "sub-0-3". */
  const [focus, setFocus] = useState<string | null>(null);

  const setChapter = (index: number, patch: Partial<ChapterOutline>) =>
    onChange(chapters.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter)));
  const setSub = (index: number, subIndex: number, patch: Partial<Sub>) =>
    setChapter(index, {
      subChapters: (chapters[index]?.subChapters ?? []).map((sub, i) =>
        i === subIndex ? { ...sub, ...patch } : sub,
      ),
    });
  const toggle = (index: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  // Collapsed state is kept by position; reset it when chapters move or are removed.
  const reorder = (next: ChapterOutline[]) => {
    setCollapsed(new Set());
    onChange(next);
  };
  const addChapter = () => {
    setFocus(`chapter-${chapters.length}`);
    onChange([...chapters, emptyChapter()]);
  };
  const addSub = (index: number) => {
    const chapter = chapters[index];
    if (!chapter) return;
    setFocus(`sub-${index}-${chapter.subChapters.length}`);
    setChapter(index, { subChapters: [...chapter.subChapters, { title: "", description: "" }] });
  };
  const subCount = chapters.reduce((sum, chapter) => sum + chapter.subChapters.length, 0);

  return (
    <section className="space-y-3" aria-label="Course structure">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <ListTree className="size-4 text-primary" aria-hidden />
          <b>{chapters.length}</b> chapter{chapters.length === 1 ? "" : "s"} · <b>{subCount}</b>{" "}
          sub-chapter{subCount === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground">
          Each sub-chapter becomes one lesson farmers study.
        </span>
      </div>
      <FieldError id="outline-error" message={errors["chapters"]} />

      <ol className="space-y-4">
        {chapters.map((chapter, index) => {
          const open = !collapsed.has(index);
          const chapterError = errors[`chapter.${index}`];
          const titleId = `chapter-${index}-title`;
          return (
            <li
              key={index}
              className={cn(
                "rounded-xl border bg-card shadow-sm",
                chapterError && "border-destructive/60",
              )}
            >
              <div className="flex items-start gap-3 rounded-t-xl border-b bg-muted/40 px-4 py-3">
                <span
                  className="mt-6 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label
                    htmlFor={titleId}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Chapter {index + 1} title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={titleId}
                    value={chapter.title}
                    maxLength={200}
                    placeholder="e.g. Preparing the nursery"
                    className="h-10 bg-background text-base font-semibold"
                    aria-invalid={!!chapterError}
                    aria-describedby={chapterError ? `${titleId}-error` : undefined}
                    autoFocus={focus === `chapter-${index}`}
                    onFocus={() => focus === `chapter-${index}` && setFocus(null)}
                    onChange={(event) => setChapter(index, { title: event.target.value })}
                  />
                  <FieldError id={`${titleId}-error`} message={chapterError} />
                </div>
                <div className="mt-6 flex shrink-0 items-center gap-0.5">
                  <IconAction
                    label={`Move chapter ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => reorder(move(chapters, index, -1))}
                  >
                    <ArrowUp aria-hidden />
                  </IconAction>
                  <IconAction
                    label={`Move chapter ${index + 1} down`}
                    disabled={index === chapters.length - 1}
                    onClick={() => reorder(move(chapters, index, 1))}
                  >
                    <ArrowDown aria-hidden />
                  </IconAction>
                  <IconAction
                    label={`Remove chapter ${index + 1}`}
                    danger
                    disabled={chapters.length === 1}
                    onClick={() => reorder(chapters.filter((_, i) => i !== index))}
                  >
                    <Trash2 aria-hidden />
                  </IconAction>
                  <IconAction
                    label={open ? `Collapse chapter ${index + 1}` : `Expand chapter ${index + 1}`}
                    onClick={() => toggle(index)}
                  >
                    {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                  </IconAction>
                </div>
              </div>

              {open ? (
                <div className="space-y-4 px-4 py-4">
                  <div className="space-y-1">
                    <Label htmlFor={`chapter-${index}-notes`}>
                      What this chapter covers{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional, guides the AI)
                      </span>
                    </Label>
                    <Textarea
                      id={`chapter-${index}-notes`}
                      rows={2}
                      maxLength={2000}
                      value={chapter.description ?? ""}
                      placeholder="e.g. Site selection, soil preparation and nursery hygiene for smallholders"
                      onChange={(event) => setChapter(index, { description: event.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      Sub-chapters{" "}
                      <span className="font-normal text-muted-foreground">
                        ({chapter.subChapters.length})
                      </span>
                    </p>
                    <ol className="space-y-2">
                      {chapter.subChapters.map((sub, subIndex) => {
                        const subError = errors[`sub.${index}.${subIndex}`];
                        const subId = `sub-${index}-${subIndex}`;
                        const number = `${index + 1}.${subIndex + 1}`;
                        return (
                          <li
                            key={subIndex}
                            className={cn(
                              "rounded-lg border border-l-4 border-l-primary/60 bg-background p-3",
                              subError && "border-destructive/60 border-l-destructive",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className="mt-2 shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs font-bold"
                                aria-hidden
                              >
                                {number}
                              </span>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`${subId}-title`} className="sr-only">
                                    Sub-chapter {number} title
                                  </Label>
                                  <Input
                                    id={`${subId}-title`}
                                    value={sub.title}
                                    maxLength={200}
                                    placeholder={`Sub-chapter ${number} title, e.g. Choosing the site`}
                                    aria-invalid={!!subError}
                                    aria-describedby={subError ? `${subId}-error` : undefined}
                                    autoFocus={focus === subId}
                                    onFocus={() => focus === subId && setFocus(null)}
                                    onChange={(event) =>
                                      setSub(index, subIndex, { title: event.target.value })
                                    }
                                  />
                                  <FieldError id={`${subId}-error`} message={subError} />
                                </div>
                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`${subId}-notes`}
                                    className="text-xs font-normal text-muted-foreground"
                                  >
                                    Points the AI must cover (optional)
                                  </Label>
                                  <Input
                                    id={`${subId}-notes`}
                                    value={sub.description ?? ""}
                                    maxLength={2000}
                                    placeholder="e.g. Shade, water access, drainage"
                                    className="h-8 text-sm"
                                    onChange={(event) =>
                                      setSub(index, subIndex, { description: event.target.value })
                                    }
                                  />
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <IconAction
                                  label={`Move sub-chapter ${number} up`}
                                  disabled={subIndex === 0}
                                  onClick={() =>
                                    setChapter(index, {
                                      subChapters: move(chapter.subChapters, subIndex, -1),
                                    })
                                  }
                                >
                                  <ArrowUp aria-hidden />
                                </IconAction>
                                <IconAction
                                  label={`Move sub-chapter ${number} down`}
                                  disabled={subIndex === chapter.subChapters.length - 1}
                                  onClick={() =>
                                    setChapter(index, {
                                      subChapters: move(chapter.subChapters, subIndex, 1),
                                    })
                                  }
                                >
                                  <ArrowDown aria-hidden />
                                </IconAction>
                                <IconAction
                                  label={`Remove sub-chapter ${number}`}
                                  danger
                                  disabled={chapter.subChapters.length === 1}
                                  onClick={() =>
                                    setChapter(index, {
                                      subChapters: chapter.subChapters.filter(
                                        (_, i) => i !== subIndex,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 aria-hidden />
                                </IconAction>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed"
                      disabled={chapter.subChapters.length >= MAX_SUB_CHAPTERS}
                      onClick={() => addSub(index)}
                    >
                      <Plus aria-hidden />
                      Add sub-chapter to chapter {index + 1}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-b-xl px-4 py-3 text-left text-sm text-muted-foreground hover:bg-muted/40"
                  onClick={() => toggle(index)}
                >
                  {chapter.subChapters.length} sub-chapter
                  {chapter.subChapters.length === 1 ? "" : "s"}:{" "}
                  {chapter.subChapters.map((sub) => sub.title.trim() || "Untitled").join(" · ")}{" "}
                  (click to expand)
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full border-2 border-dashed"
        disabled={chapters.length >= MAX_CHAPTERS}
        onClick={addChapter}
      >
        <Plus aria-hidden />
        Add chapter {chapters.length + 1}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Up to {MAX_CHAPTERS} chapters and {MAX_SUB_CHAPTERS} sub-chapters per chapter.
      </p>
    </section>
  );
}
