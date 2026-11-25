import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, BookOpen, LayoutDashboard, LogOut, Menu, Settings, Sparkles, UsersRound } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { HeaderAlerts } from "@/components/header-alerts";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useAdmin } from "@/lib/admin/store";
import { facilitatorFromAccount } from "@/lib/facilitator/dashboard";
import { useLearningState } from "@/lib/mock/store";
import { facilitatorForAccount } from "@/lib/mock/services/facilitators";
import { facilitatorAttention } from "@/lib/mock/services/group-progress";
import type { Actor } from "@/lib/mock/services/courses";
import type { Facilitator, LearningState } from "@/lib/mock/types";
import type { ActorPermissions } from "@/lib/mock/workflow";

const links = [
  { to: "/facilitator", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/facilitator/courses", label: "Courses / Learn", icon: BookOpen, exact: false },
  { to: "/facilitator/teaching", label: "Generate Teaching Materials", icon: Sparkles, exact: false },
  { to: "/facilitator/groups", label: "My Groups", icon: UsersRound, exact: false },
  { to: "/facilitator/progress", label: "Group Learning Progress", icon: BarChart3, exact: false },
  { to: "/facilitator/settings", label: "Settings", icon: Settings, exact: false },
] as const;

type FacilitatorContextValue = { facilitator: Facilitator; actor: Actor; permissions: ActorPermissions; state: LearningState };
const FacilitatorContext = createContext<FacilitatorContextValue | null>(null);

export function useFacilitator() {
  const value = useContext(FacilitatorContext);
  if (!value) throw new Error("useFacilitator must be used inside the facilitator portal");
  return value;
}

export function FacilitatorLayout() {
  const { roles, user, signOut: endSession } = useAuth();
  const state = useLearningState();
  const admin = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  async function signOut() {
    await qc.cancelQueries(); qc.clear(); await endSession();
    navigate({ to: "/auth", replace: true });
  }
  if (!roles.includes("facilitator")) {
    return <div className="page-width py-16"><h1 className="text-3xl">Facilitators only</h1><p className="mt-2 text-muted-foreground">Sign in with facilitator@menyamuhinzi.rw to open the Facilitator Portal.</p></div>;
  }
  // Accounts created in the backend have no demo record; their profile comes from the session.
  const facilitator = facilitatorForAccount(state, user?.id) ?? (user ? facilitatorFromAccount(user) : null);
  if (!facilitator) {
    return <div className="page-width py-16"><h1 className="text-3xl">No facilitator profile</h1><p className="mt-2 text-muted-foreground">This account has the facilitator role but no profile in the demo data yet.</p></div>;
  }
  const permissions = { approve: !!admin.permissions.FACILITATOR.approve, publish: !!admin.permissions.FACILITATOR.publish };
  const attention = facilitatorAttention(state, facilitator.id);
  const value = { facilitator, actor: { id: facilitator.id, name: facilitator.name }, permissions, state };
  return <FacilitatorContext.Provider value={value}>
    <div className="admin-shell">
      <aside className={open ? "admin-side open" : "admin-side"}>
        <p className="admin-side-label">Facilitator</p>
        <nav aria-label="Facilitator Portal">
          {links.map((item) => <Link key={item.to} to={item.to} activeOptions={{ exact: item.exact }} activeProps={{ className: "admin-nav-active" }} onClick={() => setOpen(false)}><item.icon aria-hidden />{item.label}</Link>)}
          <button type="button" className="admin-side-logout" onClick={() => void signOut()}><LogOut aria-hidden />Logout</button>
        </nav>
      </aside>
      <div className="admin-main">
        <div className="admin-top">
          <button type="button" className="admin-menu" onClick={() => setOpen((current) => !current)}><Menu aria-hidden />Menu</button>
          <span className="text-sm text-muted-foreground">{facilitator.name} · {facilitator.title}</span>
          <HeaderAlerts count={attention.length}>{attention.map((item) => <DropdownMenuItem key={item.key} asChild className="items-start whitespace-normal">{item.to === "/facilitator/progress/$farmerId" ? <Link to={item.to} params={item.params}>{item.text}</Link> : <Link to={item.to} params={item.params}>{item.text}</Link>}</DropdownMenuItem>)}</HeaderAlerts>
        </div>
        <Outlet />
      </div>
    </div>
  </FacilitatorContext.Provider>;
}

export function PageHead({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <header className="admin-page-head fac-head"><div><h1>{title}</h1><p>{text}</p></div>{children && <div className="admin-actions">{children}</div>}</header>;
}
