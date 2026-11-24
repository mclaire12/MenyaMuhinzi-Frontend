import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { googleErrorToast } from "@/lib/auth/google-messages";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { beginGoogleSignIn, getGoogleSignInStatus, type GoogleOAuthStartInput } from "@/lib/api/google-auth-service";

export function GoogleSignInButton({
  mode,
  registerContext,
  disabled,
}: {
  mode: "login" | "register";
  registerContext?: Omit<GoogleOAuthStartInput, "mode">;
  disabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await getGoogleSignInStatus();
        if (!cancelled) setEnabled(status.enabled);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  async function start() {
    if (mode === "register") {
      if (!registerContext?.phoneNumber?.trim()) {
        toast.error("Andika nimero ya telefoni mbere yo gukomeza na Google.");
        return;
      }
      if (!registerContext.fullName?.trim()) {
        toast.error("Andika amazina yawe mbere yo gukomeza na Google.");
        return;
      }
      if (!registerContext.accountType) {
        toast.error("Hitamo ubwoko bwa konti.");
        return;
      }
    }
    setBusy(true);
    try {
      const payload: GoogleOAuthStartInput = {
        mode,
        ...registerContext,
      };
      const { authorizationUrl } = await beginGoogleSignIn(payload);
      window.location.assign(authorizationUrl);
    } catch (error) {
      toast.error(googleErrorToast(parseBffError(error)));
      setBusy(false);
    }
  }

  return (
  <Button
      type="button"
      variant="outline"
      size="xl"
      className="w-full"
      disabled={disabled || busy}
      onClick={start}
    >
      {busy && <LoaderCircle className="animate-spin" aria-hidden />}
      {mode === "login" ? "Injira na Google" : "Iyandikishe na Google"}
    </Button>
  );
}