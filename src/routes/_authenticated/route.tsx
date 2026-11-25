import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const BASIC_PHONE_ALLOWED_PATHS = ["/phone", "/account/password"];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedGate,
});

function AuthenticatedGate() {
  const { user, loading, isAuthenticated, sessionUnavailable, roles } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (sessionUnavailable) return;
    if (!isAuthenticated) navigate({ to: "/auth", replace: true });
  }, [loading, sessionUnavailable, isAuthenticated, navigate]);

  // Basic-phone farmers only use the testing portal (and can change their password).
  const basicPhoneBlocked =
    isAuthenticated &&
    roles.includes("basic_phone_farmer") &&
    !BASIC_PHONE_ALLOWED_PATHS.includes(pathname);

  useEffect(() => {
    if (basicPhoneBlocked) navigate({ to: "/phone", replace: true });
  }, [basicPhoneBlocked, navigate]);

  if (loading) {
    return (
      <div className="page-width flex min-h-[40vh] items-center justify-center py-16">
        <LoaderCircle className="size-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Gusuzuma umukiriya…</span>
      </div>
    );
  }

  if (sessionUnavailable && !user) {
    return (
      <div className="page-width py-16">
        <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Serivisi ntiboneka by'agateganyo</h1>
          <p className="mt-3 text-muted-foreground">
            Ntitubashije kugenzura sesiyo yawe. Ongera ugerageze mu kanya gato.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  // Never render staff or smartphone-farmer pages for a basic-phone farmer, even for one frame.
  if (basicPhoneBlocked) return null;

  return <Outlet />;
}