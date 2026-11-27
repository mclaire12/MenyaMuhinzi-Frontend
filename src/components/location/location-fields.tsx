import { Fragment, type ReactNode } from "react";
import { provinceLabels } from "@/lib/admin/backend-people";
import type { Province } from "@/lib/api/types";
import {
  changeLocation,
  LOCATION_LEVELS,
  type LocationLevel,
  locationOptions,
  type LocationValue,
  useRwandaLocations,
} from "@/lib/locations/rwanda";

type Texts = Partial<Record<LocationLevel, string>>;

export interface LocationFieldRender {
  level: LocationLevel;
  id: string;
  label: string;
  control: ReactNode;
  error?: string | undefined;
}

interface LocationFieldsProps {
  value: LocationValue;
  onChange: (next: LocationValue, changed: LocationLevel) => void;
  /** Levels to show, top-down (e.g. a target group only needs province, district and sector). */
  levels?: readonly LocationLevel[];
  /** Label per level; include "(optional)" in it where the form allows leaving it empty. */
  labels?: Texts;
  /** Text of the empty option, e.g. "Choose a sector" or "Whole district". */
  placeholders?: Texts;
  /** Text shown in a level that waits for the level above it. */
  waitingPlaceholders?: Texts;
  loadingText?: string;
  failedText?: string;
  provinceNames?: Record<Province, string>;
  errors?: Partial<Record<LocationLevel, string | undefined>>;
  idPrefix: string;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  renderField?: (field: LocationFieldRender) => ReactNode;
}

const ENGLISH_LABELS: Record<LocationLevel, string> = {
  province: "Province",
  district: "District",
  sector: "Sector",
  cell: "Cell",
  village: "Village",
};

const PARENT: Record<Exclude<LocationLevel, "province">, LocationLevel> = {
  district: "province",
  sector: "district",
  cell: "sector",
  village: "cell",
};

function defaultRender({ level, label, control, error }: LocationFieldRender) {
  return (
    <label>
      {label}
      {control}
      {error && (
        <span className="fac-field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

/**
 * Cascading Rwanda location dropdowns: each level lists only the places inside the level
 * chosen above it, and changing a level clears the levels below it.
 */
export function LocationFields({
  value,
  onChange,
  levels = LOCATION_LEVELS,
  labels,
  placeholders,
  waitingPlaceholders,
  loadingText = "Loading places…",
  failedText = "The list of places could not be loaded. Refresh the page and try again.",
  provinceNames = provinceLabels,
  errors,
  idPrefix,
  disabled,
  className = "fac-row",
  selectClassName,
  renderField = defaultRender,
}: LocationFieldsProps) {
  const { tree, failed } = useRwandaLocations();

  function control(level: LocationLevel, id: string): ReactNode {
    const common = {
      id,
      className: selectClassName,
      "aria-invalid": errors?.[level] ? true : undefined,
    };
    if (level === "province") {
      return (
        <select
          {...common}
          value={value.province}
          disabled={disabled}
          onChange={(event) =>
            onChange(changeLocation(value, "province", event.target.value), "province")
          }
        >
          {(Object.keys(provinceNames) as Province[]).map((item) => (
            <option key={item} value={item}>
              {provinceNames[item]}
            </option>
          ))}
        </select>
      );
    }
    const parent = PARENT[level];
    const parentChosen = parent === "province" || Boolean(value[parent]);
    const loading = level !== "district" && parentChosen && !tree && !failed;
    const options = locationOptions(tree, level, value);
    // Keep a saved value that is not in the list (older free-text entries) so it is not lost.
    const current = value[level];
    if (current && !options.some((item) => item.toLowerCase() === current.toLowerCase())) {
      options.unshift(current);
    }
    const empty = loading
      ? loadingText
      : !parentChosen
        ? (waitingPlaceholders?.[level] ?? `Choose a ${ENGLISH_LABELS[parent].toLowerCase()} first`)
        : (placeholders?.[level] ?? `Choose a ${ENGLISH_LABELS[level].toLowerCase()}`);
    return (
      <select
        {...common}
        value={options.find((item) => item.toLowerCase() === current.toLowerCase()) ?? ""}
        disabled={disabled || !parentChosen || loading}
        onChange={(event) => onChange(changeLocation(value, level, event.target.value), level)}
      >
        <option value="">{empty}</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={className}>
      {levels.map((level) => {
        const id = `${idPrefix}-${level}`;
        return (
          <Fragment key={level}>
            {renderField({
              level,
              id,
              label: labels?.[level] ?? ENGLISH_LABELS[level],
              control: control(level, id),
              error: errors?.[level],
            })}
          </Fragment>
        );
      })}
      {failed && (
        <p className="fac-field-error" role="alert">
          {failedText}
        </p>
      )}
    </div>
  );
}
