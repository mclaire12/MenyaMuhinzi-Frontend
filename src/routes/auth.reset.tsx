import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { resetPasswordSchema } from "@/lib/auth/password-schema";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { resetPassword } from "@/lib/api/password-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetSearch = { token?: string };

export const Route = createFileRoute("/auth/reset")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    ...(typeof search["token"] === "string" && search["token"].trim()
      ? { token: search["token"].trim() }
      : {}),
  }),
  head: () => ({
    meta: [{ title: "Shyiraho ijambo ry'ibanga rishya — MenyaMuhinzi" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const token = search["token"] ?? "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ token, newPassword, confirmPassword });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Amakuru ntabwo ari yo.";
      toast.error(message);
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ token: parsed.data.token, newPassword: parsed.data.newPassword });
      setDone(true);
      toast.success("Ijambo ry'ibanga ryashyizweho. Injira ukoresheje ijambo rishya.");
    } catch (error) {
      toast.error(parseBffError(error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Ihuza rishobora kuba ritariyo"
        subtitle="Fungura ihuza ryoherejwe kuri email cyangwa SMS, cyangwa saba ihuza rishya."
      >
        <Button asChild size="xl" className="w-full">
          <Link to="/auth/forgot">Saba gusubiza ijambo ry'ibanga</Link>
        </Button>
        <Button variant="link" asChild className="mt-6 w-full font-bold text-primary">
          <Link to="/auth">Subira ku injira</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Shyiraho ijambo ry'ibanga rishya"
      subtitle="Hitamo ijambo ry'ibanga rikomeye—inyuguti n'imibare, nibura inyuguti 8."
    >
      {done ? (
        <Button size="xl" className="w-full" onClick={() => navigate({ to: "/auth" })}>
          Injira
        </Button>
      ) : (
        <form method="post" onSubmit={submit} className="space-y-5">
          <HiddenTokenInput token={token} />
          <PasswordField
            id="newPassword"
            label="Ijambo ry'ibanga rishya"
            value={newPassword}
            onChange={setNewPassword}
            show={showPassword}
          />
          <PasswordField
            id="confirmPassword"
            label="Emeza ijambo ry'ibanga"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showPassword}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? "Hisha" : "Garagaza"} ijambo ry'ibanga
          </Button>
          <Button type="submit" size="xl" className="w-full" disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" aria-hidden />}
            Bika ijambo ry'ibanga
          </Button>
        </form>
      )}
      {!done && (
        <Button variant="link" asChild className="mt-6 w-full font-bold text-primary">
          <Link to="/auth">Subira ku injira</Link>
        </Button>
      )}
    </AuthShell>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        required
        className="h-12"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={8}
      />
    </div>
  );
}

function HiddenTokenInput({ token }: { token: string }) {
  return <input type="hidden" name="token" value={token} readOnly />;
}