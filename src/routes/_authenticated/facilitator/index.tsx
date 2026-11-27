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
import { PageHead } from "@/components/facilitator/shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { countFor, dailySeries, sumCounts } from "@/lib/admin/backend-people";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { facilitatorDashboardQueryOptions } from "@/lib/facilitator/dashboard";

export const Route = createFileRoute("/_authenticated/facilitator/")({ component: Dashboard });

const colors = ["#055225", "#66a721", "#e99a3d", "#e56a4d"];

/**
 * Same layout as the admin dashboard. Every figure is read from the backend
 * (GET /facilitator/reports/dashboard) and limited to the farmers in your own groups.
 */
function Dashboard() {
  const { permissions, loading: authLoading } = useAuth();
  const canRead = permissions.includes("facilitator-reports:read");
  const [days, setDays] = useState(30);
  const report = useQuery(facilitatorDashboardQueryOptions(days, canRead && !authLoading));

  const view = useMemo(() => {
    const data = report.data;
    if (!data) return null;
    const smartphone = countFor(data.farmersByType, "SMARTPHONE");
    const basicPhone = countFor(data.farmersByType, "BASIC_PHONE");
    const channels = [
      { name: "Smartphone", value: smartphone },
      { name: "Basic phone", value: basicPhone },
    ];
    const places = data.farmersByDistrict
      .map((row) => ({ district: row.key, farmers: row.count }))
      .sort((a, b) => b.farmers - a.farmers);
    const stats: [string, number][] = [
      ["Groups", data.groups.length],
      ["Farmers", data.farmersInScope],
      ["Smartphone", smartphone],
      ["Basic phone", basicPhone],
      ["Courses", sumCounts(data.coursesByStatus)],
      ["Published", countFor(data.coursesByStatus, "PUBLISHED")],
      ["Drafts", countFor(data.coursesByStatus, "DRAFT")],
      [
        "Courses assigned to groups",
        data.groups.reduce((sum, group) => sum + group.assignedCourses, 0),
      ],
      ["Enrollments", sumCounts(data.enrollmentsByStatus)],
      [`Active learners (${days} days)`, data.activeLearnersInRange],
      [`Lessons completed (${days} days)`, data.completedLessonsInRange],
      ["Assessment attempts", sumCounts(data.assessmentAttemptsByStatus)],
    ];
    return {
      stats,
      channels,
      places,
      trend: dailySeries(data.completionsOverTime, Math.min(days, 30)),
    };
  }, [report.data, days]);

  const head = (
    <PageHead
      title="Dashboard"
      text="Figures are read live from the platform database and cover only the farmers in your own groups."
    />
  );

  if (authLoading) {
    return (
      <>
        {head}
        <p className="fac-empty">Loading…</p>
      </>
    );
  }
  if (!canRead) {
    return (
      <>
        {head}
        <p className="fac-empty">You do not have permission to view facilitator reports.</p>
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
              <h2 className="mb-3 text-lg">Lesson completions</h2>
              {view.trend.every((row) => row.count === 0) ? (
                <p>No lesson completions in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={view.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      dataKey="count"
                      name="Lessons"
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
                <p>No farmers in your groups yet.</p>
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
              <h2 className="mb-3 text-lg">Farmers by district</h2>
              {view.places.length === 0 ? (
                <p>No farmers in your groups yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={view.places}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="district" interval={0} tick={{ fontSize: 11 }} />
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
