import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { homeForApiRoles } from "@/lib/auth/auth-routing";
import { googleErrorToast } from "@/lib/auth/google-messages";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { completeGoogleSignIn } from "@/lib/api/google-auth-service";
import { useAuth } from "@/hooks/use-auth";

type CallbackSearch = { code?: string; state?: string; error?: string };

export const Route = createFileRoute("/auth/google/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    ...(typeof search.code === "string" ? { code: search.code } : {}),
    ...(typeof search.state === "string" ? { state: search.state } : {}),
    ...(typeof search.error === "string" ? { error: search.error } : {}),
  }),
  head: () => ({
    meta: [{ title: "Google sign-in — MenyaMuhinzi" }],
  }),
  component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (search.error) {
      const text =
        search.error === "access_denied"
          ? "Wahagaritse Google sign-in."
          : "Google sign-in ntiyashoboye.";
      setMessage(text);
      toast.error(text);
      return;
    }

    const { code, state } = search;
    if (!code || !state) {
      setMessage("Ihuza rishobora kuba ritariyo.");
      return;
    }

    void (async () => {
      try {
        const result = await completeGoogleSignIn({
          code,
          state,
          callbackUrl: window.location.href,
        });
        const full = await refreshUser();
        const roles = full?.roles ?? result.user.roles;
        toast.success("Injiye neza.");
        navigate({ to: homeForApiRoles(roles) });
      } catch (error) {
        const parsed = parseBffError(error);
        const text = googleErrorToast(parsed);
        setMessage(text);
        toast.error(text);
      }
    })();
  }, [navigate, refreshUser, search]);

  if (!message) {
    return (
      <AuthShell title="Gusuzuma Google" subtitle="Tegereza gato…">
        <div className="flex justify-center py-6">
          <LoaderCircle className="size-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Google sign-in" subtitle={message}>
      <Button asChild size="xl" className="w-full">
        <Link to="/auth">Subira ku injira</Link>
      </Button>
    </AuthShell>
  );
}