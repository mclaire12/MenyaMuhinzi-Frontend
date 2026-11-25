import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Bot, LayoutDashboard, Library, LogOut, Menu, MoreHorizontal, Server, Settings, Users, UsersRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { HeaderAlerts } from "@/components/header-alerts";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { adminActor } from "@/lib/admin/courses";
import { systemAlerts } from "@/lib/admin/platform";
import { useAdmin } from "@/lib/admin/store";
import { useLearningState } from "@/lib/mock/store";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users, exact: false },
  { to: "/admin/groups", label: "Groups", icon: UsersRound, exact: false },
  { to: "/admin/courses", label: "Courses", icon: BookOpen, exact: false },
  { to: "/admin/knowledge", label: "Knowledge Base", icon: Library, exact: false },
  { to: "/admin/ai", label: "AI Management", icon: Bot, exact: false },
  { to: "/admin/operations", label: "System Operations", icon: Server, exact: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

export function useAdminActor() {
  const { user } = useAuth();
  const name = user?.name ?? "Administrator";
  return { name, actor: adminActor(name) };
}

export function AdminLayout() {
  const { roles, user, signOut: endSession } = useAuth();
  const data = useAdmin();
  const learning = useLearningState();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  async function signOut() {
    await qc.cancelQueries(); qc.clear(); await endSession();
    navigate({ to: "/auth", replace: true });
  }
  if (!roles.includes("admin")) {
    return <div className="page-width py-16"><h1 className="text-3xl">Administrators only</h1><p className="mt-2 text-muted-foreground">Sign in with admin@menyamuhinzi.rw to open the Admin Portal.</p></div>;
  }
  const alerts = systemAlerts(data, learning);
  return <div className="admin-shell">
    <aside className={open ? "admin-side open" : "admin-side"}>
      <p className="admin-side-label">Administrator</p>
      <nav aria-label="Admin Portal">
        {links.map((item) => <Link key={item.to} to={item.to} activeOptions={{ exact: item.exact }} activeProps={{ className: "admin-nav-active" }} onClick={() => setOpen(false)}><item.icon aria-hidden />{item.label}</Link>)}
        <button type="button" className="admin-side-logout" onClick={() => void signOut()}><LogOut aria-hidden />Logout</button>
      </nav>
    </aside>
    <div className="admin-main">
      <div className="admin-top">
        <button type="button" className="admin-menu" onClick={() => setOpen((value) => !value)}><Menu aria-hidden />Menu</button>
        <span className="text-sm text-muted-foreground">{user?.name} · {data.platform.name} administrator</span>
        <HeaderAlerts count={alerts.length}>{alerts.map((alert) => <DropdownMenuItem key={alert.id} asChild className="items-start whitespace-normal"><Link to={alert.to} search={alert.search as never}>{alert.text}</Link></DropdownMenuItem>)}</HeaderAlerts>
      </div>
      <Outlet />
    </div>
  </div>;
}

export function PageHead({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <header className="admin-page-head fac-head"><div><h1>{title}</h1><p>{text}</p></div>{children && <div className="admin-actions">{children}</div>}</header>;
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className="admin-actions mb-4" role="tablist">{options.map((option) => <Button key={option.value} type="button" size="sm" role="tab" aria-selected={value === option.value} variant={value === option.value ? "default" : "outline"} onClick={() => onChange(option.value)}>{option.label}</Button>)}</div>;
}

const toneStatus = { ok: "approved", warn: "pending_review", bad: "rejected", info: "published", muted: "draft" } as const;

export function Pill({ tone, children }: { tone: keyof typeof toneStatus; children: ReactNode }) {
  return <span className="status-pill" data-status={toneStatus[tone]}>{children}</span>;
}

export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Actions for ${label}`}><MoreHorizontal aria-hidden /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">{children}</DropdownMenuContent>
  </DropdownMenu>;
}

export { formatDate, formatDateTime } from "@/components/facilitator/ui";
export const withinDays = (iso: string | null | undefined, days: number) => !!iso && Date.now() - new Date(iso).getTime() <= days * 86400000;
