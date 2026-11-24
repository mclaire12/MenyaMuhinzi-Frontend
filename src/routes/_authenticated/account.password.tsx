import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Button } from "@/components/ui/button";
import { CHANGE_PASSWORD_SUCCESS_MESSAGE } from "@/lib/auth/password-schema";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/account/password")({
  head: () => ({
    meta: [{ title: "Hindura ijambo ry'ibanga — MenyaMuhinzi" }],
  }),
  component: ChangePasswordPage,
});

function backLinkForRoles(roles: string[]): { to: string; label: string } {
  if (roles.includes("admin")) return { to: "/admin/settings", label: "Subira ku matora" };
  if (roles.includes("facilitator")) return { to: "/facilitator/settings", label: "Subira ku matora" };
  if (roles.includes("basic_phone_farmer")) return { to: "/phone", label: "Subira" };
  return { to: "/me", label: "Subira ku mwirondoro" };
}

function ChangePasswordPage() {
  const { signOut, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const back = backLinkForRoles(roles);

  async function handleSuccess() {
    toast.success(CHANGE_PASSWORD_SUCCESS_MESSAGE);
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="page-width py-10">
      <p className="eyebrow mb-2">KONTI</p>
      <h1 className="text-3xl font-semibold">Hindura ijambo ry'ibanga</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Hitamo ijambo ry'ibanga rikomeye—inyuguti n'imibare, nibura inyuguti 8. Nyuma yo guhindura,
        usabwe kwinjira ukoresheje ijambo rishya; sesiyo y'ubu irahagarikwa.
      </p>
      <div className="mt-8 max-w-md rounded-2xl border bg-card p-6">
        <ChangePasswordForm onSuccess={handleSuccess} />
      </div>
      <Button variant="link" asChild className="mt-6 px-0 font-bold text-primary">
        <Link to={back.to}>{back.label}</Link>
      </Button>
    </div>
  );
}