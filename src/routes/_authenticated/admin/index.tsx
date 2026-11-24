import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHead } from "@/components/admin/shell";
import { useAuth } from "@/hooks/use-auth";
import { accountRequestStatusCountQueryOptions } from "@/lib/admin/account-request-approvals";
import { locationOf } from "@/lib/admin/people";
import { useAdmin } from "@/lib/admin/store";
import { useLearningState } from "@/lib/mock/store";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Dashboard });

const colors = ["#055225", "#66a721", "#e99a3d", "#e56a4d"];

function within(iso: string, days: number) {
  return Date.now() - new Date(iso).getTime() <= days * 86400000;
}

function Dashboard() {
  const admin = useAdmin();
  const learning = useLearningState();
  const { permissions, loading: authLoading } = useAuth();
  const canReadApprovals = permissions.includes("account-requests:read");
  const pendingApprovalsQuery = useQuery(
    accountRequestStatusCountQueryOptions("PENDING", canReadApprovals && !authLoading),
  );
  const [days, setDays] = useState(30);
  const view = useMemo(() => {
    const users = admin.users;
    const farmers = users.filter((user) => user.role === "SMARTPHONE_FARMER" || user.role === "BASIC_PHONE_FARMER");
    const registrations = users.filter((user) => within(user.registeredAt, days));
    const span = Math.min(days, 14);
    const trend = Array.from({ length: span }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (span - 1 - index));
      const key = date.toISOString().slice(0, 10);
      return { day: key.slice(5), count: registrations.filter((user) => user.registeredAt.slice(0, 10) === key).length };
    });
    const channels = [
      { name: "Smartphone", value: farmers.filter((user) => user.role === "SMARTPHONE_FARMER").length },
      { name: "Basic phone", value: farmers.filter((user) => user.role === "BASIC_PHONE_FARMER").length },
    ];
    const districts = [...new Set(farmers.map((user) => locationOf(learning, user).district).filter(Boolean))];
    const places = districts.map((district) => ({ district, farmers: farmers.filter((user) => locationOf(learning, user).district === district).length }));
    const completions = learning.progress.filter((item) => item.status === "completed" && item.completedAt && within(item.completedAt, days));
    const active = new Set(learning.progress.filter((row) => within(row.updatedAt, days)).map((row) => row.learnerId)).size;
    return { trend, channels, places, registrations: registrations.length, completions: completions.length, active, farmers: farmers.length };
  }, [admin, learning, days]);
  const courses = learning.courses;
  let pendingApprovals: string | number = "—";
  if (canReadApprovals && !authLoading) {
    if (pendingApprovalsQuery.isLoading) pendingApprovals = "…";
    else if (!pendingApprovalsQuery.isError && typeof pendingApprovalsQuery.data === "number") {
      pendingApprovals = pendingApprovalsQuery.data;
    }
  }
  const stats = [
    ["Users", admin.users.length],
    ["Farmers", view.farmers],
    ["Smartphone", view.channels[0]?.value ?? 0],
    ["Basic phone", view.channels[1]?.value ?? 0],
    ["Facilitators", admin.users.filter((user) => user.role === "FACILITATOR").length],
    ["Pending approvals", pendingApprovals],
    ["Courses", courses.length],
    ["Published", courses.filter((course) => course.status === "published").length],
    ["Drafts", courses.filter((course) => course.status === "draft").length],
    ["Groups", admin.targetGroups.filter((group) => group.status === "active").length],
    ["New registrations", view.registrations],
    ["Active learners", view.active],
    ["Lessons completed", view.completions],
  ];
  return <>
    <PageHead title="Dashboard" text="Counts below are calculated from accounts, courses, groups and learning activity on the platform." />
    <label className="admin-filters">Range<select aria-label="Date range" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
    <div className="admin-stats">{stats.map(([label, value]) => <article key={label} className="admin-stat"><span>{label}</span><b>{value}</b></article>)}</div>
    <div className="admin-grid-2">
      <article className="admin-panel"><h2 className="mb-3 text-lg">New registrations</h2>{view.trend.every((row) => row.count === 0) ? <p>No registrations in this range.</p> : <ResponsiveContainer width="100%" height={220}><LineChart data={view.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="count" stroke="#055225" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>}</article>
      <article className="admin-panel"><h2 className="mb-3 text-lg">Access channel</h2>{view.channels.every((row) => row.value === 0) ? <p>No farmers yet.</p> : <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={view.channels} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>{view.channels.map((entry, index) => <Cell key={entry.name} fill={colors[index] ?? colors[0]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>}</article>
      <article className="admin-panel"><h2 className="mb-3 text-lg">Farmers by district</h2>{view.places.length === 0 ? <p>No farmers yet.</p> : <ResponsiveContainer width="100%" height={220}><BarChart data={view.places}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="district" interval={0} angle={-35} textAnchor="end" height={58} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="farmers" fill="#66a721" /></BarChart></ResponsiveContainer>}</article>
    </div>
  </>;
}
