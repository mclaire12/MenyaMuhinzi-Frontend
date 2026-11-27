import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { formatDate, formatDateTime, Pill, Tabs } from "@/components/admin/shell";
import { PageHead } from "@/components/facilitator/shell";
import { PublishToGroupsDialog } from "@/components/facilitator/group-course-actions";
import { publishBlocker, useUnpublishFromGroups } from "@/lib/facilitator/group-course-publish";
import { ConfirmDialog, Stat } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { adminErrorMessage } from "@/lib/admin/api";
import { audienceCodeLabels, cropLabel } from "@/lib/admin/backend-groups";
import {
  adminCourseQueryOptions,
  adminCourseStructureQueryOptions,
  categoryLabels,
  courseGenerationQueryOptions,
  difficultyLabels,
  formatMinutes,
  generationInProgress,
  generationStatusLabels,
  generationStatusTone,
  languageLabels,
  learningFormatLabels,
  lessonTypeLabels,
} from "@/lib/admin/backend-courses";
import { groupCourseStatusLabels } from "@/lib/facilitator/backend-courses";
import { parseBffError } from "@/lib/auth/parse-bff-error";

export const Route = createFileRoute("/_authenticated/facilitator/courses/$courseId")({
  component: CoursePage,
});

type Tab = "structure" | "generation";

/** A course as the facilitator sees it; their own group courses can be published to that group. */
function CoursePage() {
  const { courseId } = Route.useParams();
  const { permissions, loading } = useAuth();
  const enabled = permissions.includes("courses:read") && !loading;
  const course = useQuery(adminCourseQueryOptions(courseId, enabled));
  const structure = useQuery(adminCourseStructureQueryOptions(courseId, enabled));
  const [tab, setTab] = useState<Tab>("structure");
  const [publishing, setPublishing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const unpublish = useUnpublishFromGroups();

  const back = (
    <Link
      to="/facilitator/courses"
      className="inline-flex items-center gap-1 text-sm font-bold text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to courses
    </Link>
  );
  if (loading || course.isLoading)
    return (
      <>
        {back}
        <p className="fac-empty">Loading course…</p>
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
              ? "This course does not exist or is not available to you."
              : adminErrorMessage(course.error, "Try again.")
          }
        />
      </>
    );
  }

  const current = course.data;
  const ownGroupCourse = !!current.facilitatorOwner;
  const blocker = publishBlocker(current);
  const groupNames = current.sharedWithGroups.map((group) => group.name).join(", ");
  const writing = generationInProgress(current.generation);
  const chapters = structure.data ?? [];
  const subChapters = chapters.flatMap((chapter) => chapter.lessons);

  return (
    <>
      {back}
      <PageHead
        title={current.title}
        text={`${difficultyLabels[current.difficulty]} · ${languageLabels[current.language]} · ${formatMinutes(current.estimatedDurationMinutes)} · ${categoryLabels[current.category]}`}
      >
        <Pill
          tone={
            current.status === "PUBLISHED" ? "ok" : current.status === "ARCHIVED" ? "muted" : "info"
          }
        >
          {ownGroupCourse ? groupCourseStatusLabels[current.status] : "Published"}
        </Pill>
        {ownGroupCourse && (
          <Button
            onClick={() => setPublishing(true)}
            disabled={!!blocker || unpublish.isPending}
            title={blocker ?? undefined}
          >
            {current.status === "PUBLISHED" ? "Change groups" : "Publish to groups"}
          </Button>
        )}
        {ownGroupCourse && current.status === "PUBLISHED" && (
          <Button
            variant="outline"
            onClick={() => setWithdrawing(true)}
            disabled={unpublish.isPending}
          >
            Stop publishing
          </Button>
        )}
      </PageHead>

      {writing && current.generation && (
        <p className="fac-note mb-3" role="status">
          <b>{generationStatusLabels[current.generation.status]}.</b> The structure you designed is
          saved. The AI model writes every sub-chapter once it is connected; you can publish the
          course to your group after that.
        </p>
      )}
      {ownGroupCourse && (
        <p className="fac-note mb-3">
          {current.status === "PUBLISHED"
            ? `Published ${formatDate(current.publishedAt)} to ${groupNames}. Only farmers in these groups see it.`
            : "Not published yet. When the AI has finished, publish it to one or more of your groups; it is never published to the whole platform."}
        </p>
      )}

      <div className="admin-stats">
        <Stat label="Crop" value={cropLabel(current.crop)} />
        <Stat
          label="Published to"
          value={
            current.facilitatorOwner
              ? groupNames || "Your groups (not published yet)"
              : audienceCodeLabels[current.targetAudience]
          }
        />
        <Stat label="Chapters" value={structure.isLoading ? "…" : chapters.length} />
        <Stat label="Sub-chapters" value={structure.isLoading ? "…" : subChapters.length} />
      </div>
      {current.learningObjectives.length > 0 && (
        <article className="admin-panel mb-3">
          <h2 className="mb-1 font-bold">Learning objectives</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {current.learningObjectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </article>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "structure", label: "Chapters & sub-chapters" },
          ...(current.generation && ownGroupCourse
            ? [{ value: "generation" as const, label: "AI generation" }]
            : []),
        ]}
      />
      {tab === "structure" &&
        (structure.isError ? (
          <p className="fac-empty" role="alert">
            {adminErrorMessage(structure.error, "Chapters could not be loaded.")}
          </p>
        ) : structure.isLoading ? (
          <p className="fac-empty">Loading chapters…</p>
        ) : chapters.length === 0 ? (
          <p className="fac-empty">No chapters yet.</p>
        ) : (
          <ol className="space-y-3">
            {chapters.map((chapter, index) => (
              <li key={chapter.id} className="admin-panel">
                <h2 className="font-bold">
                  Chapter {index + 1}. {chapter.title}
                </h2>
                {chapter.description && (
                  <p className="text-sm text-muted-foreground">{chapter.description}</p>
                )}
                <ul className="mt-2 divide-y text-sm">
                  {chapter.lessons.map((lesson, subIndex) => (
                    <li key={lesson.id} className="py-2">
                      <b>
                        {index + 1}.{subIndex + 1} {lesson.title}
                      </b>{" "}
                      · {lessonTypeLabels[lesson.lessonType]} ·{" "}
                      {formatMinutes(lesson.estimatedDurationMinutes)}
                      {lesson.description && (
                        <span className="block text-muted-foreground">{lesson.description}</span>
                      )}
                      {!lesson.mainContent && writing && (
                        <span className="block text-xs text-muted-foreground">
                          Content will be written by the AI.
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ))}
      {tab === "generation" && current.generation && <Generation id={current.generation.id} />}

      <PublishToGroupsDialog
        course={publishing ? current : null}
        onClose={() => setPublishing(false)}
      />
      <ConfirmDialog
        open={withdrawing}
        onOpenChange={setWithdrawing}
        title="Stop publishing this course?"
        text={`Farmers in ${groupNames || "your groups"} stop seeing it. Their progress is kept and you can publish it again.`}
        confirmLabel="Stop publishing"
        onConfirm={() => {
          unpublish.mutate(current);
          setWithdrawing(false);
        }}
      />
    </>
  );
}

function Generation({ id }: { id: string }) {
  const generation = useQuery(courseGenerationQueryOptions(id, true));
  if (generation.isError) {
    return (
      <p className="fac-empty" role="alert">
        {adminErrorMessage(generation.error, "The request could not be loaded.")}
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
        <p>Requested {formatDateTime(data.createdAt)}</p>
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
    </section>
  );
}
