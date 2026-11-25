import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import hero from "@/assets/welcome-garden.webp";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { homeForApiRoles } from "@/lib/auth/auth-routing";
import { loginErrorToast } from "@/lib/auth/login-messages";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { demoAccounts } from "@/lib/demo-auth";
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

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { user, apiRoles, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) navigate({ to: homeForApiRoles(apiRoles) });
  }, [isAuthenticated, user, apiRoles, navigate]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true);
    try {
      await login(email, password);
    } catch (error) {
      toast.error(loginErrorToast(parseBffError(error)));
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
          {mode === "in" && (
            <div className="demo-grid" aria-label="Konti z'igerageza">
              <p className="text-xs font-bold text-muted-foreground">
                Konti z&apos;igerageza — umuyobozi ukoresha ijambo ry&apos;ibanga ryo mu backend .env
              </p>
              {demoAccounts.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  className="demo-card"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                >
                  <Logo className="size-8" />
                  <span className="min-w-0">
                    <b>{d.label}</b>
                    <small>{d.email}</small>
                  </span>
                  <span className="text-xs font-bold text-primary">{d.note}</span>
                </button>
              ))}
            </div>
          )}
          {mode === "in" ? (
            <>
              <form method="post" onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="h-12"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    minLength={6}
                    required
                    className="h-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
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
