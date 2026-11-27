import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  activeAdminGroupsQueryOptions,
  adminGroupsKey,
  cropLabel,
} from "@/lib/admin/backend-groups";
import {
  adminCoursesKey,
  type AdminCourse,
  type CoursePublication,
} from "@/lib/admin/backend-courses";
import { platformSettingsQueryOptions } from "@/lib/admin/backend-settings";

type Props = { course: AdminCourse | null; onClose: () => void };

/** Publishes a course to the whole platform or to selected targeting groups (POST /courses/:id/publish). */
export function PublishDialog({ course, onClose }: Props) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"PLATFORM" | "TARGETED">("PLATFORM");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const groups = useQuery(activeAdminGroupsQueryOptions(!!course));
  const settings = useQuery(platformSettingsQueryOptions(!!course));
  // Start from the administrator's saved default audience (Settings → Defaults).
  const defaultScope = settings.data?.defaultPublicationScope;
  useEffect(() => {
    if (course && defaultScope) setScope(defaultScope);
  }, [course, defaultScope]);

  const publish = useMutation({
    mutationFn: () =>
      adminApi<CoursePublication>("POST", `courses/${course?.id}/publish`, {
        body: scope === "PLATFORM" ? { scope } : { scope, targetingGroupIds: selected },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminCoursesKey });
      void queryClient.invalidateQueries({ queryKey: adminGroupsKey });
      toast.success(
        scope === "PLATFORM"
          ? `${course?.title} is published to the entire platform.`
          : `${course?.title} is published to ${selected.length} group(s).`,
      );
      close();
    },
    onError: (failure) =>
      setError(adminErrorMessage(failure, "The course could not be published.")),
  });

  function close() {
    if (publish.isPending) return;
    setScope("PLATFORM");
    setSelected([]);
    setError("");
    onClose();
  }

  function submit() {
    if (scope === "TARGETED" && selected.length === 0) {
      setError("Choose at least one group.");
      return;
    }
    setError("");
    publish.mutate();
  }

  // Groups for the course's crop first.
  const matching = [...(groups.data ?? [])].sort(
    (a, b) => Number(b.crop.id === course?.crop.id) - Number(a.crop.id === course?.crop.id),
  );

  return (
    <Dialog open={!!course} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish {course?.title}</DialogTitle>
          <DialogDescription>
            Farmers who match the course audience ({cropLabel(course?.crop)}) can open it once it is
            published.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2 text-sm" disabled={publish.isPending}>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              checked={scope === "PLATFORM"}
              onChange={() => setScope("PLATFORM")}
            />
            <span>
              <b>Entire platform</b>
              <small className="block text-muted-foreground">
                Every matching farmer in Rwanda.
              </small>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              checked={scope === "TARGETED"}
              onChange={() => setScope("TARGETED")}
            />
            <span>
              <b>Selected groups</b>
              <small className="block text-muted-foreground">
                Only farmers covered by the chosen groups.
              </small>
            </span>
          </label>
          {scope === "TARGETED" && (
            <div className="admin-panel mt-2 space-y-2">
              {groups.isLoading ? (
                <p className="text-muted-foreground">Loading groups…</p>
              ) : groups.isError ? (
                <p className="text-destructive">
                  {adminErrorMessage(groups.error, "Groups could not be loaded.")}
                </p>
              ) : matching.length === 0 ? (
                <p className="text-muted-foreground">
                  There are no active groups yet. Create one under Groups first.
                </p>
              ) : (
                matching.map((group) => (
                  <label key={group.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(group.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, group.id]
                            : current.filter((id) => id !== group.id),
                        )
                      }
                    />
                    {group.name} · {group.district}
                    {group.sector ? `, ${group.sector}` : ""} · {cropLabel(group.crop)}
                  </label>
                ))
              )}
            </div>
          )}
        </fieldset>
        {error && (
          <p className="fac-field-error" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={publish.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={publish.isPending}>
            {publish.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
