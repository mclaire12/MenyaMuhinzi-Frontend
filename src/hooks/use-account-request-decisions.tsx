import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  invalidateAccountRequestQueries,
  resolveAccountRequestDecisionError,
} from "@/lib/admin/account-request-decisions";
import { approveAccountRequest, rejectAccountRequest } from "@/lib/api/account-request-service";
import { parseBffError } from "@/lib/auth/parse-bff-error";

export function useAccountRequestDecisions() {
  const queryClient = useQueryClient();

  const refresh = useCallback(
    (requestId: string) => {
      invalidateAccountRequestQueries(queryClient, requestId);
    },
    [queryClient],
  );

  const handleDecisionError = useCallback(
    (error: unknown, requestId: string) => {
      const parsed = parseBffError(error);
      toast.error(resolveAccountRequestDecisionError(parsed));
      if (parsed.status === 409 || parsed.status === 404) {
        refresh(requestId);
      }
    },
    [refresh],
  );

  const approve = useMutation({
    mutationFn: async ({ requestId, note }: { requestId: string; note?: string | undefined }) => {
      const trimmed = note?.trim();
      return approveAccountRequest(requestId, trimmed ? { note: trimmed } : {});
    },
    onSuccess: (data, variables) => {
      refresh(variables.requestId);
      // Approval alone does not allow sign-in: the applicant must verify their email first.
      if (data.emailSent === false) {
        toast.warning(
          `${data.applicant.fullName} approved, but the verification email could not be sent. They can request a new link from the sign-in page.`,
        );
      } else {
        toast.success(
          `${data.applicant.fullName} approved. A verification email was sent; they can sign in once it is confirmed.`,
        );
      }
    },
    onError: (error, variables) => handleDecisionError(error, variables.requestId),
  });

  const reject = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      rejectAccountRequest(requestId, { reason: reason.trim() }),
    onSuccess: (data, variables) => {
      refresh(variables.requestId);
      if (data.emailSent === false) {
        toast.warning(
          `${data.applicant.fullName}'s request was rejected, but the notification email could not be sent.`,
        );
      } else {
        toast.success(`${data.applicant.fullName}'s request was rejected. They were notified by email.`);
      }
    },
    onError: (error, variables) => handleDecisionError(error, variables.requestId),
  });

  const isDeciding = approve.isPending || reject.isPending;

  const decidingRequestId = useMemo(() => {
    if (approve.isPending) return approve.variables?.requestId ?? null;
    if (reject.isPending) return reject.variables?.requestId ?? null;
    return null;
  }, [
    approve.isPending,
    approve.variables?.requestId,
    reject.isPending,
    reject.variables?.requestId,
  ]);

  const isDecidingRequest = useCallback(
    (requestId: string) => isDeciding && decidingRequestId === requestId,
    [decidingRequestId, isDeciding],
  );

  return {
    approve,
    reject,
    isDeciding,
    decidingRequestId,
    isDecidingRequest,
    refresh,
  };
}
