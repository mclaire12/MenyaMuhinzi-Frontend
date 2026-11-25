import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDate, PageHead, Pill, RowMenu, Tabs } from "@/components/admin/shell";
import {
  AccountRequestApproveDialog,
  AccountRequestRejectDialog,
  type AccountRequestDecisionTarget,
} from "@/components/admin/people-ui";
import { AddUserDialog } from "@/components/admin/add-user-dialog";
import { BasicPhoneFarmerDialog } from "@/components/admin/basic-phone-farmer-dialog";
import { UserStatusDialog, type UserStatusChange } from "@/components/admin/user-status-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { accountRequestDetailLink } from "@/lib/admin/account-request-detail";
import {
  accountRequestListQueryOptions,
  accountRequestStatusCountQueryOptions,
  approvalsEmptyCopy,
  parseApprovalsListError,
  resolveApprovalsListErrorMessage,
  type AccountRequestListParams,
} from "@/lib/admin/account-request-approvals";
import type { ApprovalsView } from "@/lib/admin/account-request-mapper";
import {
  adminUserListQueryOptions,
  backendRoleLabels,
  backendStatusLabels,
  backendStatusTone,
  locationLabel,
  manageableActions,
  rolesLabel,
  statusActionCopy,
} from "@/lib/admin/backend-people";
import { roleLabels } from "@/lib/admin/people";
import { downloadCsv } from "@/lib/admin/store";
import type { AdminUserResponse, ListAdminUsersQuery } from "@/lib/api/admin-people-types";
import type { AccountStatus, UserRole } from "@/lib/api/types";
import { bffListUsers } from "@/lib/auth/admin-people-server-fns";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import { useAccountRequestDecisions } from "@/hooks/use-account-request-decisions";
import { useAuth } from "@/hooks/use-auth";
import type { AccountRequestApprovalRow } from "@/lib/admin/account-request-mapper";

type Search = { tab?: "users" | "approvals" };

export const Route = createFileRoute("/_authenticated/admin/users/")({
  validateSearch: (search: Record<string, unknown>): Search =>
    search["tab"] === "approvals" || search["tab"] === "users" ? { tab: search["tab"] } : {},
  component: People,
});

const PAGE = 10;
const roles: UserRole[] = ["ADMIN", "FACILITATOR", "SMARTPHONE_FARMER", "BASIC_PHONE_FARMER"];
const approvalRoles: UserRole[] = ["FACILITATOR", "SMARTPHONE_FARMER", "BASIC_PHONE_FARMER"];

function People() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/users/" });
  const tab = search.tab ?? "users";
  const { permissions, loading: authLoading } = useAuth();
  const canReadApprovals = permissions.includes("account-requests:read");
  const canReadUsers = permissions.includes("users:read");
  const pendingCountQuery = useQuery(
    accountRequestStatusCountQueryOptions("PENDING", canReadApprovals && !authLoading),
  );
  const pendingBadge = canReadApprovals ? pendingCountQuery.data : undefined;

  return (
    <>
      <PageHead
        title="Users"
        text="Every account registered on the platform, read live from the database. Farmers are one record whether they learn on a smartphone or by USSD and IVR."
      >
        <AddUserDialog />
        <BasicPhoneFarmerDialog />
      </PageHead>
      <Tabs
        value={tab}
        onChange={(value) => navigate({ search: { tab: value } })}
        options={[
          { value: "users", label: "All users" },
          {
            value: "approvals",
            label: `Account approvals${pendingBadge ? ` (${pendingBadge})` : ""}`,
          },
        ]}
      />
      {tab === "users" ? (
        <UsersTable canRead={canReadUsers} authLoading={authLoading} />
      ) : (
        <Approvals canRead={canReadApprovals} authLoading={authLoading} />
      )}
    </>
  );
}

const statuses: AccountStatus[] = ["ACTIVE", "PENDING", "SUSPENDED", "INACTIVE", "REJECTED"];

function UsersTable({ canRead, authLoading }: { canRead: boolean; authLoading: boolean }) {
  const { user: me, permissions } = useAuth();
  const canManageStatus = permissions.includes("users:manage-status");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [change, setChange] = useState<UserStatusChange>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filters: ListAdminUsersQuery = {
    ...(debounced ? { search: debounced } : {}),
    ...(role !== "all" ? { role } : {}),
    ...(status !== "all" ? { status } : {}),
  };
  const list = useQuery(
    adminUserListQueryOptions({ ...filters, page, limit: PAGE }, canRead && !authLoading),
  );
  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);
  const reset = () => setPage(1);

  async function exportRows() {
    setExporting(true);
    try {
      const all: AdminUserResponse[] = [];
      for (let next = 1; next <= 50; next += 1) {
        const result = await bffListUsers({ data: { ...filters, page: next, limit: 100 } });
        all.push(...result.data);
        if (next >= result.meta.totalPages) break;
      }
      downloadCsv(
        "menyamuhinzi-users.csv",
        all.map((user) => ({
          name: user.fullName,
          phone: user.phoneNumber,
          email: user.email ?? "",
          emailVerified: user.emailVerifiedAt ? "yes" : "no",
          roles: rolesLabel(user),
          province: user.location?.province ?? "",
          district: user.location?.district ?? "",
          sector: user.location?.sector ?? "",
          status: backendStatusLabels[user.status],
          registered: user.createdAt.slice(0, 10),
          lastLogin: user.lastLoginAt?.slice(0, 10) ?? "",
        })),
      );
      toast.success(`${all.length} user(s) exported.`);
    } catch {
      toast.error("The user list could not be exported. Try again.");
    } finally {
      setExporting(false);
    }
  }

  if (authLoading) return <p className="fac-empty">Loading users…</p>;
  if (!canRead)
    return <p className="fac-empty">You do not have permission to view user accounts.</p>;

  return (
    <>
      <div className="admin-filters">
        <input
          aria-label="Search users"
          placeholder="Search name, phone or email"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            reset();
          }}
        />
        <select
          aria-label="Role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as UserRole | "all");
            reset();
          }}
        >
          <option value="all">All roles</option>
          {roles.map((item) => (
            <option key={item} value={item}>
              {backendRoleLabels[item]}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as AccountStatus | "all");
            reset();
          }}
        >
          <option value="all">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {backendStatusLabels[item]}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={!meta?.total || exporting}
          onClick={() => void exportRows()}
        >
          <Download aria-hidden />
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      {list.isError ? (
        <div className="fac-empty" role="alert">
          <p>
            {parseBffError(list.error).status === 401
              ? "Your session has expired. Sign in again to see user accounts."
              : "User accounts could not be loaded from the server."}
          </p>
          <Button className="mt-3" variant="outline" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : list.isLoading ? (
        <p className="fac-empty">Loading users…</p>
      ) : !rows.length ? (
        <p className="fac-empty">No users match these filters.</p>
      ) : (
        <>
          <div className="staff-table" aria-busy={list.isFetching}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const actions =
                    canManageStatus && user.id !== me?.id ? manageableActions(user.status) : [];
                  return (
                    <tr key={user.id}>
                      <td>
                        <Link
                          className="font-bold"
                          to="/admin/users/$userId"
                          params={{ userId: user.id }}
                        >
                          {user.fullName}
                        </Link>
                      </td>
                      <td>{user.phoneNumber}</td>
                      <td>
                        {user.email ? (
                          <>
                            {user.email}
                            {!user.emailVerifiedAt && (
                              <span className="block text-xs text-muted-foreground">
                                Not verified
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td>{rolesLabel(user)}</td>
                      <td>{locationLabel(user)}</td>
                      <td>
                        <Pill tone={backendStatusTone(user.status)}>
                          {backendStatusLabels[user.status]}
                        </Pill>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td className="col-actions">
                        <RowMenu label={user.fullName}>
                          <DropdownMenuItem asChild>
                            <Link to="/admin/users/$userId" params={{ userId: user.id }}>
                              View details
                            </Link>
                          </DropdownMenuItem>
                          {user.status === "PENDING" && (
                            <DropdownMenuItem asChild>
                              <Link to="/admin/users" search={{ tab: "approvals" }}>
                                Review in account approvals
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {actions.length > 0 && <DropdownMenuSeparator />}
                          {actions.map((next) => (
                            <DropdownMenuItem
                              key={next}
                              onSelect={() => setChange({ user, status: next })}
                            >
                              {statusActionCopy[next].label}
                            </DropdownMenuItem>
                          ))}
                        </RowMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="admin-actions mt-3 items-center">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages} · {meta?.total ?? 0} user(s)
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      <UserStatusDialog change={change} onClose={() => setChange(null)} />
    </>
  );
}

function approvalRowToTarget(row: AccountRequestApprovalRow): AccountRequestDecisionTarget {
  return { requestId: row.requestId, name: row.name, requestedRole: row.requestedRole };
}

function Approvals({ canRead, authLoading }: { canRead: boolean; authLoading: boolean }) {
  const { permissions } = useAuth();
  const canDecide = permissions.includes("account-requests:decide");
  const decisions = useAccountRequestDecisions();
  const [approving, setApproving] = useState<AccountRequestApprovalRow | null>(null);
  const [rejecting, setRejecting] = useState<AccountRequestApprovalRow | null>(null);
  const [view, setView] = useState<ApprovalsView>("pending");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [page, setPage] = useState(0);
  const listParams: AccountRequestListParams = { view, search: query, role, page };
  const listQuery = useQuery(accountRequestListQueryOptions(listParams, canRead && !authLoading));
  const countsEnabled = canRead && !authLoading;
  const countQueries = useQueries({
    queries: [
      accountRequestStatusCountQueryOptions("PENDING", countsEnabled),
      accountRequestStatusCountQueryOptions("APPROVED", countsEnabled),
      accountRequestStatusCountQueryOptions("REJECTED", countsEnabled),
    ],
  });
  const viewCounts: Record<ApprovalsView, number | undefined> = {
    pending: countQueries[0]?.data,
    approved: countQueries[1]?.data,
    rejected: countQueries[2]?.data,
  };
  const resetPage = () => setPage(0);
  const rows = listQuery.data?.rows ?? [];
  const meta = listQuery.data?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);

  if (authLoading) {
    return <p className="fac-empty">Loading account requests…</p>;
  }

  if (!canRead) {
    return (
      <p className="fac-empty">
        You do not have permission to view account requests. Access requires the
        account-requests:read permission.
      </p>
    );
  }

  const listError = listQuery.isError
    ? resolveApprovalsListErrorMessage(parseApprovalsListError(listQuery.error))
    : null;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Account approval is only about access to the platform. Course publication and teaching
        materials are reviewed elsewhere.
      </p>
      <div className="admin-filters">
        <input
          aria-label="Search account requests"
          placeholder="Search name, phone or email"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetPage();
          }}
        />
        <select
          aria-label="Requested role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as UserRole | "all");
            resetPage();
          }}
        >
          <option value="all">All requested roles</option>
          {approvalRoles.map((item) => (
            <option key={item} value={item}>
              {roleLabels[item]}
            </option>
          ))}
        </select>
        {(["pending", "approved", "rejected"] as const).map((item) => {
          const count = viewCounts[item];
          const suffix = typeof count === "number" ? ` (${count})` : "";
          return (
            <Button
              key={item}
              size="sm"
              variant={view === item ? "default" : "outline"}
              onClick={() => {
                setView(item);
                resetPage();
              }}
            >
              {item === "pending" ? "Pending" : item === "approved" ? "Approved" : "Rejected"}
              {suffix}
            </Button>
          );
        })}
      </div>
      {listError ? (
        <p className="fac-empty text-destructive">{listError}</p>
      ) : listQuery.isLoading ? (
        <div className="staff-table">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Requested account</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Location</th>
                <th>Requested</th>
                <th>{view === "pending" ? "Status" : "Decision"}</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading account requests…
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : !rows.length ? (
        <p className="fac-empty">{approvalsEmptyCopy[view]}</p>
      ) : (
        <>
          <div className="staff-table">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Requested account</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Requested</th>
                  <th>{view === "pending" ? "Status" : "Decision"}</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.requestId}>
                    <td>
                      <Link className="font-bold" {...accountRequestDetailLink(row.requestId)}>
                        {row.name}
                      </Link>
                      {row.qualification && (
                        <small className="block text-muted-foreground">{row.qualification}</small>
                      )}
                    </td>
                    <td>{roleLabels[row.requestedRole]}</td>
                    <td>{row.phone}</td>
                    <td>{row.email || "—"}</td>
                    <td>{row.locationLabel}</td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      {view === "pending" ? (
                        <Pill tone="warn">Pending</Pill>
                      ) : (
                        <span>
                          {view === "approved" ? (
                            <Pill tone="ok">Approved</Pill>
                          ) : (
                            <Pill tone="bad">Rejected</Pill>
                          )}
                          {row.decisionAt && (
                            <small className="block text-muted-foreground">
                              {formatDate(row.decisionAt)}
                              {row.decidedByName ? ` · ${row.decidedByName}` : ""}
                            </small>
                          )}
                          {row.rejectionReason && (
                            <small className="block">{row.rejectionReason}</small>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="col-actions">
                      <RowMenu label={row.name}>
                        <DropdownMenuItem asChild>
                          <Link {...accountRequestDetailLink(row.requestId)}>View details</Link>
                        </DropdownMenuItem>
                        {view === "pending" && canDecide ? (
                          <>
                            <DropdownMenuItem
                              disabled={decisions.isDecidingRequest(row.requestId)}
                              onSelect={() => setApproving(row)}
                            >
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={decisions.isDecidingRequest(row.requestId)}
                              onSelect={() => setRejecting(row)}
                            >
                              Reject
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </RowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-actions mt-3 items-center">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page + 1} of {totalPages}
              {meta ? ` · ${meta.total} request(s)` : ""}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      <AccountRequestApproveDialog
        target={approving ? approvalRowToTarget(approving) : null}
        submitting={decisions.approve.isPending}
        onClose={() => setApproving(null)}
        onConfirm={(note) => {
          if (!approving) return;
          decisions.approve.mutate(
            { requestId: approving.requestId, note },
            { onSettled: () => setApproving(null) },
          );
        }}
      />
      <AccountRequestRejectDialog
        target={rejecting ? approvalRowToTarget(rejecting) : null}
        submitting={decisions.reject.isPending}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          if (!rejecting) return;
          decisions.reject.mutate(
            { requestId: rejecting.requestId, reason },
            { onSettled: () => setRejecting(null) },
          );
        }}
      />
    </>
  );
}
