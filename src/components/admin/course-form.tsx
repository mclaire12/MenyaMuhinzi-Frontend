import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  audienceCodeLabels,
  cropLabel,
  cropsQueryOptions,
  type TargetAudienceCode,
} from "@/lib/admin/backend-groups";
import {
  categoryLabels,
  difficultyLabels,
  languageLabels,
  validateCourseValues,
  type CourseCategoryCode,
  type CourseFieldErrors,
  type CourseFormValues,
  type DifficultyCode,
  type LanguageCode,
} from "@/lib/admin/backend-courses";

type Props = {
  initial: CourseFormValues;
  submitLabel: string;
  busy?: boolean;
  serverError?: string;
  disabled?: boolean;
  onSubmit: (values: CourseFormValues) => void;
  onCancel?: () => void;
  /** Render footer buttons inside a dialog footer. */
  inDialog?: boolean;
};

/** Course details saved through POST /courses or PATCH /courses/:id. */
export function CourseForm({
  initial,
  submitLabel,
  busy,
  serverError,
  disabled,
  onSubmit,
  onCancel,
  inDialog,
}: Props) {
  const crops = useQuery(cropsQueryOptions(true));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<CourseFieldErrors>({});
  const set = <K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const error = (key: keyof CourseFormValues) =>
    errors[key] && (
      <span className="fac-field-error" role="alert">
        {errors[key]}
      </span>
    );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateCourseValues(values);
    setErrors(found);
    if (!Object.keys(found).length) onSubmit(values);
  }

  const buttons = (
    <>
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      )}
      <Button type="submit" disabled={busy || disabled}>
        {busy && <LoaderCircle className="animate-spin" aria-hidden />}
        {submitLabel}
      </Button>
    </>
  );

  return (
    <form className="admin-form" noValidate onSubmit={submit}>
      <fieldset disabled={disabled} className="contents">
        <label>
          Course title
          <input
            value={values.title}
            onChange={(event) => set("title", event.target.value)}
            aria-invalid={!!errors.title}
          />
          {error("title")}
        </label>
        <label>
          Short description
          <input
            value={values.shortDescription}
            onChange={(event) => set("shortDescription", event.target.value)}
            aria-invalid={!!errors.shortDescription}
            placeholder="One sentence shown in course lists"
          />
          {error("shortDescription")}
        </label>
        <label>
          Detailed description
          <textarea
            rows={4}
            value={values.detailedDescription}
            onChange={(event) => set("detailedDescription", event.target.value)}
            aria-invalid={!!errors.detailedDescription}
          />
          {error("detailedDescription")}
        </label>
        <div className="fac-row">
          <label>
            Crop
            <select
              value={values.cropId}
              onChange={(event) => set("cropId", event.target.value)}
              aria-invalid={!!errors.cropId}
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
        </div>
        <label>
          Learning objectives (one per line)
          <textarea
            rows={3}
            value={values.learningObjectives}
            onChange={(event) => set("learningObjectives", event.target.value)}
            aria-invalid={!!errors.learningObjectives}
          />
          {error("learningObjectives")}
        </label>
        <label>
          Estimated duration (minutes)
          <input
            type="number"
            min={1}
            value={
              Number.isNaN(values.estimatedDurationMinutes) ? "" : values.estimatedDurationMinutes
            }
            onChange={(event) => set("estimatedDurationMinutes", event.target.valueAsNumber)}
            aria-invalid={!!errors.estimatedDurationMinutes}
          />
          {error("estimatedDurationMinutes")}
        </label>
      </fieldset>
      {serverError && (
        <p className="fac-field-error" role="alert">
          {serverError}
        </p>
      )}
      {inDialog ? (
        <DialogFooter>{buttons}</DialogFooter>
      ) : (
        !disabled && <div className="admin-actions">{buttons}</div>
      )}
    </form>
  );
}
