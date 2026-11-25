import { queryOptions } from "@tanstack/react-query";
import type { CurrentUserResponse } from "@/lib/api/types";
import { bffGetFacilitatorDashboard } from "@/lib/auth/facilitator-dashboard-server-fns";
import type { Facilitator } from "@/lib/mock/types";

/** Facilitator dashboard figures for the last `days` days, read from the backend. */
export function facilitatorDashboardQueryOptions(days: number, enabled: boolean) {
  return queryOptions({
    queryKey: ["facilitator-dashboard", days] as const,
    queryFn: () => {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - (days - 1));
      return bffGetFacilitatorDashboard({ data: { startDate: start.toISOString() } });
    },
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

/**
 * Portal profile for a facilitator account created in the backend (registration + approval,
 * or Users → Add user), which has no record in the local demo data. Built only from the
 * signed-in user's own profile.
 */
export function facilitatorFromAccount(user: CurrentUserResponse): Facilitator {
  return {
    id: user.id,
    accountId: user.id,
    name: user.fullName,
    email: user.email ?? "",
    phone: user.phoneNumber,
    title: user.facilitatorProfile?.professionalTitle ?? "Facilitator",
    organisation: user.facilitatorProfile?.organization ?? "",
    qualification: "",
    yearsOfExperience: 0,
    district: user.location?.district ?? "",
    specialties: [],
    language: user.preferredLanguage,
    notifications: {
      reviewDecisions: true,
      farmerQuestions: true,
      weeklySummary: false,
      smsAlerts: false,
    },
    responsibilities: [],
  };
}
