import { queryOptions } from "@tanstack/react-query";
import { adminGet } from "@/lib/admin/api";

/** Platform settings from the backend (GET/PATCH /settings). */
export interface PlatformSettings {
  platform: { name: string; tagline: string; supportEmail: string; supportPhone: string };
  defaultLanguage: "rw" | "en";
  defaultPublicationScope: "PLATFORM" | "TARGETED";
  adminNotifications: {
    accountRequests: boolean;
    aiFailures: boolean;
    coursePublished: boolean;
    weeklySummary: boolean;
  };
  updatedAt: string | null;
  updatedBy: string | null;
}

export const platformSettingsKey = ["platform-settings"] as const;

export function platformSettingsQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: platformSettingsKey,
    queryFn: () => adminGet<PlatformSettings>("settings"),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
