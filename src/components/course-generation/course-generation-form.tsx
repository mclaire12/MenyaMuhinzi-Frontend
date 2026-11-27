import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { CourseOutlineBuilder } from "@/components/admin/course-outline-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi, adminErrorMessage, adminGetAll } from "@/lib/admin/api";
import {
  audienceCodeLabels,
  cropLabel,
  cropsQueryOptions,
  type TargetAudienceCode,
} from "@/lib/admin/backend-groups";
import {
  adminCoursesKey,
  adminGenerationsKey,
  categoryLabels,
  difficultyLabels,
  languageLabels,
  learningFormatLabels,
  splitLines,
  type ChapterOutline,
  type CourseCategoryCode,
  type CourseGeneration,
  type DifficultyCode,
  type LanguageCode,
  type LearningFormat,
} from "@/lib/admin/backend-courses";
import type { KnowledgeSource } from "@/lib/admin/backend-knowledge";
import { emptyChapter, outlineBody, validateOutline } from "@/lib/admin/course-outline";

type Values = {
  title: string;
  shortDescription: string;
  brief: string;
  cropId: string;
  category: CourseCategoryCode;
  targetAudience: TargetAudienceCode;
  difficulty: DifficultyCode;
  language: LanguageCode;
  learningObjectives: string;
  estimatedDurationMinutes: number;
  formats: LearningFormat[];
  knowledgeSourceIds: string[];
};

const initialValues: Values = {
  title: "",
  shortDescription: "",
  brief: "",
  cropId: "",
  category: "CROP_PRODUCTION",
  targetAudience: "ALL_FARMERS",
  difficulty: "BEGINNER",
  language: "rw",
  learningObjectives: "",
  estimatedDurationMinutes: 120,
  formats: ["TEXT", "AUDIO", "VIDEO"],
  knowledgeSourceIds: [],
};

/**
 * The course-generation form shared by administrators and facilitators: the same structure
 * (course, chapters and sub-chapters, learning formats, Knowledge Base documents). Facilitators
 * choose the groups when they publish the finished course.
 */
export function CourseGenerationForm({
  onCreated,
}: {
  onCreated: (generation: CourseGeneration) => void;
}) {
  const queryClient = useQueryClient();
  const crops = useQuery(cropsQueryOptions(true));
  const sources = useQuery({
    queryKey: ["admin-knowledge", "approved-sources"],
    queryFn: () => adminGetAll<KnowledgeSource>("knowledge/sources", { status: "APPROVED" }),
    retry: false,
  });
  const [values, setValues] = useState<Values>(initialValues);
  const [chapters, setChapters] = useState<ChapterOutline[]>([emptyChapter()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setServerError("");
  };

  const submit = useMutation({
    mutationFn: () =>
      adminApi<CourseGeneration>("POST", "course-generations", {
        body: {
          title: values.title.trim(),
          shortDescription: values.shortDescription.trim(),
          brief: values.brief.trim(),
          cropId: values.cropId,
          category: values.category,
          targetAudience: values.targetAudience,
          difficulty: values.difficulty,
          language: values.language,
          learningObjectives: splitLines(values.learningObjectives),
          estimatedDurationMinutes: values.estimatedDurationMinutes,
          chapters: outlineBody(chapters),
          contentFormats: values.formats,
          ...(values.knowledgeSourceIds.length
            ? { knowledgeSourceIds: values.knowledgeSourceIds }
            : {}),
        },
      }),
    onSuccess: async (generation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminCoursesKey }),
        queryClient.invalidateQueries({ queryKey: adminGenerationsKey }),
      ]);
      toast.success(`${generation.course.title}: structure saved and sent for AI generation.`);
      onCreated(generation);
    },
    onError: (error) =>
      setServerError(adminErrorMessage(error, "The generation request could not be saved.")),
  });

  function validate(): boolean {
    const found: Record<string, string> = { ...validateOutline(chapters) };
    const objectives = splitLines(values.learningObjectives);
    if (!values.title.trim()) found["title"] = "Enter a course title.";
    if (!values.shortDescription.trim()) found["shortDescription"] = "Enter a short description.";
    if (!values.brief.trim()) found["brief"] = "Tell the AI what the course must achieve.";
    if (!values.cropId) found["cropId"] = "Choose a crop.";
    if (objectives.length === 0)
      found["learningObjectives"] = "Add at least one learning objective.";
    if (objectives.length > 20) found["learningObjectives"] = "Use at most 20 objectives.";
    if (!Number.isInteger(values.estimatedDurationMinutes) || values.estimatedDurationMinutes < 1) {
      found["estimatedDurationMinutes"] = "Enter the duration in whole minutes.";
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  const error = (key: string) =>
    errors[key] && (
      <span className="fac-field-error" role="alert">
        {errors[key]}
      </span>
    );
  const approved = (sources.data ?? []).filter((source) => source.isActive && !source.archivedAt);
  const filteredSources = approved.filter(
    (source) =>
      !sourceFilter.trim() ||
      source.title.toLowerCase().includes(sourceFilter.trim().toLowerCase()),
  );

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (validate()) submit.mutate();
        else setServerError("Check the highlighted fields.");
      }}
    >
      <fieldset className="admin-panel admin-form" disabled={submit.isPending}>
        <legend className="font-bold">1. Course</legend>
        <label>
          Course title
          <input
            value={values.title}
            maxLength={200}
            onChange={(event) => set("title", event.target.value)}
            aria-invalid={!!errors["title"]}
          />
          {error("title")}
        </label>
        <label>
          Short description
          <input
            value={values.shortDescription}
            maxLength={500}
            placeholder="One sentence shown in course lists"
            onChange={(event) => set("shortDescription", event.target.value)}
            aria-invalid={!!errors["shortDescription"]}
          />
          {error("shortDescription")}
        </label>
        <div className="fac-row">
          <label>
            Crop
            <select
              value={values.cropId}
              onChange={(event) => set("cropId", event.target.value)}
              aria-invalid={!!errors["cropId"]}
            >
              <option value="">{crops.isLoading ? "Loading crops…" : "Choose a crop"}</option>
              {(crops.data ?? []).map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {cropLabel(crop)}
                </option>
              ))}
            </select>
            {error("cropId")}
          </label>
          <label>
            Category
            <select
              value={values.category}
              onChange={(event) => set("category", event.target.value as CourseCategoryCode)}
            >
              {(Object.keys(categoryLabels) as CourseCategoryCode[]).map((item) => (
                <option key={item} value={item}>
                  {categoryLabels[item]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fac-row">
          <label>
            Target audience
            <select
              value={values.targetAudience}
              onChange={(event) => set("targetAudience", event.target.value as TargetAudienceCode)}
            >
              {(Object.keys(audienceCodeLabels) as TargetAudienceCode[]).map((item) => (
                <option key={item} value={item}>
                  {audienceCodeLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Level
            <select
              value={values.difficulty}
              onChange={(event) => set("difficulty", event.target.value as DifficultyCode)}
            >
              {(Object.keys(difficultyLabels) as DifficultyCode[]).map((item) => (
                <option key={item} value={item}>
                  {difficultyLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Language
            <select
              value={values.language}
              onChange={(event) => set("language", event.target.value as LanguageCode)}
            >
              {(Object.keys(languageLabels) as LanguageCode[]).map((item) => (
                <option key={item} value={item}>
                  {languageLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Total duration (minutes)
            <input
              type="number"
              min={1}
              value={
                Number.isNaN(values.estimatedDurationMinutes) ? "" : values.estimatedDurationMinutes
              }
              onChange={(event) => set("estimatedDurationMinutes", event.target.valueAsNumber)}
              aria-invalid={!!errors["estimatedDurationMinutes"]}
            />
            {error("estimatedDurationMinutes")}
          </label>
        </div>
        <label>
          Learning objectives (one per line)
          <textarea
            rows={3}
            value={values.learningObjectives}
            onChange={(event) => set("learningObjectives", event.target.value)}
            aria-invalid={!!errors["learningObjectives"]}
          />
          {error("learningObjectives")}
        </label>
        <label>
          Instructions for the AI
          <textarea
            rows={4}
            maxLength={10000}
            placeholder="Who the farmers are, what they must be able to do afterwards, local practices to include or avoid, tone…"
            value={values.brief}
            onChange={(event) => set("brief", event.target.value)}
            aria-invalid={!!errors["brief"]}
          />
          {error("brief")}
        </label>
      </fieldset>

      <fieldset className="space-y-2" disabled={submit.isPending}>
        <legend className="text-lg font-bold">2. Structure: chapters and sub-chapters</legend>
        <CourseOutlineBuilder
          chapters={chapters}
          errors={errors}
          onChange={(next) => {
            setChapters(next);
            setErrors((current) =>
              Object.fromEntries(
                Object.entries(current).filter(([key]) => !/^(chapter|sub|chapters)/.test(key)),
              ),
            );
          }}
        />
      </fieldset>

      <fieldset className="admin-panel space-y-2" disabled={submit.isPending}>
        <legend className="font-bold">3. How farmers learn each sub-chapter</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(Object.keys(learningFormatLabels) as LearningFormat[]).map((format) => (
            <label key={format} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.formats.includes(format)}
                disabled={format === "TEXT"}
                onChange={(event) =>
                  set(
                    "formats",
                    event.target.checked
                      ? [...values.formats, format]
                      : values.formats.filter((item) => item !== format),
                  )
                }
              />
              {learningFormatLabels[format]}
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Reading is always included. Audio and video are produced for every sub-chapter you
          selected them for.
        </p>
      </fieldset>

      <fieldset className="admin-panel space-y-2" disabled={submit.isPending}>
        <legend className="font-bold">4. Knowledge Base documents (latest information)</legend>
        <p className="text-sm text-muted-foreground">
          The model already knows agriculture from its training. Approved documents you choose here
          add the latest information.
        </p>
        {sources.isError ? (
          <p className="text-sm text-destructive">
            {adminErrorMessage(sources.error, "Documents could not be loaded.")}
          </p>
        ) : sources.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading approved documents…</p>
        ) : approved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approved documents yet. Add them under{" "}
            <Link className="font-bold" to="/admin/knowledge">
              Knowledge Base
            </Link>
            .
          </p>
        ) : (
          <>
            <Input
              aria-label="Filter documents"
              placeholder="Filter documents"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            />
            <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
              {filteredSources.map((source) => (
                <label key={source.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={values.knowledgeSourceIds.includes(source.id)}
                    onChange={(event) =>
                      set(
                        "knowledgeSourceIds",
                        event.target.checked
                          ? [...values.knowledgeSourceIds, source.id]
                          : values.knowledgeSourceIds.filter((id) => id !== source.id),
                      )
                    }
                  />
                  {source.title}
                  <span className="text-muted-foreground">
                    · {source.crops.map((crop) => crop.nameEn).join(", ") || "all crops"} ·{" "}
                    {source.language === "en" ? "English" : "Kinyarwanda"}
                  </span>
                </label>
              ))}
            </div>
            <small className="text-muted-foreground">
              {values.knowledgeSourceIds.length} selected
            </small>
          </>
        )}
      </fieldset>

      {serverError && (
        <p className="fac-field-error" role="alert">
          {serverError}
        </p>
      )}
      <div className="admin-actions">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <Sparkles aria-hidden />
          )}
          Generate course
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        The structure is saved straight away as a draft course. The AI model writes the content when
        it is connected; until then the request waits and the course cannot be published.
      </p>
    </form>
  );
}
