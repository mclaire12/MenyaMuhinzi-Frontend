import { queryOptions } from "@tanstack/react-query";
import { adminGet, type Paginated } from "@/lib/admin/api";
import type { CropSummary, TargetAudienceCode } from "@/lib/admin/backend-groups";

/** Courses, modules, lessons and publications from the backend (/courses, /modules, /lessons). */

export type CourseStatusCode = "DRAFT" | "UNDER_REVIEW" | "PUBLISHED" | "ARCHIVED";
export type CourseCategoryCode =
  | "CROP_PRODUCTION"
  | "PEST_AND_DISEASE_MANAGEMENT"
  | "SOIL_AND_FERTILITY"
  | "WATER_MANAGEMENT"
  | "POST_HARVEST"
  | "MARKETING"
  | "CLIMATE_SMART_AGRICULTURE"
  | "GENERAL";
export type DifficultyCode = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type ContentStatusCode = "DRAFT" | "PUBLISHED";
export type LessonTypeCode = "TEXT" | "AUDIO" | "VIDEO" | "IMAGE" | "DOCUMENT" | "MIXED";
export type LanguageCode = "rw" | "en";

export interface AdminCourse {
  id: string;
  title: string;
  shortDescription: string;
  detailedDescription: string;
  crop: CropSummary;
  category: CourseCategoryCode;
  targetAudience: TargetAudienceCode;
  difficulty: DifficultyCode;
  learningObjectives: string[];
  estimatedDurationMinutes: number;
  language: LanguageCode;
  coverImageRef: string | null;
  status: CourseStatusCode;
  publishedAt: string | null;
  createdBy: { id: string; fullName: string };
  /** Set for courses a facilitator generated; published to that facilitator's groups only. */
  facilitatorOwner: { id: string; fullName: string } | null;
  /** Groups a facilitator course is published to (visible to admins and the owner). */
  sharedWithGroups: { id: string; name: string }[];
  /** The AI generation request that produced the course. */
  generation: { id: string; status: GenerationStatus } | null;
  createdAt: string;
  updatedAt: string;
}

export type GenerationStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type LearningFormat = "TEXT" | "AUDIO" | "VIDEO";

export interface SubChapterOutline {
  title: string;
  description?: string;
}

export interface ChapterOutline {
  title: string;
  description?: string;
  subChapters: SubChapterOutline[];
}

export interface CourseGeneration {
  id: string;
  scope: "PLATFORM" | "GROUP";
  status: GenerationStatus;
  statusMessage: string | null;
  brief: string;
  chapters: ChapterOutline[];
  contentFormats: LearningFormat[];
  knowledgeSources: { id: string; title: string }[];
  course: { id: string; title: string; status: CourseStatusCode };
  facilitatorGroup: { id: string; name: string } | null;
  requestedBy: { id: string; fullName: string };
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const generationStatusLabels: Record<GenerationStatus, string> = {
  PENDING: "Waiting for AI",
  PROCESSING: "AI is writing",
  COMPLETED: "Written by AI",
  FAILED: "Generation failed",
  CANCELLED: "Cancelled",
};

export const generationStatusTone = (status: GenerationStatus) =>
  status === "COMPLETED"
    ? "ok"
    : status === "FAILED"
      ? "bad"
      : status === "CANCELLED"
        ? "muted"
        : "warn";

/** True while the AI has not finished: the course cannot be published yet. */
export const generationInProgress = (generation: AdminCourse["generation"]) =>
  !!generation && (generation.status === "PENDING" || generation.status === "PROCESSING");

export const learningFormatLabels: Record<LearningFormat, string> = {
  TEXT: "Reading (text)",
  AUDIO: "Listening (audio)",
  VIDEO: "Watching (video)",
};

export const adminGenerationsKey = ["admin-course-generations"] as const;

export function courseGenerationsQueryOptions(
  query: { page: number; status?: GenerationStatus },
  enabled: boolean,
) {
  return queryOptions({
    queryKey: [...adminGenerationsKey, "list", query] as const,
    queryFn: () =>
      adminGet<Paginated<CourseGeneration>>("course-generations", { ...query, limit: 10 }),
    enabled,
    retry: false,
  });
}

export function courseGenerationQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminGenerationsKey, "detail", id] as const,
    queryFn: () => adminGet<CourseGeneration>(`course-generations/${id}`),
    enabled,
    retry: false,
  });
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  learningObjectives: string[];
  displayOrder: number;
  status: ContentStatusCode;
  createdAt: string;
  updatedAt: string;
}

export interface CourseLesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  lessonType: LessonTypeCode;
  mainContent?: string | null;
  contentRef: string | null;
  learningObjectives: string[];
  language: LanguageCode;
  estimatedDurationMinutes: number;
  displayOrder: number;
  status: ContentStatusCode;
  createdAt: string;
  updatedAt: string;
}

export interface CoursePublication {
  id: string;
  courseId: string;
  scope: "PLATFORM" | "TARGETED";
  isCurrent: boolean;
  publishedAt: string;
  unpublishedAt: string | null;
  publishedBy: { id: string; fullName: string };
  unpublishedBy: { id: string; fullName: string } | null;
  targetingGroups: { id: string; name: string }[];
}

export interface CourseAssessment {
  id: string;
  title: string;
  description: string | null;
  courseId: string | null;
  moduleId: string | null;
  lessonId: string | null;
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number | null;
  language: LanguageCode;
  status?: string;
  questions?: unknown[];
}

export const courseStatusLabels: Record<CourseStatusCode, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const courseStatusTone = (status: CourseStatusCode) =>
  status === "PUBLISHED"
    ? "ok"
    : status === "UNDER_REVIEW"
      ? "warn"
      : status === "ARCHIVED"
        ? "muted"
        : "info";

export const categoryLabels: Record<CourseCategoryCode, string> = {
  CROP_PRODUCTION: "Crop production",
  PEST_AND_DISEASE_MANAGEMENT: "Pest and disease management",
  SOIL_AND_FERTILITY: "Soil and fertility",
  WATER_MANAGEMENT: "Water management",
  POST_HARVEST: "Post-harvest",
  MARKETING: "Marketing",
  CLIMATE_SMART_AGRICULTURE: "Climate-smart agriculture",
  GENERAL: "General",
};

export const difficultyLabels: Record<DifficultyCode, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const lessonTypeLabels: Record<LessonTypeCode, string> = {
  TEXT: "Text",
  AUDIO: "Audio",
  VIDEO: "Video",
  IMAGE: "Image",
  DOCUMENT: "Document",
  MIXED: "Mixed",
};

export const languageLabels: Record<LanguageCode, string> = { rw: "Kinyarwanda", en: "English" };

export const formatMinutes = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
    : `${minutes} min`;

export const adminCoursesKey = ["admin-courses"] as const;

export type CourseListQuery = {
  page: number;
  search?: string;
  status?: CourseStatusCode;
  cropId?: string;
  category?: CourseCategoryCode;
  difficulty?: DifficultyCode;
  language?: LanguageCode;
};

export function adminCourseListQueryOptions(query: CourseListQuery, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminCoursesKey, "list", query] as const,
    queryFn: () => adminGet<Paginated<AdminCourse>>("courses", { ...query, limit: 10 }),
    enabled,
    retry: false,
  });
}

export function adminCourseQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminCoursesKey, "detail", id] as const,
    queryFn: () => adminGet<AdminCourse>(`courses/${id}`),
    enabled,
    retry: false,
  });
}

/** Modules with their lessons, in display order. */
export function adminCourseStructureQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminCoursesKey, "structure", id] as const,
    queryFn: async () => {
      const modules = await adminGet<CourseModule[]>(`courses/${id}/modules`);
      const lessons = await Promise.all(
        modules.map((module) => adminGet<CourseLesson[]>(`modules/${module.id}/lessons`)),
      );
      return modules
        .map((module, index) => ({
          ...module,
          lessons: [...(lessons[index] ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder);
    },
    enabled,
    retry: false,
  });
}

export function adminCoursePublicationsQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminCoursesKey, "publications", id] as const,
    queryFn: () => adminGet<CoursePublication[]>(`courses/${id}/publications`),
    enabled,
    retry: false,
  });
}

export function adminCourseAssessmentsQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminCoursesKey, "assessments", id] as const,
    queryFn: async () => {
      const result = await adminGet<CourseAssessment[] | Paginated<CourseAssessment>>(
        "assessments",
        { courseId: id },
      );
      return Array.isArray(result) ? result : result.data;
    },
    enabled,
    retry: false,
  });
}

export interface CourseFormValues {
  title: string;
  shortDescription: string;
  detailedDescription: string;
  cropId: string;
  category: CourseCategoryCode;
  targetAudience: TargetAudienceCode;
  difficulty: DifficultyCode;
  learningObjectives: string;
  estimatedDurationMinutes: number;
  language: LanguageCode;
}

export const emptyCourseValues = (): CourseFormValues => ({
  title: "",
  shortDescription: "",
  detailedDescription: "",
  cropId: "",
  category: "CROP_PRODUCTION",
  targetAudience: "ALL_FARMERS",
  difficulty: "BEGINNER",
  learningObjectives: "",
  estimatedDurationMinutes: 60,
  language: "rw",
});

export const courseValuesFrom = (course: AdminCourse): CourseFormValues => ({
  title: course.title,
  shortDescription: course.shortDescription,
  detailedDescription: course.detailedDescription,
  cropId: course.crop.id,
  category: course.category,
  targetAudience: course.targetAudience,
  difficulty: course.difficulty,
  learningObjectives: course.learningObjectives.join("\n"),
  estimatedDurationMinutes: course.estimatedDurationMinutes,
  language: course.language,
});

export const splitLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export type CourseFieldErrors = Partial<Record<keyof CourseFormValues, string>>;

export function validateCourseValues(values: CourseFormValues): CourseFieldErrors {
  const errors: CourseFieldErrors = {};
  const objectives = splitLines(values.learningObjectives);
  if (!values.title.trim()) errors.title = "Enter a course title.";
  else if (values.title.trim().length > 200) errors.title = "Use at most 200 characters.";
  if (!values.shortDescription.trim()) errors.shortDescription = "Enter a short description.";
  else if (values.shortDescription.trim().length > 500)
    errors.shortDescription = "Use at most 500 characters.";
  if (!values.detailedDescription.trim()) errors.detailedDescription = "Describe the course.";
  if (!values.cropId) errors.cropId = "Choose a crop.";
  if (objectives.length === 0) errors.learningObjectives = "Add at least one learning objective.";
  else if (objectives.length > 20) errors.learningObjectives = "Use at most 20 objectives.";
  else if (objectives.some((line) => line.length > 300))
    errors.learningObjectives = "Each objective must be at most 300 characters.";
  if (!Number.isInteger(values.estimatedDurationMinutes) || values.estimatedDurationMinutes < 1) {
    errors.estimatedDurationMinutes = "Enter the duration in whole minutes.";
  }
  return errors;
}

export function courseBody(values: CourseFormValues) {
  return {
    title: values.title.trim(),
    shortDescription: values.shortDescription.trim(),
    detailedDescription: values.detailedDescription.trim(),
    cropId: values.cropId,
    category: values.category,
    targetAudience: values.targetAudience,
    difficulty: values.difficulty,
    learningObjectives: splitLines(values.learningObjectives),
    estimatedDurationMinutes: values.estimatedDurationMinutes,
    language: values.language,
  };
}
