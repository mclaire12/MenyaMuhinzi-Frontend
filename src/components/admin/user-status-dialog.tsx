import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminUsersKey, statusActionCopy } from "@/lib/admin/backend-people";
import type { ManageableAccountStatus } from "@/lib/api/admin-people-types";
import { bffUpdateUserStatus } from "@/lib/auth/admin-people-server-fns";
import { parseBffError } from "@/lib/auth/parse-bff-error";

export type UserStatusChange = {
  user: { id: string; fullName: string };
  status: ManageableAccountStatus;
} | null;

/** Changes an account status in the backend (PATCH /users/:id/status). */
export function UserStatusDialog({
  change,
  onClose,
}: {
  change: UserStatusChange;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setReason("");
    setError("");
  }, [change]);

  const mutation = useMutation({
    mutationFn: (input: { id: string; status: ManageableAccountStatus; reason?: string }) =>
      bffUpdateUserStatus({ data: input }),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: adminUsersKey });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success(
        `${change?.user.fullName ?? "The user"} ${statusActionCopy[input.status].done}.`,
      );
      onClose();
    },
    onError: (failure) => {
      const parsed = parseBffError(failure);
      setError(
        parsed.status === 403
          ? "You do not have permission to change this account's status."
          : parsed.message || "The status could not be changed. Try again.",
      );
    },
  });

  if (!change) return null;
  const copy = statusActionCopy[change.status];
  const needsReason = change.status === "SUSPENDED";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!change) return;
    const trimmed = reason.trim();
    if ((needsReason || trimmed) && trimmed.length < 5) {
      setError("Give a reason of at least 5 characters.");
      return;
    }
    mutation.mutate({
      id: change.user.id,
      status: change.status,
      ...(trimmed ? { reason: trimmed } : {}),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {change.user.fullName}: {copy.text}
            </DialogDescription>
          </DialogHeader>
          <label className="mt-3 grid gap-1 text-sm font-bold">
            {needsReason ? "Reason (required)" : "Reason (optional)"}
            <textarea
              className="rounded-md border p-2 font-normal"
              rows={3}
              maxLength={500}
              value={reason}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
              }}
            />
          </label>
          {error && (
            <p className="fac-field-error mt-2" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              {copy.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
