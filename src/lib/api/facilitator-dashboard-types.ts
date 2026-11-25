import type { KeyCount } from "./admin-people-types";

/** GET /facilitator/reports/dashboard — aggregates limited to the facilitator's own groups. */
export interface FacilitatorDashboardReport {
  groups: { id: string; name: string; members: number; assignedCourses: number }[];
  farmersInScope: number;
  enrollmentsByStatus: KeyCount[];
  completedLessonProgress: number;
  assessmentAttemptsByStatus: KeyCount[];
  farmersByType: KeyCount[];
  farmersByDistrict: KeyCount[];
  completedLessonsInRange: number;
  completionsOverTime: { date: string; count: number }[];
  activeLearnersInRange: number;
  coursesByStatus: KeyCount[];
}
