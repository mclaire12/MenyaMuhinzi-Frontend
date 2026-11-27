import { queryOptions } from "@tanstack/react-query";
import { adminGet, adminGetAll, type Paginated } from "@/lib/admin/api";
import type { Province } from "@/lib/api/types";

/** Course-targeting groups from the backend (GET /admin/groups). */

export type TargetAudienceCode = "ALL_FARMERS" | "SMARTPHONE_FARMERS" | "BASIC_PHONE_FARMERS";
export type RecordStatusCode = "ACTIVE" | "INACTIVE";

export interface CropSummary {
  id: string;
  code: string;
  nameEn: string;
  nameRw: string;
}

export interface CropRecord extends CropSummary {
  description: string | null;
  status?: string;
}

export interface AdminGroup {
  id: string;
  name: string;
  description: string | null;
  crop: CropSummary;
  targetAudience: TargetAudienceCode;
  province: Province;
  district: string;
  sector: string | null;
  estimatedFarmerCount: number;
  status: RecordStatusCode;
  createdBy: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface AdminGroupCourse {
  courseId: string;
  title: string;
  status: string;
  publicationId: string;
  publishedAt: string;
  publishedBy: { id: string; fullName: string };
}

export interface AdminGroupValues {
  name: string;
  description: string;
  cropId: string;
  targetAudience: TargetAudienceCode;
  province: Province;
  district: string;
  sector: string;
  estimatedFarmerCount: number;
}

export const audienceCodeLabels: Record<TargetAudienceCode, string> = {
  ALL_FARMERS: "All farmers",
  SMARTPHONE_FARMERS: "Smartphone farmers",
  BASIC_PHONE_FARMERS: "Basic-phone farmers",
};

export const recordStatusLabels: Record<RecordStatusCode, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export const recordStatusTone = (status: RecordStatusCode) =>
  status === "ACTIVE" ? "ok" : "muted";

export const cropLabel = (crop: CropSummary | null | undefined) =>
  crop ? `${crop.nameEn} (${crop.nameRw})` : "—";

export const groupPlace = (
  group: Pick<AdminGroup, "province" | "district" | "sector">,
  provinceName: (p: Province) => string,
) => [group.sector, group.district, provinceName(group.province)].filter(Boolean).join(", ");

export const adminGroupsKey = ["admin-groups"] as const;

export function adminGroupListQueryOptions(
  query: {
    search?: string;
    status?: RecordStatusCode;
    province?: Province;
    cropId?: string;
    page: number;
  },
  enabled: boolean,
) {
  return queryOptions({
    queryKey: [...adminGroupsKey, "list", query] as const,
    queryFn: () => adminGet<Paginated<AdminGroup>>("admin/groups", { ...query, limit: 10 }),
    enabled,
    retry: false,
  });
}

export function adminGroupQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminGroupsKey, "detail", id] as const,
    queryFn: () => adminGet<AdminGroup>(`admin/groups/${id}`),
    enabled,
    retry: false,
  });
}

export function adminGroupCoursesQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminGroupsKey, "courses", id] as const,
    queryFn: () => adminGet<AdminGroupCourse[]>(`admin/groups/${id}/courses`),
    enabled,
    retry: false,
  });
}

/** Every active targeting group, for publish dialogs. */
export function activeAdminGroupsQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: [...adminGroupsKey, "active"] as const,
    queryFn: () => adminGetAll<AdminGroup>("admin/groups", { status: "ACTIVE" }),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export function cropsQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: ["crops"] as const,
    queryFn: () => adminGet<CropRecord[]>("crops"),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function emptyGroupValues(): AdminGroupValues {
  return {
    name: "",
    description: "",
    cropId: "",
    targetAudience: "ALL_FARMERS",
    province: "NORTHERN",
    district: "",
    sector: "",
    estimatedFarmerCount: 0,
  };
}

export function groupValuesFrom(group: AdminGroup): AdminGroupValues {
  return {
    name: group.name,
    description: group.description ?? "",
    cropId: group.crop.id,
    targetAudience: group.targetAudience,
    province: group.province,
    district: group.district,
    sector: group.sector ?? "",
    estimatedFarmerCount: group.estimatedFarmerCount,
  };
}

export type GroupFieldErrors = Partial<Record<keyof AdminGroupValues, string>>;

export function validateGroupValues(values: AdminGroupValues): GroupFieldErrors {
  const errors: GroupFieldErrors = {};
  if (values.name.trim().length < 3) errors.name = "Enter a group name (at least 3 characters).";
  if (values.name.trim().length > 150) errors.name = "Use at most 150 characters.";
  if (!values.cropId) errors.cropId = "Choose a crop.";
  if (!values.district) errors.district = "Choose a district.";
  if (
    !Number.isInteger(values.estimatedFarmerCount) ||
    values.estimatedFarmerCount < 0 ||
    values.estimatedFarmerCount > 1_000_000
  ) {
    errors.estimatedFarmerCount = "Enter a whole number between 0 and 1,000,000.";
  }
  return errors;
}

/** Request body for POST/PATCH /admin/groups. */
export function groupBody(values: AdminGroupValues) {
  const description = values.description.trim();
  const sector = values.sector.trim();
  return {
    name: values.name.trim(),
    ...(description ? { description } : {}),
    cropId: values.cropId,
    targetAudience: values.targetAudience,
    location: {
      province: values.province,
      district: values.district,
      ...(sector ? { sector } : {}),
    },
    estimatedFarmerCount: values.estimatedFarmerCount,
  };
}
