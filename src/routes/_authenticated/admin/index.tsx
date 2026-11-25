import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHead } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  adminDashboardQueryOptions,
  countFor,
  dailySeries,
  provinceLabels,
  sumCounts,
} from "@/lib/admin/backend-people";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import type { Province } from "@/lib/api/types";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Dashboard });

const colors = ["#055225", "#66a721", "#e99a3d", "#e56a4d"];

/** Every figure here comes from the backend database (GET /admin/reports/*). */
function Dashboard() {
  const { permissions, loading: authLoading } = useAuth();
  const canRead = permissions.includes("reports:read");
  const [days, setDays] = useState(30);
  const report = useQuery(adminDashboardQueryOptions(days, canRead && !authLoading));

  const view = useMemo(() => {
    if (!report.data) return null;
    const { dashboard, registrations } = report.data;
    const users = dashboard.users;
    const courses = dashboard.learning.coursesByStatus;
    const channels = [
      { name: "Smartphone", value: users.smartphoneFarmers },
      { name: "Basic phone", value: users.basicPhoneFarmers },
    ];
    const places = registrations.byProvince
      .map((row) => ({
        province: provinceLabels[row.key as Province] ?? row.key,
        farmers: row.count,
      }))
      .sort((a, b) => b.farmers - a.farmers);
    const stats: [string, number][] = [
      ["Users", users.total],
      ["Active accounts", countFor(users.byStatus, "ACTIVE")],
      ["Farmers", users.smartphoneFarmers + users.basicPhoneFarmers],
      ["Smartphone", users.smartphoneFarmers],
      ["Basic phone", users.basicPhoneFarmers],
      ["Facilitators", users.facilitators],
      ["Pending approvals", registrations.pendingAccountRequests],
      ["Courses", sumCounts(courses)],
      ["Published", countFor(courses, "PUBLISHED")],
      ["Drafts", countFor(courses, "DRAFT")],
      ["Farmer groups", dashboard.groups.activeFacilitatorGroups],
      [
        `New farmers (${days} days)`,
        registrations.registrationsOverTime.reduce((sum, point) => sum + point.count, 0),
      ],
      ["Enrollments", sumCounts(dashboard.learning.enrollmentsByStatus)],
      ["Lessons completed", dashboard.learning.completedLessonProgress],
    ];
    return {
      stats,
      channels,
      places,
      trend: dailySeries(registrations.registrationsOverTime, Math.min(days, 30)),
    };
  }, [report.data, days]);

  const head = (
    <PageHead
      title="Dashboard"
      text="Figures are read live from the platform database: accounts, farmer registrations, courses, groups and learning activity."
    />
  );

  if (authLoading)
    return (
      <>
        {head}
        <p className="fac-empty">Loading…</p>
      </>
    );
  if (!canRead) {
    return (
      <>
        {head}
        <p className="fac-empty">You do not have permission to view platform reports.</p>
      </>
    );
  }
  if (report.isError) {
    const failure = parseBffError(report.error);
    return (
      <>
        {head}
        <div className="fac-empty" role="alert">
          <p>
            {failure.status === 401
              ? "Your session has expired. Sign in again to see the dashboard."
              : "The dashboard could not be loaded from the server."}
          </p>
          <Button className="mt-3" variant="outline" onClick={() => void report.refetch()}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {head}
      <label className="admin-filters">
        Range
        <select
          aria-label="Date range"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </label>
      {!view ? (
        <p className="fac-empty">Loading dashboard…</p>
      ) : (
        <>
          <div className="admin-stats" aria-busy={report.isFetching}>
            {view.stats.map(([label, value]) => (
              <article key={label} className="admin-stat">
                <span>{label}</span>
                <b>{value}</b>
              </article>
            ))}
          </div>
          <div className="admin-grid-2">
            <article className="admin-panel">
              <h2 className="mb-3 text-lg">New farmer registrations</h2>
              {view.trend.every((row) => row.count === 0) ? (
                <p>No farmer registrations in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={view.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      dataKey="count"
                      name="Farmers"
                      stroke="#055225"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </article>
            <article className="admin-panel">
              <h2 className="mb-3 text-lg">Access channel</h2>
              {view.channels.every((row) => row.value === 0) ? (
                <p>No farmers yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={view.channels}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                    >
                      {view.channels.map((entry, index) => (
                        <Cell key={entry.name} fill={colors[index] ?? colors[0]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </article>
            <article className="admin-panel">
              <h2 className="mb-3 text-lg">New farmers by province</h2>
              {view.places.length === 0 ? (
                <p>No farmer registrations in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={view.places}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="province" interval={0} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="farmers" name="Farmers" fill="#66a721" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </article>
          </div>
        </>
      )}
    </>
  );
}
