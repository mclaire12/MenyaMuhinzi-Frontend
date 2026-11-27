import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import {
  AccountRequestApproveDialog,
  AccountRequestRejectDialog,
} from "@/components/admin/people-ui";
import { formatDate, formatDateTime, PageHead, Pill } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { useAccountRequestDecisions } from "@/hooks/use-account-request-decisions";
import { useAuth } from "@/hooks/use-auth";
import { roleLabels } from "@/lib/admin/people";
import {
  accountRequestDetailQueryOptions,
  formatFarmerCategory,
  formatFarmerType,
  formatPreferredLanguage,
  formatProvince,
  isFacilitatorRequestRole,
  isFarmerRequestRole,
  parseAccountRequestDetailError,
  requestStatusLabel,
  resolveAccountRequestDetailErrorMessage,
  shortDisplayId,
  submissionChannelLabel,
} from "@/lib/admin/account-request-detail";
import type { AccountRequestResponse } from "@/lib/api/account-request-types";

export const Route = createFileRoute("/_authenticated/admin/users/requests/$requestId")({
  component: AccountRequestDetailPage,
});

function requestStatusTone(
  status: AccountRequestResponse["status"],
): "warn" | "ok" | "bad" {
  if (status === "PENDING") return "warn";
  if (status === "APPROVED") return "ok";
  return "bad";
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function AccountRequestDetailPage() {
  const { requestId } = Route.useParams();
  const { permissions, loading: authLoading } = useAuth();
  const canRead = permissions.includes("account-requests:read");
  const canDecide = permissions.includes("account-requests:decide");
  const query = useQuery(accountRequestDetailQueryOptions(requestId, canRead && !authLoading));
  const decisions = useAccountRequestDecisions();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (authLoading) {
    return <p className="fac-empty">Loading account request…</p>;
  }

  if (!canRead) {
    return (
      <>
        <BackToApprovals />
        <PageHead
          title="Access denied"
          text="You need the account-requests:read permission to open account request details."
        />
      </>
    );
  }

  if (query.isLoading) {
    return (
      <>
        <BackToApprovals />
        <p className="fac-empty">Loading account request…</p>
      </>
    );
  }

  if (query.isError) {
    const message = resolveAccountRequestDetailErrorMessage(
      parseAccountRequestDetailError(query.error),
    );
    return (
      <>
        <BackToApprovals />
        <PageHead title="Account request" text={message} />
      </>
    );
  }

  const request = query.data;
  if (!request) {
    return (
      <>
        <BackToApprovals />
        <PageHead title="Account request" text="This account request could not be loaded." />
      </>
    );
  }

  const { applicant, decision, submittedBy } = request;
  const farmerProfile = applicant.farmerProfile;
  const facilitatorProfile = applicant.facilitatorProfile;
  const showFarmer = isFarmerRequestRole(request.requestedRole) && farmerProfile;
  const showFacilitator = isFacilitatorRequestRole(request.requestedRole) && facilitatorProfile;
  const decisionTarget =
    request.status === "PENDING"
      ? {
          requestId: request.id,
          name: applicant.fullName,
          requestedRole: request.requestedRole,
        }
      : null;
  const showDecide = request.status === "PENDING" && canDecide;

  return (
    <>
      <BackToApprovals />
      <PageHead
        title={applicant.fullName}
        text={`${roleLabels[request.requestedRole]} · requested ${formatDate(request.createdAt)}`}
      >
        <Pill tone={requestStatusTone(request.status)}>{requestStatusLabel(request.status)}</Pill>
      </PageHead>

      {request.status === "PENDING" && (
        <article className="admin-panel mb-3">
          <h2 className="mb-2 font-bold">Decision</h2>
          <p className="mb-3 text-sm">
            This {roleLabels[request.requestedRole].toLowerCase()} request is waiting for approval.
            It cannot be used until it is approved.
          </p>
          {showDecide ? (
            <div className="admin-actions">
              <Button
                disabled={decisions.isDeciding}
                onClick={() => setApproveOpen(true)}
              >
                Approve request
              </Button>
              <Button
                variant="outline"
                disabled={decisions.isDeciding}
                onClick={() => setRejectOpen(true)}
              >
                Reject request
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You need the account-requests:decide permission to approve or reject this request.
            </p>
          )}
        </article>
      )}

      <DetailSection title="Request overview">
        <FactRow label="Request ID">
          <span title={request.id}>{shortDisplayId(request.id)}</span>
        </FactRow>
        <FactRow label="Status">{requestStatusLabel(request.status)}</FactRow>
        <FactRow label="Requested role">{roleLabels[request.requestedRole]}</FactRow>
        <FactRow label="Submitted">{formatDateTime(request.createdAt)}</FactRow>
        <FactRow label="Last updated">{formatDateTime(request.updatedAt)}</FactRow>
      </DetailSection>

      <DetailSection title="Applicant" className="mt-3">
        <FactRow label="Full name">{applicant.fullName}</FactRow>
        <FactRow label="Phone">{applicant.phoneNumber}</FactRow>
        <FactRow label="Email">{applicant.email ?? "—"}</FactRow>
        <FactRow label="User account ID">
          <span title={applicant.id}>{shortDisplayId(applicant.id)}</span>
        </FactRow>
        <FactRow label="Preferred language">
          {formatPreferredLanguage(applicant.preferredLanguage)}
        </FactRow>
      </DetailSection>

      <DetailSection title="Location" className="mt-3">
        {applicant.location ? (
          <>
            <FactRow label="Province">{formatProvince(applicant.location.province)}</FactRow>
            <FactRow label="District">{applicant.location.district}</FactRow>
            {applicant.location.sector ? (
              <FactRow label="Sector">{applicant.location.sector}</FactRow>
            ) : null}
            {applicant.location.cell ? (
              <FactRow label="Cell">{applicant.location.cell}</FactRow>
            ) : null}
            {applicant.location.village ? (
              <FactRow label="Village">{applicant.location.village}</FactRow>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No location was provided with this request.</p>
        )}
      </DetailSection>

      {showFarmer ? (
        <DetailSection title="Farmer profile" className="mt-3">
          <FactRow label="Farmer type">{formatFarmerType(farmerProfile.farmerType)}</FactRow>
          <FactRow label="Farmer category">
            {formatFarmerCategory(farmerProfile.farmerCategory)}
          </FactRow>
          <FactRow label="Profile registered">
            {formatDateTime(farmerProfile.registeredAt)}
          </FactRow>
        </DetailSection>
      ) : null}

      {showFacilitator ? (
        <DetailSection title="Facilitator profile" className="mt-3">
          <FactRow label="Professional title">{facilitatorProfile.professionalTitle}</FactRow>
          <FactRow label="Organization">{facilitatorProfile.organization}</FactRow>
          {facilitatorProfile.contactEmail ? (
            <FactRow label="Contact email">{facilitatorProfile.contactEmail}</FactRow>
          ) : null}
          {facilitatorProfile.contactPhone ? (
            <FactRow label="Contact phone">{facilitatorProfile.contactPhone}</FactRow>
          ) : null}
        </DetailSection>
      ) : null}

      <DetailSection title="Submission" className="mt-3">
        <FactRow label="Channel">{submissionChannelLabel(submittedBy)}</FactRow>
        {submittedBy ? <FactRow label="Submitted by">{submittedBy.fullName}</FactRow> : null}
        <FactRow label="Request notes">{request.notes?.trim() ? request.notes : "—"}</FactRow>
      </DetailSection>

      <DetailSection title="Decision history" className="mt-3">
        {request.status === "PENDING" ? (
          <p className="text-sm text-muted-foreground">No decision yet. This request is still pending.</p>
        ) : decision ? (
          <>
            <FactRow label="Decision">{requestStatusLabel(request.status)}</FactRow>
            <FactRow label="Reason or note">{decision.reason?.trim() ? decision.reason : "—"}</FactRow>
            <FactRow label="Decided on">{formatDateTime(decision.decidedAt)}</FactRow>
            <FactRow label="Decided by">{decision.decidedBy.fullName}</FactRow>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Decision details are not available for this request.</p>
        )}
      </DetailSection>

      <AccountRequestApproveDialog
        target={approveOpen && decisionTarget ? decisionTarget : null}
        submitting={decisions.approve.isPending}
        onClose={() => setApproveOpen(false)}
        onConfirm={(note) => {
          if (!decisionTarget) return;
          decisions.approve.mutate(
            { requestId: decisionTarget.requestId, note },
            { onSettled: () => setApproveOpen(false) },
          );
        }}
      />
      <AccountRequestRejectDialog
        target={rejectOpen && decisionTarget ? decisionTarget : null}
        submitting={decisions.reject.isPending}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => {
          if (!decisionTarget) return;
          decisions.reject.mutate(
            { requestId: decisionTarget.requestId, reason },
            { onSettled: () => setRejectOpen(false) },
          );
        }}
      />
    </>
  );
}

function BackToApprovals() {
  return (
    <Link
      to="/admin/users"
      search={{ tab: "approvals" }}
      className="inline-flex items-center gap-1 text-sm font-bold text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to account approvals
    </Link>
  );
}

function DetailSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={className ? `admin-panel ${className}` : "admin-panel"}>
      <h2 className="mb-2 font-bold">{title}</h2>
      <dl className="fac-facts">{children}</dl>
    </article>
  );
}