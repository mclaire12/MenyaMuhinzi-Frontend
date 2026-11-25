import {
  createFileRoute,
  Link,
  Outlet,
  useChildMatches,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import hero from "@/assets/welcome-garden.webp";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { homeForApiRoles } from "@/lib/auth/auth-routing";
import { isEmailNotVerified, loginErrorToast } from "@/lib/auth/login-messages";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { RegistrationForm } from "@/components/auth/registration-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Injira — MenyaMuhinzi" },
      { name: "description", content: "Injira cyangwa wiyandikishe kuri MenyaMuhinzi." },
      { property: "og:title", content: "Injira — MenyaMuhinzi" },
      { property: "og:description", content: "Injira cyangwa wiyandikishe kuri MenyaMuhinzi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

/**
 * /auth is also the parent of /auth/forgot, /auth/reset, /auth/verify-email and
 * /auth/google/callback; those pages render through the Outlet instead of the login form.
 */
function AuthPage() {
  const childMatches = useChildMatches();
  return childMatches.length > 0 ? <Outlet /> : <LoginPage />;
}

function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<{ message: string; unverified: boolean } | null>(
    null,
  );
  const { user, apiRoles, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) navigate({ to: homeForApiRoles(apiRoles) });
  }, [isAuthenticated, user, apiRoles, navigate]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const identifier = String(f.get("identifier"));
    const password = String(f.get("password"));
    setBusy(true);
    setLoginError(null);
    try {
      await login(identifier, password);
    } catch (error) {
      const parsed = parseBffError(error);
      const message = loginErrorToast(parsed);
      setLoginError({ message, unverified: isEmailNotVerified(parsed) });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <aside className="auth-photo">
        <figure className="auth-figure">
          <img
            src={hero}
            alt="Ubusitani bw'imboga: karoti, inyanya n'ibindi bihingwa"
            width={1024}
            height={585}
          />
          <figcaption className="auth-photo-caption">
            <Logo className="size-9 shrink-0" />
            <div>
              <h2>Iga. Hinga. Usarure neza.</h2>
              <p>Ubumenyi bushya, iminota 10 ku munsi.</p>
            </div>
          </figcaption>
        </figure>
      </aside>
      <div className="auth-form-area">
        <div className="auth-form-inner">
          <p className="eyebrow mb-4">MURAKAZA NEZA KURI MENYAMUHINZI</p>
          <h1 className="mb-2 text-4xl font-semibold">
            {mode === "in" ? "Injira" : "Iyandikishe"}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {mode === "in" ? "Komeza kwiga aho wari ugeze." : "Fungura konti ya MenyaMuhinzi."}
          </p>
          {mode === "in" ? (
            <>
              <form method="post" onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email cyangwa nimero ya telefoni</Label>
                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    inputMode="email"
                    required
                    className="h-12"
                    placeholder="jeanne@example.rw cyangwa 0788123456"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="password">Ijambo ry'ibanga</Label>
                    <Link
                      to="/auth/forgot"
                      className="text-sm font-bold text-primary hover:underline"
                    >
                      Wibagiwe?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      minLength={6}
                      required
                      className="h-12 pr-12"
                      placeholder="Andika ijambo ry'ibanga"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={
                        showPassword ? "Hisha ijambo ry'ibanga" : "Garagaza ijambo ry'ibanga"
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>
                {loginError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                  >
                    <p>{loginError.message}</p>
                    {loginError.unverified && (
                      <Link
                        to="/auth/verify-email"
                        className="mt-1 inline-block font-bold text-primary underline underline-offset-4"
                      >
                        Saba indi link yo kwemeza email
                      </Link>
                    )}
                  </div>
                )}
                <Button type="submit" size="xl" className="w-full" disabled={busy}>
                  {busy && <LoaderCircle className="animate-spin" aria-hidden />}Injira
                  {!busy && <ArrowRight aria-hidden />}
                </Button>
              </form>
              <div className="relative my-5 text-center text-xs font-bold text-muted-foreground">
                <span className="bg-background px-2">cyangwa</span>
                <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" aria-hidden />
              </div>
              <GoogleSignInButton mode="login" disabled={busy} />
              <Button
                variant="link"
                type="button"
                onClick={() => setMode("up")}
                className="mt-6 w-full text-center font-bold text-primary underline-offset-4 hover:underline"
              >
                Nta konti ufite? Iyandikishe
              </Button>
            </>
          ) : (
            <>
              <RegistrationForm onReturnToLogin={() => setMode("in")} />
              <Button
                variant="link"
                type="button"
                onClick={() => setMode("in")}
                className="mt-4 w-full text-center font-bold text-primary underline-offset-4 hover:underline"
              >
                Usanzwe ufite konti? Injira
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
