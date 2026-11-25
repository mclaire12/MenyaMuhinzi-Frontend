import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle, MailWarning } from "lucide-react";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bffVerifyEmail } from "@/lib/auth/email-verification-server-fns";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { attemptsRemaining, isVerificationCode } from "@/lib/auth/verification-code";

type VerifySearch = { token?: string };

export const Route = createFileRoute("/auth/verify-email")({
  validateSearch: (search: Record<string, unknown>): VerifySearch => {
    const token = search["token"];
    return typeof token === "string" && token.trim() ? { token: token.trim() } : {};
  },
  head: () => ({ meta: [{ title: "Emeza email — MenyaMuhinzi" }] }),
  component: VerifyEmailPage,
});

type Status = "enter-code" | "verified" | "link-invalid" | "no-token";

const LINK_INVALID =
  "Iyi link yo kwemeza email ntikiri nzima: yarakoreshejwe, yararengeje igihe, cyangwa kode yanditswe nabi inshuro nyinshi. Saba indi email hasi.";

/**
 * Opened from the link in the verification email. The link identifies the email; the user
 * then types the 6-digit code printed in the same email. Nothing is verified on page load.
 */
function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<Status>(token ? "enter-code" : "no-token");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    if (!isVerificationCode(code)) {
      setError("Andika kode y'imibare 6 iri muri email twakohereje.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await bffVerifyEmail({ data: { token, code } });
      setStatus("verified");
    } catch (failure) {
      const parsed = parseBffError(failure);
      const remaining = attemptsRemaining(parsed.message ?? "");
      if (remaining !== null) {
        setError(`Kode wanditse si yo. Usigaranye amahirwe ${remaining}.`);
        setCode("");
      } else if (parsed.status === 400 || parsed.code === "validation") {
        setStatus("link-invalid");
      } else if (parsed.status === 429) {
        setError("Wagerageje kenshi. Tegereza umunota umwe hanyuma wongere.");
      } else {
        setError("Ntibyashobotse kwemeza email. Gerageza nyuma.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (status === "verified") {
    return (
      <AuthShell
        title="Email yawe yemejwe"
        subtitle="Subira ku rupapuro rwo kwinjira, winjire ukoresheje email cyangwa telefoni n'ijambo ry'ibanga."
      >
        <p
          className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm"
          role="status"
        >
          <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden /> Kwemeza email
          byagenze neza.
        </p>
        <Button asChild size="xl" className="mt-6 w-full">
          <Link to="/auth">Subira ku injira</Link>
        </Button>
      </AuthShell>
    );
  }

  if (status === "enter-code") {
    return (
      <AuthShell
        title="Kwemeza email"
        subtitle="Andika kode y'imibare 6 twakoherereje muri email imwe n'iyi link, hanyuma ukande Emeza."
      >
        <form className="space-y-5" noValidate onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="verification-code">Kode yo kwemeza</Label>
            <Input
              id="verification-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              className="h-14 text-center text-2xl tracking-[0.5em]"
              value={code}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "verification-code-error" : undefined}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              autoFocus
            />
            {error && (
              <p id="verification-code-error" className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" size="xl" className="w-full" disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" aria-hidden />}
            Emeza
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nta kode wabonye cyangwa yararengeje igihe?{" "}
          <button
            type="button"
            className="font-bold text-primary underline-offset-4 hover:underline"
            onClick={() => setStatus("no-token")}
          >
            Saba indi email
          </button>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={
        status === "link-invalid" ? "Ntibyashobotse kwemeza email" : "Ohereza indi email yo kwemeza"
      }
      subtitle="Andika email cyangwa telefoni wiyandikishije ukoresheje, tukoherereze indi link n'indi kode."
    >
      {status === "link-invalid" && (
        <p
          className="mb-5 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
          role="alert"
        >
          <MailWarning className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />{" "}
          {LINK_INVALID}
        </p>
      )}
      <ResendVerificationForm />
      <Button variant="link" asChild className="mt-6 w-full font-bold text-primary">
        <Link to="/auth">Subira ku injira</Link>
      </Button>
    </AuthShell>
  );
}
