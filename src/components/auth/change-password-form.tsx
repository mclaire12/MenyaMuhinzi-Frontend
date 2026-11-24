import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordFormSchema } from "@/lib/auth/password-schema";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { changePassword } from "@/lib/api/password-service";

export function ChangePasswordForm({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = changePasswordFormSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Amakuru ntabwo ari yo.";
      toast.error(message);
      return;
    }
    setBusy(true);
    try {
      await changePassword({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await onSuccess();
    } catch (error) {
      toast.error(parseBffError(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-5">
      <PasswordField
        id="currentPassword"
        label="Ijambo ry'ibanga rya none"
        autoComplete="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
        show={showPassword}
      />
      <PasswordField
        id="newPassword"
        label="Ijambo ry'ibanga rishya"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
        show={showPassword}
      />
      <PasswordField
        id="confirmPassword"
        label="Emeza ijambo ry'ibanga"
        autoComplete="new-password"
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
        {showPassword ? "Hisha" : "Garagaza"} amagambo y'ibanga
      </Button>
      <Button type="submit" size="xl" className="w-full" disabled={busy}>
        {busy && <LoaderCircle className="animate-spin" aria-hidden />}
        Hindura ijambo ry'ibanga
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  show,
}: {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
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
        autoComplete={autoComplete}
        required
        className="h-12"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={8}
      />
    </div>
  );
}