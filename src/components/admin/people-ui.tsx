import { useState } from "react";
import { toast } from "sonner";
import { useAdminActor } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REJECT_REASON_MAX, validateRejectReason } from "@/lib/admin/account-request-decisions";
import { roleLabels } from "@/lib/admin/people";
import { rejectUser } from "@/lib/admin/people";
import type { AccountStatus, PortalUser } from "@/lib/admin/types";
import type { UserRole } from "@/lib/api/types";

export type AccountRequestDecisionTarget = {
  requestId: string;
  name: string;
  requestedRole: UserRole;
};

export const statusTone = (status: AccountStatus) =>
  status === "active"
    ? "ok"
    : status === "pending"
      ? "warn"
      : status === "rejected" || status === "suspended"
        ? "bad"
        : "muted";

export function AccountRequestApproveDialog({
  target,
  submitting,
  onClose,
  onConfirm,
}: {
  target: AccountRequestDecisionTarget | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (note: string | undefined) => void;
}) {
  const [note, setNote] = useState("");
  const close = () => {
    setNote("");
    onClose();
  };
  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {target?.name ?? ""}?</DialogTitle>
          <DialogDescription>
            {target
              ? `The ${roleLabels[target.requestedRole].toLowerCase()} account becomes active${
                  target.requestedRole === "BASIC_PHONE_FARMER"
                    ? " and can learn by USSD and IVR"
                    : ""
                }.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <label className="admin-form">
          Note (optional)
          <textarea
            rows={3}
            value={note}
            disabled={submitting}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note for the decision record"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={close}>
            Cancel
          </Button>
          <Button disabled={submitting} onClick={() => onConfirm(note.trim() ? note : undefined)}>
            {submitting ? "Approving…" : "Approve request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccountRequestRejectDialog({
  target,
  submitting,
  onClose,
  onConfirm,
}: {
  target: AccountRequestDecisionTarget | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const close = () => {
    setReason("");
    setFieldError(null);
    onClose();
  };
  function submit() {
    const error = validateRejectReason(reason);
    if (error) {
      setFieldError(error);
      return;
    }
    onConfirm(reason.trim());
  }
  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {target?.name ?? ""}?</DialogTitle>
          <DialogDescription>
            The request is marked rejected and the account cannot be used. A reason is required for
            the record.
          </DialogDescription>
        </DialogHeader>
        <label className="admin-form">
          Reason (required)
          <textarea
            rows={3}
            value={reason}
            maxLength={REJECT_REASON_MAX}
            disabled={submitting}
            aria-invalid={!!fieldError}
            onChange={(event) => {
              setReason(event.target.value);
              if (fieldError) setFieldError(null);
            }}
            placeholder="For example: duplicate request or invalid phone number"
          />
          {fieldError ? <span className="text-sm text-destructive">{fieldError}</span> : null}
        </label>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={submitting} onClick={submit}>
            {submitting ? "Rejecting…" : "Reject request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDialog({ user, onClose }: { user: PortalUser | null; onClose: () => void }) {
  const { name } = useAdminActor();
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onClose();
  };
  return (
    <Dialog
      open={!!user}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {user?.name}?</DialogTitle>
          <DialogDescription>
            The request is marked rejected and the account cannot be used. You can add a reason for
            the record.
          </DialogDescription>
        </DialogHeader>
        <label className="admin-form">
          Reason (optional)
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: duplicate request"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!user) return;
              const error = rejectUser(name, user.id, reason);
              if (error) toast.error(error);
              else toast.success(`${user.name}'s request was rejected.`);
              close();
            }}
          >
            Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
