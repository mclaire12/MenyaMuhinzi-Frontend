import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PublishDialog } from "@/components/admin/publish-dialog";
import { formatDate, PageHead, Pill, RowMenu } from "@/components/admin/shell";
import { ConfirmDialog } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import { audienceCodeLabels, cropLabel, cropsQueryOptions } from "@/lib/admin/backend-groups";
import {
  adminCourseListQueryOptions,
  adminCoursesKey,
  categoryLabels,
  courseStatusLabels,
  courseStatusTone,
  generationInProgress,
  generationStatusLabels,
  generationStatusTone,
  difficultyLabels,
  type AdminCourse,
  type CourseStatusCode,
  type DifficultyCode,
} from "@/lib/admin/backend-courses";

type Search = { status?: CourseStatusCode };

export const Route = createFileRoute("/_authenticated/admin/courses/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search["status"] === "string" && search["status"] in courseStatusLabels
      ? { status: search["status"] as CourseStatusCode }
      : {}),
  }),
  component: Courses,
});

type Pending = { course: AdminCourse; kind: "unpublish" | "archive" | "delete" | "restore" } | null;

const pendingCopy = {
  unpublish: {
    title: "Unpublish this course?",
    text: "farmers stop seeing it straight away. Their progress is kept and you can publish it again.",
    label: "Unpublish",
  },
  archive: {
    title: "Archive this course?",
    text: "it is hidden from farmers and kept for its publication history. You can return it to draft later.",
    label: "Archive",
  },
  delete: {
    title: "Delete this course?",
    text: "the course, its modules and lessons are removed permanently. Only courses that were never published can be deleted.",
    label: "Delete",
  },
  restore: {
    title: "Return this course to draft?",
    text: "it becomes editable again and stays hidden from farmers until you publish it.",
    label: "Return to draft",
  },
} as const;

/** Every course on the platform, from GET /courses. */
function Courses() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/courses/" });
  const queryClient = useQueryClient();
  const { permissions, loading: authLoading } = useAuth();
  const canRead = permissions.includes("courses:read");
  const canManage = permissions.includes("courses:manage");
  const canPublish = permissions.includes("courses:publish");
  const canGenerate = permissions.includes("course-generations:create");
  const canReadGenerations = permissions.includes("course-generations:read");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cropId, setCropId] = useState("all");
  const [difficulty, setDifficulty] = useState<DifficultyCode | "all">("all");
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState<AdminCourse | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const status = search.status ?? "all";

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => setPage(1), [status]);

  const enabled = canRead && !authLoading;
  const crops = useQuery(cropsQueryOptions(enabled));
  const list = useQuery({
    ...adminCourseListQueryOptions(
      {
        page,
        ...(debounced ? { search: debounced } : {}),
        ...(status !== "all" ? { status } : {}),
        ...(cropId !== "all" ? { cropId } : {}),
        ...(difficulty !== "all" ? { difficulty } : {}),
      },
      enabled,
    ),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminCoursesKey });
  const act = useMutation({
    mutationFn: ({ course, kind }: NonNullable<Pending>) => {
      if (kind === "unpublish")
        return adminApi("POST", `courses/${course.id}/unpublish`, { body: {} });
      if (kind === "delete") return adminApi("DELETE", `courses/${course.id}`);
      return adminApi("PATCH", `courses/${course.id}`, {
        body: { status: kind === "archive" ? "ARCHIVED" : "DRAFT" },
      });
    },
    onSuccess: async (_result, { kind, course }) => {
      await refresh();
      toast.success(
        kind === "unpublish"
          ? `${course.title} unpublished. Farmers no longer see it.`
          : kind === "archive"
            ? `${course.title} archived.`
            : kind === "delete"
              ? `${course.title} deleted.`
              : `${course.title} is a draft again.`,
      );
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The action could not be completed.")),
    onSettled: () => setPending(null),
  });

  const head = (
    <PageHead
      title="Courses"
      text="Every course is generated by AI from a structure you design, then reviewed and published to the entire platform or to selected groups."
    >
      {canGenerate && (
        <Button asChild>
          <Link to="/admin/courses/generate">
            <Sparkles aria-hidden />
            Generate course
          </Link>
        </Button>
      )}
      {canReadGenerations && (
        <Button asChild variant="outline">
          <Link to="/admin/courses/generate" search={{ tab: "requests" }}>
            Generation requests
          </Link>
        </Button>
      )}
    </PageHead>
  );
  if (authLoading)
    return (
      <>
        {head}
        <p className="fac-empty">Loading courses…</p>
      </>
    );
  if (!canRead)
    return (
      <>
        {head}
        <p className="fac-empty">You do not have permission to view courses.</p>
      </>
    );

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);

  return (
    <>
      {head}
      <div className="admin-filters">
        <input
          aria-label="Search courses"
          placeholder="Search courses"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(event) =>
            void navigate({
              search:
                event.target.value === "all"
                  ? {}
                  : { status: event.target.value as CourseStatusCode },
            })
          }
        >
          <option value="all">All statuses</option>
          {(Object.keys(courseStatusLabels) as CourseStatusCode[]).map((item) => (
            <option key={item} value={item}>
              {courseStatusLabels[item]}
            </option>
          ))}
        </select>
        <select
          aria-label="Crop"
          value={cropId}
          onChange={(event) => {
            setCropId(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All crops</option>
          {(crops.data ?? []).map((crop) => (
            <option key={crop.id} value={crop.id}>
              {cropLabel(crop)}
            </option>
          ))}
        </select>
        <select
          aria-label="Level"
          value={difficulty}
          onChange={(event) => {
            setDifficulty(event.target.value as DifficultyCode | "all");
            setPage(1);
          }}
        >
          <option value="all">All levels</option>
          {(Object.keys(difficultyLabels) as DifficultyCode[]).map((item) => (
            <option key={item} value={item}>
              {difficultyLabels[item]}
            </option>
          ))}
        </select>
      </div>
      {list.isError ? (
        <div className="fac-empty" role="alert">
          <p>{adminErrorMessage(list.error, "Courses could not be loaded from the server.")}</p>
          <Button className="mt-3" variant="outline" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : list.isLoading ? (
        <p className="fac-empty">Loading courses…</p>
      ) : !rows.length ? (
        <p className="fac-empty">
          {meta?.total === 0 &&
          !debounced &&
          status === "all" &&
          cropId === "all" &&
          difficulty === "all"
            ? "No courses yet. Generate the first one."
            : "No courses match these filters."}
        </p>
      ) : (
        <>
          <div className="staff-table" aria-busy={list.isFetching}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Crop</th>
                  <th>Category</th>
                  <th>Level</th>
                  <th>Audience</th>
                  <th>Creator</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        className="font-bold"
                        to="/admin/courses/$courseId"
                        params={{ courseId: item.id }}
                      >
                        {item.title}
                      </Link>
                      <small className="block text-muted-foreground">{item.shortDescription}</small>
                    </td>
                    <td>{cropLabel(item.crop)}</td>
                    <td>{categoryLabels[item.category]}</td>
                    <td>{difficultyLabels[item.difficulty]}</td>
                    <td>
                      {item.facilitatorOwner ? (
                        <>
                          Facilitator groups
                          <small className="block text-muted-foreground">
                            {item.facilitatorOwner.fullName}
                          </small>
                        </>
                      ) : (
                        audienceCodeLabels[item.targetAudience]
                      )}
                    </td>
                    <td>{item.createdBy.fullName}</td>
                    <td>
                      <Pill tone={courseStatusTone(item.status)}>
                        {courseStatusLabels[item.status]}
                      </Pill>
                      {item.generation && item.generation.status !== "COMPLETED" && (
                        <span className="mt-1 block">
                          <Pill tone={generationStatusTone(item.generation.status)}>
                            {generationStatusLabels[item.generation.status]}
                          </Pill>
                        </span>
                      )}
                    </td>
                    <td>{item.publishedAt ? formatDate(item.publishedAt) : "—"}</td>
                    <td className="col-actions">
                      <RowMenu label={item.title}>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/courses/$courseId" params={{ courseId: item.id }}>
                            {item.status === "ARCHIVED" ? "View" : "Open and edit"}
                          </Link>
                        </DropdownMenuItem>
                        {canPublish &&
                          !item.facilitatorOwner &&
                          !generationInProgress(item.generation) &&
                          (item.status === "DRAFT" || item.status === "UNDER_REVIEW") && (
                            <DropdownMenuItem onSelect={() => setPublishing(item)}>
                              Publish
                            </DropdownMenuItem>
                          )}
                        {canPublish && item.status === "PUBLISHED" && (
                          <DropdownMenuItem
                            onSelect={() => setPending({ course: item, kind: "unpublish" })}
                          >
                            Unpublish
                          </DropdownMenuItem>
                        )}
                        {canManage && (
                          <>
                            <DropdownMenuSeparator />
                            {item.status === "ARCHIVED" ? (
                              <DropdownMenuItem
                                onSelect={() => setPending({ course: item, kind: "restore" })}
                              >
                                Return to draft
                              </DropdownMenuItem>
                            ) : item.status !== "PUBLISHED" ? (
                              <DropdownMenuItem
                                onSelect={() => setPending({ course: item, kind: "archive" })}
                              >
                                Archive
                              </DropdownMenuItem>
                            ) : null}
                            {item.status !== "PUBLISHED" &&
                              item.status !== "ARCHIVED" &&
                              !item.publishedAt && (
                                <DropdownMenuItem
                                  onSelect={() => setPending({ course: item, kind: "delete" })}
                                >
                                  Delete
                                </DropdownMenuItem>
                              )}
                          </>
                        )}
                      </RowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-actions mt-3 items-center">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages} · {meta?.total ?? 0} course(s)
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      <PublishDialog course={publishing} onClose={() => setPublishing(null)} />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? pendingCopy[pending.kind].title : ""}
        text={pending ? `${pending.course.title}: ${pendingCopy[pending.kind].text}` : ""}
        confirmLabel={pending ? pendingCopy[pending.kind].label : "Confirm"}
        onConfirm={() => {
          if (pending) act.mutate(pending);
        }}
      />
    </>
  );
}
