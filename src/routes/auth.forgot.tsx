import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { FORGOT_PASSWORD_CONFIRMATION, normalizeForgotIdentifier } from "@/lib/auth/password-schema";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { requestPasswordReset } from "@/lib/api/password-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({
    meta: [{ title: "Subiza ijambo ry'ibanga — MenyaMuhinzi" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = identifier.trim();
    if (!value) {
      toast.error("Andika email cyangwa telefoni.");
      return;
    }
    setBusy(true);
    try {
      const result = await requestPasswordReset(normalizeForgotIdentifier(value));
      setSubmitted(true);
      toast.success(result.message || FORGOT_PASSWORD_CONFIRMATION);
    } catch (error) {
      const parsed = parseBffError(error);
      toast.error(parsed.message || "Ntibyashoboye kohereza ubusabe. Gerageza nyuma.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Wibagiwe ijambo ry'ibanga?"
      subtitle="Andika email cyangwa telefoni ukoresheje mu kwiyandikisha. Uzahabwa uburyo bwo gusubiza ijambo ry'ibanga."
    >
      {submitted ? (
        <p className="rounded-md border border-border bg-muted/40 p-4 text-sm">
          {FORGOT_PASSWORD_CONFIRMATION}
        </p>
      ) : (
        <form method="post" onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email cyangwa telefoni</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              className="h-12"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="jeanne@example.rw cyangwa 0788123456"
            />
          </div>
          <Button type="submit" size="xl" className="w-full" disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" aria-hidden />}
            Kohereza ubusabe
          </Button>
        </form>
      )}
      <Button variant="link" asChild className="mt-6 w-full font-bold text-primary">
        <Link to="/auth">Subira ku injira</Link>
      </Button>
    </AuthShell>
  );
}