import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { LocationFields } from "@/components/location/location-fields";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  audienceCodeLabels,
  cropLabel,
  cropsQueryOptions,
  validateGroupValues,
  type AdminGroupValues,
  type GroupFieldErrors,
  type TargetAudienceCode,
} from "@/lib/admin/backend-groups";

type Props = {
  initial: AdminGroupValues;
  submitLabel: string;
  busy?: boolean;
  serverError?: string;
  onSubmit: (values: AdminGroupValues) => void;
  onCancel: () => void;
};

/** Create / edit a course-targeting group (saved through POST/PATCH /admin/groups). */
export function TargetGroupForm({
  initial,
  submitLabel,
  busy,
  serverError,
  onSubmit,
  onCancel,
}: Props) {
  const crops = useQuery(cropsQueryOptions(true));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<GroupFieldErrors>({});
  const set = <K extends keyof AdminGroupValues>(key: K, value: AdminGroupValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const error = (key: keyof AdminGroupValues) =>
    errors[key] && (
      <span className="fac-field-error" role="alert">
        {errors[key]}
      </span>
    );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateGroupValues(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    onSubmit(values);
  }

  return (
    <form className="admin-form" noValidate onSubmit={submit}>
      <p className="fac-note">
        Groups decide who a course is published to. Farmers are not added by hand: registered
        farmers whose location and crop match the group see its courses.
      </p>
      <label>
        Group name
        <input
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          placeholder="For example: Musanze tomato growers"
          aria-invalid={!!errors.name}
        />
        {error("name")}
      </label>
      <label>
        Description (optional)
        <textarea
          rows={2}
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </label>
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
          Crop
          <select
            value={values.cropId}
            onChange={(event) => set("cropId", event.target.value)}
            aria-invalid={!!errors.cropId}
            disabled={crops.isLoading}
          >
            <option value="">{crops.isLoading ? "Loading crops…" : "Choose a crop"}</option>
            {(crops.data ?? []).map((crop) => (
              <option key={crop.id} value={crop.id}>
                {cropLabel(crop)}
              </option>
            ))}
          </select>
          {crops.isError && <span className="fac-field-error">Crops could not be loaded.</span>}
          {error("cropId")}
        </label>
      </div>
      <LocationFields
        idPrefix="target-group"
        levels={["province", "district", "sector"]}
        value={{ ...values, cell: "", village: "" }}
        errors={{ district: errors.district }}
        labels={{ sector: "Sector (optional)" }}
        placeholders={{ sector: "Whole district" }}
        onChange={({ province, district, sector }) => {
          setValues((current) => ({ ...current, province, district, sector }));
          setErrors(({ district: _cleared, ...rest }) => rest);
        }}
      />
      <label>
        Estimated farmers
        <input
          type="number"
          min={0}
          value={Number.isNaN(values.estimatedFarmerCount) ? "" : values.estimatedFarmerCount}
          onChange={(event) => set("estimatedFarmerCount", event.target.valueAsNumber)}
          aria-invalid={!!errors.estimatedFarmerCount}
        />
        <small className="text-muted-foreground">
          For planning only. It does not add anyone to the group.
        </small>
        {error("estimatedFarmerCount")}
      </label>
      {serverError && (
        <p className="fac-field-error" role="alert">
          {serverError}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
