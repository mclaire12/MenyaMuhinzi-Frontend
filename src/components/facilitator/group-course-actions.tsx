import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import { cropLabel } from "@/lib/admin/backend-groups";
import {
  adminCoursesKey,
  generationInProgress,
  type AdminCourse,
} from "@/lib/admin/backend-courses";
import { facilitatorGroupsQueryOptions } from "@/lib/facilitator/backend-courses";
import { useRefreshFacilitatorCourses } from "@/lib/facilitator/group-course-publish";

/**
 * Publish a facilitator course to one or more of their own groups (PUT /courses/:id/groups).
 * Opening it on a published course lets the facilitator change the groups.
 */
export function PublishToGroupsDialog({
  course,
  onClose,
}: {
  course: AdminCourse | null;
  onClose: () => void;
}) {
  const refresh = useRefreshFacilitatorCourses();
  const groups = useQuery(facilitatorGroupsQueryOptions(!!course));
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setSelected(course?.sharedWithGroups.map((group) => group.id) ?? []);
    setError("");
  }, [course]);

  const publish = useMutation({
    mutationFn: () =>
      adminApi<AdminCourse>("PUT", `courses/${course?.id}/groups`, {
        body: { groupIds: selected },
      }),
    onSuccess: async (updated) => {
      await refresh();
      toast.success(
        `${updated.title} is published to ${updated.sharedWithGroups.map((group) => group.name).join(", ")}.`,
      );
      onClose();
    },
    onError: (failure) =>
      setError(adminErrorMessage(failure, "The course could not be published.")),
  });

  const republish = course?.status === "PUBLISHED";
  return (
    <Dialog open={!!course} onOpenChange={(open) => !open && !publish.isPending && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{republish ? "Change the groups" : "Publish to your groups"}</DialogTitle>
          <DialogDescription>
            {course?.title}: only farmers in the groups you choose will see this course. It is never
            published to the whole platform.
          </DialogDescription>
        </DialogHeader>
        {groups.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {adminErrorMessage(groups.error, "Your groups could not be loaded.")}
          </p>
        ) : groups.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your groups…</p>
        ) : !groups.data?.length ? (
          <p className="text-sm text-muted-foreground">
            You have no active groups yet.{" "}
            <Link className="font-bold text-primary" to="/facilitator/groups">
              Create a group
            </Link>{" "}
            first.
          </p>
        ) : (
          <fieldset className="space-y-2" disabled={publish.isPending}>
            <legend className="mb-1 text-sm font-semibold">Choose one or more groups</legend>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setSelected(groups.data.map((group) => group.id))}
              >
                Select all
              </button>
              <span aria-hidden>·</span>
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setSelected([])}
              >
                Clear
              </button>
            </div>
            {groups.data.map((group) => (
              <label
                key={group.id}
                className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(group.id)}
                  onChange={(event) => {
                    setError("");
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, group.id]
                        : current.filter((id) => id !== group.id),
                    );
                  }}
                />
                <span className="text-sm">
                  <b>{group.name}</b>
                  <small className="block text-muted-foreground">
                    {cropLabel(group.crop)} · {group.location.district}
                    {group.location.sector ? `, ${group.location.sector}` : ""} ·{" "}
                    {group.memberCount} farmer(s)
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <p className="fac-field-error" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={publish.isPending}>
            Cancel
          </Button>
          <Button
            disabled={publish.isPending || !groups.data?.length}
            onClick={() => {
              if (selected.length === 0) {
                setError("Choose at least one group.");
                return;
              }
              publish.mutate();
            }}
          >
            {publish.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
            {republish
              ? "Save groups"
              : `Publish to ${selected.length || ""} group${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
