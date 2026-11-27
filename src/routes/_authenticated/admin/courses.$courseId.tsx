import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  LessonDialog,
  ModuleDialog,
  type LessonBody,
} from "@/components/admin/course-content-dialogs";
import { CourseForm } from "@/components/admin/course-form";
import { PublishDialog } from "@/components/admin/publish-dialog";
import { formatDate, formatDateTime, PageHead, Pill, Tabs } from "@/components/admin/shell";
import { ConfirmDialog, Stat } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import { audienceCodeLabels, cropLabel } from "@/lib/admin/backend-groups";
import {
  adminCourseAssessmentsQueryOptions,
  adminCoursePublicationsQueryOptions,
  adminCourseQueryOptions,
  adminCoursesKey,
  adminCourseStructureQueryOptions,
  categoryLabels,
  courseBody,
  courseStatusLabels,
  courseStatusTone,
  courseValuesFrom,
  difficultyLabels,
  courseGenerationQueryOptions,
  formatMinutes,
  generationInProgress,
  generationStatusLabels,
  generationStatusTone,
  languageLabels,
  learningFormatLabels,
  lessonTypeLabels,
  type AdminCourse,
  type CourseLesson,
  type CourseModule,
  type CourseFormValues,
} from "@/lib/admin/backend-courses";
import { parseBffError } from "@/lib/auth/parse-bff-error";

export const Route = createFileRoute("/_authenticated/admin/courses/$courseId")({
  component: CoursePage,
});

type Tab = "structure" | "generation" | "details" | "assessments" | "history";
type Confirm =
  | { kind: "unpublish" | "archive" | "restore" | "submit" | "delete" }
  | { kind: "delete-module"; module: CourseModule }
  | { kind: "delete-lesson"; lesson: CourseLesson }
  | null;

const confirmCopy: Record<string, { title: string; text: string; label: string }> = {
  unpublish: {
    title: "Unpublish this course?",
    text: "Farmers stop seeing it straight away. Their progress is kept.",
    label: "Unpublish",
  },
  archive: {
    title: "Archive this course?",
    text: "It is hidden from farmers and can no longer be edited until it is returned to draft.",
    label: "Archive",
  },
  restore: {
    title: "Return this course to draft?",
    text: "It becomes editable again and stays hidden until you publish it.",
    label: "Return to draft",
  },
  submit: {
    title: "Submit this course for review?",
    text: "It is marked as under review. You can still publish it or return it to draft.",
    label: "Submit for review",
  },
  delete: {
    title: "Delete this course?",
    text: "The course, its modules and lessons are removed permanently.",
    label: "Delete course",
  },
  "delete-module": {
    title: "Delete this chapter?",
    text: "The chapter and all of its sub-chapters are removed permanently.",
    label: "Delete chapter",
  },
  "delete-lesson": {
    title: "Delete this sub-chapter?",
    text: "The sub-chapter is removed permanently.",
    label: "Delete sub-chapter",
  },
};

/** One course from the backend: structure, details, assessments and publication history. */
function CoursePage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions, loading: authLoading } = useAuth();
  const canRead = permissions.includes("courses:read");
  const canManage = permissions.includes("courses:manage");
  const canPublish = permissions.includes("courses:publish");
  const enabled = canRead && !authLoading;
  const course = useQuery(adminCourseQueryOptions(courseId, enabled));
  const structure = useQuery(adminCourseStructureQueryOptions(courseId, enabled));
  const [tab, setTab] = useState<Tab>("structure");
  const [publishing, setPublishing] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [moduleDialog, setModuleDialog] = useState<{ module: CourseModule | null } | null>(null);
  const [lessonDialog, setLessonDialog] = useState<{
    moduleId: string;
    lesson: CourseLesson | null;
  } | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [detailsError, setDetailsError] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminCoursesKey });

  const saveDetails = useMutation({
    mutationFn: (values: CourseFormValues) =>
      adminApi<AdminCourse>("PATCH", `courses/${courseId}`, { body: courseBody(values) }),
    onSuccess: async () => {
      await refresh();
      setDetailsError("");
      toast.success("Course details saved.");
    },
    onError: (error) =>
      setDetailsError(adminErrorMessage(error, "The details could not be saved.")),
  });

  const runAction = useMutation({
    mutationFn: async (action: NonNullable<Confirm>) => {
      switch (action.kind) {
        case "unpublish":
          return adminApi("POST", `courses/${courseId}/unpublish`, { body: {} });
        case "archive":
          return adminApi("PATCH", `courses/${courseId}`, { body: { status: "ARCHIVED" } });
        case "restore":
          return adminApi("PATCH", `courses/${courseId}`, { body: { status: "DRAFT" } });
        case "submit":
          return adminApi("PATCH", `courses/${courseId}`, { body: { status: "UNDER_REVIEW" } });
        case "delete":
          return adminApi("DELETE", `courses/${courseId}`);
        case "delete-module":
          return adminApi("DELETE", `modules/${action.module.id}`);
        case "delete-lesson":
          return adminApi("DELETE", `lessons/${action.lesson.id}`);
      }
    },
    onSuccess: async (_result, action) => {
      if (action.kind === "delete") {
        await refresh();
        toast.success("Course deleted.");
        void navigate({ to: "/admin/courses" });
        return;
      }
      await refresh();
      const done: Record<string, string> = {
        unpublish: "Course unpublished.",
        archive: "Course archived.",
        restore: "Course returned to draft.",
        submit: "Course submitted for review.",
        "delete-module": "Chapter deleted.",
        "delete-lesson": "Sub-chapter deleted.",
      };
      toast.success(done[action.kind] ?? "Done.");
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The action could not be completed.")),
    onSettled: () => setConfirm(null),
  });

  const saveModule = useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: object }) =>
      id
        ? adminApi("PATCH", `modules/${id}`, { body })
        : adminApi("POST", `courses/${courseId}/modules`, { body }),
    onSuccess: async (_r, { id }) => {
      await refresh();
      setModuleDialog(null);
      setDialogError("");
      toast.success(id ? "Chapter saved." : "Chapter added.");
    },
    onError: (error) => setDialogError(adminErrorMessage(error, "The module could not be saved.")),
  });

  const saveLesson = useMutation({
    mutationFn: ({
      moduleId,
      id,
      body,
    }: {
      moduleId: string;
      id: string | null;
      body: LessonBody;
    }) =>
      id
        ? adminApi("PATCH", `lessons/${id}`, { body })
        : adminApi("POST", `modules/${moduleId}/lessons`, { body }),
    onSuccess: async (_r, { id }) => {
      await refresh();
      setLessonDialog(null);
      setDialogError("");
      toast.success(id ? "Sub-chapter saved." : "Sub-chapter added.");
    },
    onError: (error) => setDialogError(adminErrorMessage(error, "The lesson could not be saved.")),
  });

  const back = (
    <Link
      to="/admin/courses"
      className="inline-flex items-center gap-1 text-sm font-bold text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to courses
    </Link>
  );
  if (authLoading || course.isLoading)
    return (
      <>
        {back}
        <p className="fac-empty">Loading course…</p>
      </>
    );
  if (!canRead)
    return (
      <>
        {back}
        <PageHead title="Not allowed" text="You do not have permission to view courses." />
      </>
    );
  if (course.isError || !course.data) {
    const notFound = parseBffError(course.error).status === 404;
    return (
      <>
        {back}
        <PageHead
          title={notFound ? "Course not found" : "Course could not be loaded"}
          text={
            notFound
              ? "This course does not exist or was deleted."
              : adminErrorMessage(course.error, "Try again.")
          }
        />
        {!notFound && (
          <Button variant="outline" onClick={() => void course.refetch()}>
            Try again
          </Button>
        )}
      </>
    );
  }

  const current = course.data;
  const editable = canManage && current.status !== "ARCHIVED";
  const modules = structure.data ?? [];
  const lessons = modules.flatMap((module) => module.lessons);
  const readyLessons = lessons.filter((lesson) => lesson.status === "PUBLISHED").length;
  const busy = runAction.isPending;
  const writing = generationInProgress(current.generation);

  return (
    <>
      {back}
      <PageHead
        title={current.title}
        text={`${difficultyLabels[current.difficulty]} · ${languageLabels[current.language]} · ${formatMinutes(current.estimatedDurationMinutes)} · created by ${current.createdBy.fullName}`}
      >
        <Pill tone={courseStatusTone(current.status)}>{courseStatusLabels[current.status]}</Pill>
      </PageHead>
      <div className="admin-actions mb-3">
        {canPublish &&
          !current.facilitatorOwner &&
          (current.status === "DRAFT" || current.status === "UNDER_REVIEW") && (
            <Button size="sm" onClick={() => setPublishing(true)} disabled={busy || writing}>
              Publish
            </Button>
          )}
        {canPublish && current.status === "PUBLISHED" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm({ kind: "unpublish" })}
            disabled={busy}
          >
            Unpublish
          </Button>
        )}
        {canManage && current.status === "DRAFT" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm({ kind: "submit" })}
            disabled={busy}
          >
            Submit for review
          </Button>
        )}
        {canManage && (current.status === "UNDER_REVIEW" || current.status === "ARCHIVED") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm({ kind: "restore" })}
            disabled={busy}
          >
            Return to draft
          </Button>
        )}
        {canManage && (current.status === "DRAFT" || current.status === "UNDER_REVIEW") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm({ kind: "archive" })}
            disabled={busy}
          >
            Archive
          </Button>
        )}
        {canManage &&
          current.status !== "PUBLISHED" &&
          current.status !== "ARCHIVED" &&
          !current.publishedAt && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirm({ kind: "delete" })}
              disabled={busy}
            >
              Delete
            </Button>
          )}
      </div>
      {writing && current.generation && (
        <p className="fac-note mb-3" role="status">
          <b>{generationStatusLabels[current.generation.status]}.</b> The structure is saved. The AI
          model writes the content of every sub-chapter once it is connected; until then the course
          cannot be published.
        </p>
      )}
      {current.generation?.status === "FAILED" && (
        <p className="fac-error mb-3">
          <span>AI generation failed. See the Generation tab for details.</span>
        </p>
      )}
      {current.facilitatorOwner && (
        <p className="fac-note mb-3">
          Facilitator course by <b>{current.facilitatorOwner.fullName}</b>.{" "}
          {current.sharedWithGroups.length
            ? `Published to: ${current.sharedWithGroups.map((group) => group.name).join(", ")}.`
            : "Not published to any group yet."}{" "}
          It is only shared with that facilitator's groups and is never published platform-wide.
        </p>
      )}
      {current.status === "PUBLISHED" && (
        <p className="fac-note">
          Published {formatDate(current.publishedAt)}. Edits you make go live straight away.
        </p>
      )}
      {current.status === "ARCHIVED" && (
        <p className="fac-note">
          This course is archived. Return it to draft to edit or publish it again.
        </p>
      )}
      <div className="admin-stats">
        <Stat label="Crop" value={cropLabel(current.crop)} />
        <Stat
          label="Audience"
          value={
            current.facilitatorOwner
              ? `Groups of ${current.facilitatorOwner.fullName}`
              : audienceCodeLabels[current.targetAudience]
          }
        />
        <Stat label="Chapters" value={structure.isLoading ? "…" : modules.length} />
        <Stat
          label="Sub-chapters"
          value={structure.isLoading ? "…" : lessons.length}
          hint={`${readyLessons} ready for farmers`}
        />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "structure", label: "Chapters & sub-chapters" },
          ...(current.generation ? [{ value: "generation" as const, label: "AI generation" }] : []),
          { value: "details", label: "Course details" },
          { value: "assessments", label: "Assessments" },
          { value: "history", label: "Publication history" },
        ]}
      />

      {tab === "structure" && (
        <section className="space-y-3">
          {structure.isError ? (
            <p className="fac-empty" role="alert">
              {adminErrorMessage(structure.error, "Chapters could not be loaded.")}
            </p>
          ) : structure.isLoading ? (
            <p className="fac-empty">Loading modules…</p>
          ) : modules.length === 0 ? (
            <p className="fac-empty">No chapters yet.</p>
          ) : (
            modules.map((module, index) => (
              <article key={module.id} className="admin-panel">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold">
                      {index + 1}. {module.title}{" "}
                      <Pill tone={module.status === "PUBLISHED" ? "ok" : "muted"}>
                        {module.status === "PUBLISHED" ? "Ready" : "Draft"}
                      </Pill>
                    </h2>
                    {module.description && (
                      <p className="text-sm text-muted-foreground">{module.description}</p>
                    )}
                  </div>
                  {editable && (
                    <div className="admin-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDialogError("");
                          setLessonDialog({ moduleId: module.id, lesson: null });
                        }}
                      >
                        <Plus aria-hidden />
                        Add sub-chapter
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDialogError("");
                          setModuleDialog({ module });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirm({ kind: "delete-module", module })}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
                {module.lessons.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No sub-chapters in this chapter yet.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y text-sm">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <li
                        key={lesson.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <span>
                          <b>
                            {index + 1}.{lessonIndex + 1} {lesson.title}
                          </b>{" "}
                          · {lessonTypeLabels[lesson.lessonType]} ·{" "}
                          {formatMinutes(lesson.estimatedDurationMinutes)} ·{" "}
                          {lesson.status === "PUBLISHED" ? "Ready" : "Draft"}
                        </span>
                        {editable && (
                          <span className="admin-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDialogError("");
                                setLessonDialog({ moduleId: module.id, lesson });
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirm({ kind: "delete-lesson", lesson })}
                            >
                              Delete
                            </Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))
          )}
          {editable && (
            <Button
              variant="outline"
              onClick={() => {
                setDialogError("");
                setModuleDialog({ module: null });
              }}
            >
              <Plus aria-hidden />
              Add chapter
            </Button>
          )}
        </section>
      )}

      {tab === "details" && (
        <section className="admin-panel">
          <p className="mb-3 text-sm text-muted-foreground">
            Category: {categoryLabels[current.category]} · last updated{" "}
            {formatDateTime(current.updatedAt)}
          </p>
          <CourseForm
            key={current.updatedAt}
            initial={courseValuesFrom(current)}
            submitLabel="Save details"
            busy={saveDetails.isPending}
            serverError={detailsError}
            disabled={!editable}
            onSubmit={(values) => saveDetails.mutate(values)}
          />
        </section>
      )}

      {tab === "assessments" && <Assessments courseId={courseId} />}
      {tab === "history" && <History courseId={courseId} />}
      {tab === "generation" && current.generation && <Generation id={current.generation.id} />}

      {publishing && <PublishDialog course={current} onClose={() => setPublishing(false)} />}
      <ModuleDialog
        open={!!moduleDialog}
        module={moduleDialog?.module ?? null}
        busy={saveModule.isPending}
        error={dialogError}
        onClose={() => setModuleDialog(null)}
        onSave={(body) => saveModule.mutate({ id: moduleDialog?.module?.id ?? null, body })}
      />
      <LessonDialog
        open={!!lessonDialog}
        lesson={lessonDialog?.lesson ?? null}
        language={current.language}
        busy={saveLesson.isPending}
        error={dialogError}
        onClose={() => setLessonDialog(null)}
        onSave={(body) =>
          lessonDialog &&
          saveLesson.mutate({
            moduleId: lessonDialog.moduleId,
            id: lessonDialog.lesson?.id ?? null,
            body,
          })
        }
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm ? (confirmCopy[confirm.kind]?.title ?? "") : ""}
        text={
          confirm
            ? `${confirm.kind === "delete-module" ? `${confirm.module.title}: ` : confirm.kind === "delete-lesson" ? `${confirm.lesson.title}: ` : ""}${confirmCopy[confirm.kind]?.text ?? ""}`
            : ""
        }
        confirmLabel={confirm ? (confirmCopy[confirm.kind]?.label ?? "Confirm") : "Confirm"}
        onConfirm={() => {
          if (confirm) runAction.mutate(confirm);
        }}
      />
    </>
  );
}

function Assessments({ courseId }: { courseId: string }) {
  const assessments = useQuery(adminCourseAssessmentsQueryOptions(courseId, true));
  if (assessments.isError) {
    return (
      <p className="fac-empty" role="alert">
        {adminErrorMessage(assessments.error, "Assessments could not be loaded.")}
      </p>
    );
  }
  if (assessments.isLoading) return <p className="fac-empty">Loading assessments…</p>;
  const rows = assessments.data ?? [];
  if (!rows.length) return <p className="fac-empty">No assessment is linked to this course yet.</p>;
  return (
    <div className="staff-table">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Assessment</th>
            <th>Linked to</th>
            <th>Pass mark</th>
            <th>Attempts</th>
            <th>Time limit</th>
            <th>Questions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <b>{item.title}</b>
                {item.description && (
                  <small className="block text-muted-foreground">{item.description}</small>
                )}
              </td>
              <td>{item.lessonId ? "Sub-chapter" : item.moduleId ? "Chapter" : "Whole course"}</td>
              <td>{item.passingScore}%</td>
              <td>{item.maxAttempts}</td>
              <td>{item.timeLimitMinutes ? `${item.timeLimitMinutes} min` : "None"}</td>
              <td>{Array.isArray(item.questions) ? item.questions.length : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function History({ courseId }: { courseId: string }) {
  const history = useQuery(adminCoursePublicationsQueryOptions(courseId, true));
  if (history.isError) {
    return (
      <p className="fac-empty" role="alert">
        {adminErrorMessage(history.error, "Publication history could not be loaded.")}
      </p>
    );
  }
  if (history.isLoading) return <p className="fac-empty">Loading history…</p>;
  const rows = history.data ?? [];
  if (!rows.length) return <p className="fac-empty">This course has never been published.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.id} className="admin-panel">
          <b>
            {row.scope === "PLATFORM"
              ? "Entire platform"
              : `Groups: ${row.targetingGroups.map((g) => g.name).join(", ")}`}
          </b>
          {row.isCurrent && (
            <>
              {" "}
              <Pill tone="ok">Current</Pill>
            </>
          )}
          <span className="block text-muted-foreground">
            Published {formatDateTime(row.publishedAt)} by {row.publishedBy.fullName}
            {row.unpublishedAt
              ? ` · unpublished ${formatDateTime(row.unpublishedAt)}${row.unpublishedBy ? ` by ${row.unpublishedBy.fullName}` : ""}`
              : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** What the administrator asked the AI for: structure, formats, sources and instructions. */
function Generation({ id }: { id: string }) {
  const generation = useQuery(courseGenerationQueryOptions(id, true));
  if (generation.isError) {
    return (
      <p className="fac-empty" role="alert">
        {adminErrorMessage(generation.error, "The generation request could not be loaded.")}
      </p>
    );
  }
  if (!generation.data) return <p className="fac-empty">Loading…</p>;
  const data = generation.data;
  return (
    <section className="space-y-3">
      <article className="admin-panel space-y-1 text-sm">
        <p>
          <Pill tone={generationStatusTone(data.status)}>
            {generationStatusLabels[data.status]}
          </Pill>{" "}
          {data.statusMessage}
        </p>
        <p>
          Requested {formatDateTime(data.createdAt)} by {data.requestedBy.fullName}
          {data.completedAt ? ` · finished ${formatDateTime(data.completedAt)}` : ""}
        </p>
        <p>
          Learning formats:{" "}
          {data.contentFormats.map((format) => learningFormatLabels[format]).join(", ")}
        </p>
        <p>
          Knowledge Base documents:{" "}
          {data.knowledgeSources.length
            ? data.knowledgeSources.map((source) => source.title).join(", ")
            : "none chosen"}
        </p>
      </article>
      <article className="admin-panel">
        <h2 className="mb-2 font-bold">Instructions for the AI</h2>
        <p className="whitespace-pre-wrap text-sm">{data.brief}</p>
      </article>
      <article className="admin-panel">
        <h2 className="mb-2 font-bold">Requested structure</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {data.chapters.map((chapter, index) => (
            <li key={index}>
              <b>{chapter.title}</b>
              {chapter.description ? ` · ${chapter.description}` : ""}
              <ol className="mt-1 list-[lower-alpha] pl-5">
                {chapter.subChapters.map((sub, subIndex) => (
                  <li key={subIndex}>
                    {sub.title}
                    {sub.description ? (
                      <span className="text-muted-foreground"> · {sub.description}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}
