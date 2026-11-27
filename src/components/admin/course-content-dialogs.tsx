import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  languageLabels,
  lessonTypeLabels,
  splitLines,
  type ContentStatusCode,
  type CourseLesson,
  type CourseModule,
  type LanguageCode,
  type LessonTypeCode,
} from "@/lib/admin/backend-courses";

type Common = { busy: boolean; error: string; onClose: () => void };

/** Add or edit a chapter (stored as a module: POST /courses/:id/modules, PATCH /modules/:id). */
export function ModuleDialog({
  open,
  module,
  busy,
  error,
  onClose,
  onSave,
}: Common & {
  open: boolean;
  module: CourseModule | null;
  onSave: (body: {
    title: string;
    description?: string | null;
    learningObjectives: string[];
    status: ContentStatusCode;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [status, setStatus] = useState<ContentStatusCode>("DRAFT");
  const [local, setLocal] = useState("");
  useEffect(() => {
    if (!open) return;
    setTitle(module?.title ?? "");
    setDescription(module?.description ?? "");
    setObjectives(module?.learningObjectives.join("\n") ?? "");
    setStatus(module?.status ?? "DRAFT");
    setLocal("");
  }, [open, module]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setLocal("Enter a chapter title.");
      return;
    }
    const text = description.trim();
    onSave({
      title: title.trim(),
      ...(text ? { description: text } : module ? { description: null } : {}),
      learningObjectives: splitLines(objectives),
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !busy && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{module ? `Edit ${module.title}` : "Add a chapter"}</DialogTitle>
          <DialogDescription>
            Chapters group sub-chapters. Farmers see them in display order.
          </DialogDescription>
        </DialogHeader>
        <form className="admin-form" noValidate onSubmit={submit}>
          <label>
            Chapter title
            <input
              value={title}
              maxLength={200}
              onChange={(event) => {
                setTitle(event.target.value);
                setLocal("");
              }}
            />
          </label>
          <label>
            Description (optional)
            <textarea
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Learning objectives (optional, one per line)
            <textarea
              rows={2}
              value={objectives}
              onChange={(event) => setObjectives(event.target.value)}
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ContentStatusCode)}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Ready for farmers</option>
            </select>
          </label>
          {(local || error) && (
            <p className="fac-field-error" role="alert">
              {local || error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" aria-hidden />}
              {module ? "Save chapter" : "Add chapter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type LessonBody = {
  title: string;
  description?: string | null;
  lessonType: LessonTypeCode;
  mainContent?: string | null;
  contentRef?: string | null;
  learningObjectives: string[];
  language: LanguageCode;
  estimatedDurationMinutes: number;
  status: ContentStatusCode;
};

/** Add or edit a sub-chapter (stored as a lesson: POST /modules/:id/lessons, PATCH /lessons/:id). */
export function LessonDialog({
  open,
  lesson,
  language,
  busy,
  error,
  onClose,
  onSave,
}: Common & {
  open: boolean;
  lesson: CourseLesson | null;
  language: LanguageCode;
  onSave: (body: LessonBody) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lessonType, setLessonType] = useState<LessonTypeCode>("TEXT");
  const [mainContent, setMainContent] = useState("");
  const [contentRef, setContentRef] = useState("");
  const [objectives, setObjectives] = useState("");
  const [lang, setLang] = useState<LanguageCode>(language);
  const [minutes, setMinutes] = useState(10);
  const [status, setStatus] = useState<ContentStatusCode>("DRAFT");
  const [local, setLocal] = useState("");
  useEffect(() => {
    if (!open) return;
    setTitle(lesson?.title ?? "");
    setDescription(lesson?.description ?? "");
    setLessonType(lesson?.lessonType ?? "TEXT");
    setMainContent(lesson?.mainContent ?? "");
    setContentRef(lesson?.contentRef ?? "");
    setObjectives(lesson?.learningObjectives.join("\n") ?? "");
    setLang(lesson?.language ?? language);
    setMinutes(lesson?.estimatedDurationMinutes ?? 10);
    setStatus(lesson?.status ?? "DRAFT");
    setLocal("");
  }, [open, lesson, language]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setLocal("Enter a sub-chapter title.");
    if (!Number.isInteger(minutes) || minutes < 1)
      return setLocal("Enter the duration in whole minutes.");
    if (status === "PUBLISHED" && !mainContent.trim() && !contentRef.trim()) {
      return setLocal("Add the sub-chapter text or a media reference before marking it ready.");
    }
    const text = description.trim();
    const content = mainContent.trim();
    const ref = contentRef.trim();
    onSave({
      title: title.trim(),
      ...(text ? { description: text } : lesson ? { description: null } : {}),
      lessonType,
      ...(content ? { mainContent: content } : lesson ? { mainContent: null } : {}),
      ...(ref ? { contentRef: ref } : lesson ? { contentRef: null } : {}),
      learningObjectives: splitLines(objectives),
      language: lang,
      estimatedDurationMinutes: minutes,
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lesson ? `Edit ${lesson.title}` : "Add a sub-chapter"}</DialogTitle>
          <DialogDescription>
            Review or correct what the AI wrote, and the audio and video references farmers use.
          </DialogDescription>
        </DialogHeader>
        <form className="admin-form" noValidate onSubmit={submit}>
          <label>
            Sub-chapter title
            <input
              value={title}
              maxLength={200}
              onChange={(event) => {
                setTitle(event.target.value);
                setLocal("");
              }}
            />
          </label>
          <label>
            Description (optional)
            <textarea
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="fac-row">
            <label>
              Content type
              <select
                value={lessonType}
                onChange={(event) => setLessonType(event.target.value as LessonTypeCode)}
              >
                {(Object.keys(lessonTypeLabels) as LessonTypeCode[]).map((item) => (
                  <option key={item} value={item}>
                    {lessonTypeLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Language
              <select
                value={lang}
                onChange={(event) => setLang(event.target.value as LanguageCode)}
              >
                {(Object.keys(languageLabels) as LanguageCode[]).map((item) => (
                  <option key={item} value={item}>
                    {languageLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min={1}
                value={Number.isNaN(minutes) ? "" : minutes}
                onChange={(event) => setMinutes(event.target.valueAsNumber)}
              />
            </label>
          </div>
          <label>
            Text (reading)
            <textarea
              rows={8}
              maxLength={50000}
              value={mainContent}
              onChange={(event) => setMainContent(event.target.value)}
            />
          </label>
          <label>
            Audio or video reference (optional)
            <input
              value={contentRef}
              maxLength={500}
              placeholder="Link or storage key of the audio, video or document"
              onChange={(event) => setContentRef(event.target.value)}
            />
          </label>
          <label>
            Learning objectives (optional, one per line)
            <textarea
              rows={2}
              value={objectives}
              onChange={(event) => setObjectives(event.target.value)}
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ContentStatusCode)}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Ready for farmers</option>
            </select>
          </label>
          {(local || error) && (
            <p className="fac-field-error" role="alert">
              {local || error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" aria-hidden />}
              {lesson ? "Save sub-chapter" : "Add sub-chapter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
