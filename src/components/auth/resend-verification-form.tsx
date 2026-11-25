import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bffResendVerification } from "@/lib/auth/email-verification-server-fns";
import { parseBffError } from "@/lib/auth/parse-bff-error";

/** Requests a new verification link; the confirmation never reveals whether an account exists. */
export function ResendVerificationForm({ initialIdentifier = "" }: { initialIdentifier?: string }) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier.trim()) {
      setError("Andika email cyangwa telefoni.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await bffResendVerification({ data: { identifier: identifier.trim() } });
      // Generic on purpose: the backend never reveals whether an account exists.
      setMessage(
        "Niba hari konti ihuye kandi itaremezwa, twayoherereje indi link yo kwemeza email. Reba muri email yawe (na spam).",
      );
    } catch (failure) {
      const parsed = parseBffError(failure);
      setError(
        parsed.status === 429
          ? "Ibigeragezo byinshi. Gerageza nyuma."
          : parsed.message || "Ntibyashobotse kohereza. Gerageza nyuma.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (message) {
    return (
      <p className="rounded-md border border-border bg-muted/40 p-4 text-sm" role="status">
        {message}
      </p>
    );
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="resend-identifier">Email cyangwa nimero ya telefoni</Label>
        <Input
          id="resend-identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          className="h-12"
          placeholder="jeanne@example.rw cyangwa 0788123456"
          value={identifier}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "resend-error" : undefined}
          onChange={(event) => setIdentifier(event.target.value)}
        />
        {error && (
          <p id="resend-error" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="xl" variant="outline" className="w-full" disabled={busy}>
        {busy && <LoaderCircle className="animate-spin" aria-hidden />}Ohereza indi link
      </Button>
    </form>
  );
}
