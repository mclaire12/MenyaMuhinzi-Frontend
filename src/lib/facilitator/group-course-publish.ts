import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import {
  adminCoursesKey,
  generationInProgress,
  type AdminCourse,
} from "@/lib/admin/backend-courses";
import { facilitatorCoursesKey } from "@/lib/facilitator/backend-courses";

/** Why a facilitator course cannot be published yet, or null when it can. */
export function publishBlocker(course: AdminCourse): string | null {
  if (!course.facilitatorOwner)
    return "Only courses you generated can be published to your groups.";
  if (course.status === "ARCHIVED") return "Archived courses cannot be published.";
  if (generationInProgress(course.generation))
    return "The AI has not finished writing this course yet.";
  return null;
}

export function useRefreshFacilitatorCourses() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: facilitatorCoursesKey }),
      queryClient.invalidateQueries({ queryKey: adminCoursesKey }),
    ]);
}

/** Withdraws a facilitator course from all its groups (DELETE /courses/:id/groups). */
export function useUnpublishFromGroups() {
  const refresh = useRefreshFacilitatorCourses();
  return useMutation({
    mutationFn: (course: AdminCourse) =>
      adminApi<AdminCourse>("DELETE", `courses/${course.id}/groups`),
    onSuccess: async (_result, course) => {
      await refresh();
      toast.success(`${course.title} is no longer published. Farmer progress is kept.`);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The course could not be withdrawn.")),
  });
}
