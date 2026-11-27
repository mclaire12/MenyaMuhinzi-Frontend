import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate, PageHead, Pill } from "@/components/admin/shell";
import { TargetGroupForm } from "@/components/admin/target-group-form";
import { ConfirmButton, Stat } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import {
  adminGroupCoursesQueryOptions,
  adminGroupQueryOptions,
  adminGroupsKey,
  audienceCodeLabels,
  cropLabel,
  groupBody,
  groupPlace,
  groupValuesFrom,
  recordStatusLabels,
  recordStatusTone,
  type AdminGroup,
  type AdminGroupValues,
} from "@/lib/admin/backend-groups";
import { provinceLabels } from "@/lib/admin/backend-people";
import { parseBffError } from "@/lib/auth/parse-bff-error";

export const Route = createFileRoute("/_authenticated/admin/groups/$groupId")({
  component: GroupPage,
});

const courseStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

/** One course-targeting group (GET /admin/groups/:id) and the courses published to it. */
function GroupPage() {
  const { groupId } = Route.useParams();
  const queryClient = useQueryClient();
  const { permissions, loading: authLoading } = useAuth();
  const canRead = permissions.includes("targeting-groups:read");
  const canManage = permissions.includes("targeting-groups:manage");
  const enabled = canRead && !authLoading;
  const group = useQuery(adminGroupQueryOptions(groupId, enabled));
  const courses = useQuery(adminGroupCoursesQueryOptions(groupId, enabled));
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminGroupsKey });
  const save = useMutation({
    mutationFn: (values: AdminGroupValues) =>
      adminApi<AdminGroup>("PATCH", `admin/groups/${groupId}`, { body: groupBody(values) }),
    onSuccess: async () => {
      await refresh();
      setEditing(false);
      setFormError("");
      toast.success("Group saved.");
    },
    onError: (error) => setFormError(adminErrorMessage(error, "The group could not be saved.")),
  });
  const setStatus = useMutation({
    mutationFn: (status: AdminGroup["status"]) =>
      adminApi<AdminGroup>("PATCH", `admin/groups/${groupId}`, { body: { status } }),
    onSuccess: async (updated) => {
      await refresh();
      toast.success(`${updated.name} is now ${recordStatusLabels[updated.status].toLowerCase()}.`);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The status could not be changed.")),
  });

  const back = (
    <Link
      to="/admin/groups"
      className="inline-flex items-center gap-1 text-sm font-bold text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to groups
    </Link>
  );
  if (authLoading || group.isLoading)
    return (
      <>
        {back}
        <p className="fac-empty">Loading group…</p>
      </>
    );
  if (!canRead)
    return (
      <>
        {back}
        <PageHead title="Not allowed" text="You do not have permission to view groups." />
      </>
    );
  if (group.isError || !group.data) {
    const notFound = parseBffError(group.error).status === 404;
    return (
      <>
        {back}
        <PageHead
          title={notFound ? "Group not found" : "Group could not be loaded"}
          text={
            notFound ? "This group does not exist." : adminErrorMessage(group.error, "Try again.")
          }
        />
        {!notFound && (
          <Button variant="outline" onClick={() => void group.refetch()}>
            Try again
          </Button>
        )}
      </>
    );
  }

  const current = group.data;
  const published = courses.data ?? [];

  return (
    <>
      {back}
      <PageHead
        title={current.name}
        text={
          current.description ||
          `${audienceCodeLabels[current.targetAudience]} · ${cropLabel(current.crop)}`
        }
      >
        <Pill tone={recordStatusTone(current.status)}>{recordStatusLabels[current.status]}</Pill>
        {canManage && (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit group
            </Button>
            {current.status === "ACTIVE" ? (
              <ConfirmButton
                label="Deactivate"
                title={`Deactivate ${current.name}?`}
                text="Farmers who only qualify through this group stop seeing its courses. Publication history is kept."
                onConfirm={() => setStatus.mutate("INACTIVE")}
              />
            ) : (
              <ConfirmButton
                variant="default"
                label="Activate"
                title={`Activate ${current.name}?`}
                text="Courses published to this group become visible to matching farmers again."
                onConfirm={() => setStatus.mutate("ACTIVE")}
              />
            )}
          </>
        )}
      </PageHead>
      <div className="admin-stats">
        <Stat label="Estimated farmers" value={current.estimatedFarmerCount.toLocaleString()} />
        <Stat label="Courses published here" value={courses.isLoading ? "…" : published.length} />
        <Stat label="Audience" value={audienceCodeLabels[current.targetAudience]} />
      </div>
      <div className="admin-grid-2 mt-3">
        <article className="admin-panel">
          <h2 className="mb-2 font-bold">Details</h2>
          <dl className="fac-facts">
            <div>
              <dt>Location</dt>
              <dd>{groupPlace(current, (p) => provinceLabels[p])}</dd>
            </div>
            <div>
              <dt>Crop</dt>
              <dd>{cropLabel(current.crop)}</dd>
            </div>
            <div>
              <dt>Audience</dt>
              <dd>{audienceCodeLabels[current.targetAudience]}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>
                {formatDate(current.createdAt)} by {current.createdBy.fullName}
              </dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(current.updatedAt)}</dd>
            </div>
          </dl>
        </article>
        <article className="admin-panel">
          <h2 className="mb-2 font-bold">Courses published to this group</h2>
          {courses.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {adminErrorMessage(courses.error, "Courses could not be loaded.")}
            </p>
          ) : courses.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading courses…</p>
          ) : published.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No course is published to this group yet. Publish one from Courses and choose this
              group.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {published.map((course) => (
                <li key={course.publicationId}>
                  <Link
                    className="font-bold"
                    to="/admin/courses/$courseId"
                    params={{ courseId: course.courseId }}
                  >
                    {course.title}
                  </Link>{" "}
                  · {courseStatusLabels[course.status] ?? course.status} · published{" "}
                  {formatDate(course.publishedAt)} by {course.publishedBy.fullName}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
      <Dialog
        open={editing}
        onOpenChange={(open) => {
          setEditing(open);
          if (!open) setFormError("");
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {current.name}</DialogTitle>
            <DialogDescription>
              Changes apply straight away to who can see the group's published courses.
            </DialogDescription>
          </DialogHeader>
          <TargetGroupForm
            initial={groupValuesFrom(current)}
            submitLabel="Save changes"
            busy={save.isPending}
            serverError={formError}
            onCancel={() => setEditing(false)}
            onSubmit={(values) => save.mutate(values)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
