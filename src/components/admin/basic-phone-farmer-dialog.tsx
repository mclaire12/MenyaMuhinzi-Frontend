import { useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BasicPhoneFarmerForm } from "@/components/admin/basic-phone-farmer-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import type { BasicPhoneFarmerSubmission } from "@/lib/api/basic-phone-farmer-types";

/**
 * Button + dialog for registering a basic-phone farmer in the backend. Shown only to staff whose
 * permissions allow it: administrators create directly, facilitators submit for approval.
 * The backend enforces the same permissions.
 */
export function BasicPhoneFarmerDialog() {
  const { permissions } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const mode: BasicPhoneFarmerSubmission | null = permissions.includes("farmers:create")
    ? "direct"
    : permissions.includes("account-requests:create")
      ? "request"
      : null;
  if (!mode) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Phone aria-hidden />
        Register basic-phone farmer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register a basic-phone farmer</DialogTitle>
            <DialogDescription>
              For farmers without a smartphone. A personal email is still required for verification
              and notifications.
            </DialogDescription>
          </DialogHeader>
          <BasicPhoneFarmerForm
            mode={mode}
            onCancel={() => setOpen(false)}
            onCreated={(created) => {
              setOpen(false);
              void queryClient.invalidateQueries({ queryKey: ["account-requests"] });
              if (created.mode === "request") {
                toast.success(`${created.fullName} was submitted for administrator approval.`);
              } else if (created.emailSent) {
                toast.success(
                  `${created.fullName} registered. A verification email was sent to ${created.email ?? "their address"}.`,
                );
              } else {
                toast.warning(
                  `${created.fullName} registered, but the verification email could not be sent. The farmer can request a new link from the sign-in page.`,
                );
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
