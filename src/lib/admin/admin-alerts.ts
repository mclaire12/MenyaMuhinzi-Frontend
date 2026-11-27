import { useQueries, useQuery } from "@tanstack/react-query";
import { accountRequestStatusCountQueryOptions } from "@/lib/admin/account-request-approvals";
import { adminGet, type Paginated } from "@/lib/admin/api";
import type { Permission } from "@/lib/api/types";

/** Header alerts for the admin portal, counted from backend data. */
export interface AdminAlert {
  id: string;
  text: string;
  to: "/admin/users" | "/admin/courses" | "/admin/knowledge" | "/admin/operations";
  search?: Record<string, string>;
}

type SystemFailures = {
  failures: { aiRequests: number; notificationDeliveries: number; knowledgeProcessingJobs: number };
};

const total = (path: string, query: Record<string, string>) => () =>
  adminGet<Paginated<unknown>>(path, { ...query, page: 1, limit: 1 }).then(
    (result) => result.meta.total,
  );

export function useAdminAlerts(permissions: Permission[], enabled: boolean): AdminAlert[] {
  const can = (permission: Permission) => enabled && permissions.includes(permission);
  const requests = useQuery(
    accountRequestStatusCountQueryOptions("PENDING", can("account-requests:read")),
  );
  const [courses, knowledge, system] = useQueries({
    queries: [
      {
        queryKey: ["admin-alerts", "courses"],
        queryFn: total("courses", { status: "UNDER_REVIEW" }),
        enabled: can("courses:read"),
        staleTime: 60_000,
        retry: false,
      },
      {
        queryKey: ["admin-alerts", "knowledge"],
        queryFn: total("knowledge/sources", { status: "PENDING_REVIEW" }),
        enabled: can("knowledge:read"),
        staleTime: 60_000,
        retry: false,
      },
      {
        queryKey: ["admin-alerts", "system"],
        queryFn: () => adminGet<SystemFailures>("admin/reports/system"),
        enabled: can("reports:read"),
        staleTime: 60_000,
        retry: false,
      },
    ],
  });
  const alerts: AdminAlert[] = [];
  if (requests.data) {
    alerts.push({
      id: "requests",
      text: `${requests.data} account request(s) waiting for approval.`,
      to: "/admin/users",
      search: { tab: "approvals" },
    });
  }
  if (courses.data) {
    alerts.push({
      id: "courses",
      text: `${courses.data} course(s) waiting for review.`,
      to: "/admin/courses",
      search: { status: "UNDER_REVIEW" },
    });
  }
  if (knowledge.data) {
    alerts.push({
      id: "knowledge",
      text: `${knowledge.data} Knowledge Base document(s) waiting for review.`,
      to: "/admin/knowledge",
    });
  }
  const failures = system.data?.failures;
  if (failures) {
    const failed =
      failures.aiRequests + failures.notificationDeliveries + failures.knowledgeProcessingJobs;
    if (failed > 0) {
      alerts.push({
        id: "failures",
        text: `${failed} failed background task(s): AI ${failures.aiRequests}, notifications ${failures.notificationDeliveries}, knowledge ${failures.knowledgeProcessingJobs}.`,
        to: "/admin/operations",
      });
    }
  }
  return alerts;
}
