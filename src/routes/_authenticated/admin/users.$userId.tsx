import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { formatDate, formatDateTime, PageHead, Pill } from "@/components/admin/shell";
import { UserStatusDialog, type UserStatusChange } from "@/components/admin/user-status-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  adminUserDetailQueryOptions,
  backendStatusLabels,
  backendStatusTone,
  locationLabel,
  manageableActions,
  primaryRole,
  rolesLabel,
  statusActionCopy,
} from "@/lib/admin/backend-people";
import { parseBffError } from "@/lib/auth/parse-bff-error";

export const Route = createFileRoute("/_authenticated/admin/users/$userId")({
  component: PersonPage,
});

const farmerCategoryLabels: Record<string, string> = {
  SMALLHOLDER: "Smallholder",
  MEDIUM_SCALE: "Medium scale",
  COMMERCIAL: "Commercial",
  COOPERATIVE_MEMBER: "Cooperative member",
  LEAD_FARMER: "Lead farmer",
};

/** Account details read from the backend (GET /users/:id). */
function PersonPage() {
  const { userId } = Route.useParams();
  const { user: me, permissions, loading: authLoading } = useAuth();
  const canRead = permissions.includes("users:read");
  const canManageStatus = permissions.includes("users:manage-status");
  const detail = useQuery(adminUserDetailQueryOptions(userId, canRead && !authLoading));
  const [change, setChange] = useState<UserStatusChange>(null);

  const back = (
    <Link
      to="/admin/users"
      className="inline-flex items-center gap-1 text-sm font-bold text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to users
    </Link>
  );

  if (authLoading || detail.isLoading) {
    return (
      <>
        {back}
        <p className="fac-empty">Loading account…</p>
      </>
    );
  }
  if (!canRead) {
    return (
      <>
        {back}
        <PageHead title="Not allowed" text="You do not have permission to view user accounts." />
      </>
    );
  }
  if (detail.isError || !detail.data) {
    const failure = parseBffError(detail.error);
    return (
      <>
        {back}
        <PageHead
          title={failure.status === 404 ? "Person not found" : "Account could not be loaded"}
          text={
            failure.status === 404
              ? "This account does not exist or was removed."
              : "The server did not return this account. Try again."
          }
        />
        {failure.status !== 404 && (
          <Button variant="outline" onClick={() => void detail.refetch()}>
            Try again
          </Button>
        )}
      </>
    );
  }

  const person = detail.data;
  const role = primaryRole(person);
  const basic = role === "BASIC_PHONE_FARMER";
  const self = person.id === me?.id;
  const actions = canManageStatus && !self ? manageableActions(person.status) : [];
  const facilitator = person.facilitatorProfile;
  const farmer = person.farmerProfile;

  return (
    <>
      {back}
      <PageHead
        title={person.fullName}
        text={`${rolesLabel(person)} · registered ${formatDate(person.createdAt)}`}
      >
        <Pill tone={backendStatusTone(person.status)}>{backendStatusLabels[person.status]}</Pill>
        {basic && (
          <Button asChild variant="ghost">
            <Link to="/phone" search={{ phone: person.phoneNumber }}>
              Test in phone simulator
            </Link>
          </Button>
        )}
      </PageHead>
      {person.status === "PENDING" && (
        <article className="admin-panel mb-3">
          <h2 className="mb-2 font-bold">Account request</h2>
          <p className="mb-3 text-sm">
            This account is waiting for approval and cannot be used until it is approved.
          </p>
          <Button asChild>
            <Link to="/admin/users" search={{ tab: "approvals" }}>
              Review in account approvals
            </Link>
          </Button>
        </article>
      )}
      {person.statusReason && person.status !== "ACTIVE" && (
        <p className="fac-note mb-3">
          {backendStatusLabels[person.status]}
          {person.statusChangedAt ? ` on ${formatDate(person.statusChangedAt)}` : ""}:{" "}
          {person.statusReason}
        </p>
      )}
      <div className="admin-grid-2">
        <article className="admin-panel">
          <h2 className="mb-2 font-bold">Details</h2>
          <dl className="fac-facts">
            <div>
              <dt>Phone</dt>
              <dd>{person.phoneNumber}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                {person.email || "None"}
                {person.email && (
                  <span className="block text-xs text-muted-foreground">
                    {person.emailVerifiedAt
                      ? `Verified ${formatDate(person.emailVerifiedAt)}`
                      : "Not verified yet: the user must open the link in the verification email"}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{locationLabel(person, true)}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{person.preferredLanguage === "rw" ? "Kinyarwanda" : "English"}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{basic ? "Basic phone (USSD and IVR testing portal)" : "Web app"}</dd>
            </div>
            {farmer && (
              <div>
                <dt>Farmer category</dt>
                <dd>{farmerCategoryLabels[farmer.farmerCategory] ?? farmer.farmerCategory}</dd>
              </div>
            )}
            {facilitator?.professionalTitle && (
              <div>
                <dt>Title</dt>
                <dd>{facilitator.professionalTitle}</dd>
              </div>
            )}
            {facilitator?.organization && (
              <div>
                <dt>Organisation</dt>
                <dd>{facilitator.organization}</dd>
              </div>
            )}
            <div>
              <dt>Last sign-in</dt>
              <dd>{person.lastLoginAt ? formatDateTime(person.lastLoginAt) : "Never"}</dd>
            </div>
          </dl>
        </article>
        <article className="admin-panel">
          <h2 className="mb-2 font-bold">Account access</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {basic && person.status !== "ACTIVE"
              ? "This farmer cannot use the basic-phone portal until the account is active."
              : "Changing the status never deletes learning records."}
          </p>
          {self ? (
            <p className="fac-note">You cannot change the status of your own account.</p>
          ) : !canManageStatus ? (
            <p className="text-sm text-muted-foreground">
              You do not have permission to change account status.
            </p>
          ) : actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Status actions are available after the account request is approved.
            </p>
          ) : (
            <div className="admin-actions">
              {actions.map((next) => (
                <Button
                  key={next}
                  variant={next === "ACTIVE" ? "default" : "outline"}
                  onClick={() => setChange({ user: person, status: next })}
                >
                  {statusActionCopy[next].label}
                </Button>
              ))}
            </div>
          )}
        </article>
      </div>
      <UserStatusDialog change={change} onClose={() => setChange(null)} />
    </>
  );
}
