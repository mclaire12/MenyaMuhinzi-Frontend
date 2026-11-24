import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Download, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  formatDate,
  PageHead,
  Pill,
  RowMenu,
  Tabs,
  useAdminActor,
  withinDays,
} from "@/components/admin/shell";
import {
  AccountRequestApproveDialog,
  AccountRequestRejectDialog,
  RejectDialog,
  statusTone,
  type AccountRequestDecisionTarget,
} from "@/components/admin/people-ui";
import { UserForm } from "@/components/admin/user-form";
import { ConfirmDialog } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  accountStatusLabels,
  approveUser,
  emptyUser,
  locationOf,
  registerUser,
  roleLabels,
  setUserStatus,
} from "@/lib/admin/people";
import { downloadCsv, useAdmin } from "@/lib/admin/store";
import type { AccountStatus, PortalRole, PortalUser } from "@/lib/admin/types";
import type { UserRole } from "@/lib/api/types";
import { normalizePhone } from "@/lib/basic-phone/farmers";
import { useAccountRequestDecisions } from "@/hooks/use-account-request-decisions";
import { useAuth } from "@/hooks/use-auth";
import type { AccountRequestApprovalRow } from "@/lib/admin/account-request-mapper";
import { provinces } from "@/lib/mock/crops";
import { useLearningState } from "@/lib/mock/store";

type Search = { tab?: "users" | "approvals"; create?: boolean };

export const Route = createFileRoute("/_authenticated/admin/users/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(search["tab"] === "approvals" || search["tab"] === "users" ? { tab: search["tab"] } : {}),
    ...(search["create"] === true || search["create"] === "true" ? { create: true } : {}),
  }),
  component: People,
});

const PAGE = 10;
const roles: PortalRole[] = ["ADMIN", "FACILITATOR", "SMARTPHONE_FARMER", "BASIC_PHONE_FARMER"];
const approvalRoles: UserRole[] = ["FACILITATOR", "SMARTPHONE_FARMER", "BASIC_PHONE_FARMER"];

function People() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/users/" });
  const tab = search.tab ?? "users";
  const data = useAdmin();
  const learning = useLearningState();
  const { name } = useAdminActor();
  const { permissions, loading: authLoading } = useAuth();
  const canReadApprovals = permissions.includes("account-requests:read");
  const pendingCountQuery = useQuery(
    accountRequestStatusCountQueryOptions("PENDING", canReadApprovals && !authLoading),
  );
  const pendingBadge = canReadApprovals ? pendingCountQuery.data : undefined;
  const [creating, setCreating] = useState(!!search.create);

  function register(values: Parameters<typeof registerUser>[1]) {
    const result = registerUser(name, values);
    if ("error" in result) return result.error;
    setCreating(false);
    toast.success(
      values.role === "BASIC_PHONE_FARMER"
        ? "Basic-phone farmer registered. They learn by USSD and IVR only."
        : `${roleLabels[values.role]} registered.`,
    );
    navigate({ to: "/admin/users/$userId", params: { userId: result.accountId } });
    return null;
  }

  return (
    <>
      <PageHead
        title="People"
        text="Every account on the platform. Farmers are one record whether they learn on a smartphone or by USSD and IVR."
      >
        <Button onClick={() => setCreating(true)}>
          <UserPlus aria-hidden />
          Add user
        </Button>
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
        <UsersTable users={data.users} learning={learning} />
      ) : (
        <Approvals canRead={canReadApprovals} authLoading={authLoading} />
      )}
      <Dialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open && search.create) navigate({ search: { tab } });
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>
              The form changes with the user type. Phone numbers must be unique, so no farmer is
              registered twice.
            </DialogDescription>
          </DialogHeader>
          <UserForm
            initial={emptyUser("SMARTPHONE_FARMER", data.platform.defaultLanguage)}
            roles={roles}
            submitLabel="Register user"
            onSubmit={register}
            onCancel={() => setCreating(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

type StatusChange = { user: PortalUser; status: AccountStatus } | null;

const statusCopy: Partial<Record<AccountStatus, { title: string; text: string; label: string }>> = {
  active: {
    title: "Activate this account?",
    text: "The user can sign in, or dial in by USSD and IVR, again.",
    label: "Activate",
  },
  suspended: {
    title: "Suspend this account?",
    text: "The user is blocked until an administrator activates the account again. Learning records are kept.",
    label: "Suspend",
  },
  deactivated: {
    title: "Deactivate this account?",
    text: "The account becomes inactive and cannot be used. Learning records are kept.",
    label: "Deactivate",
  },
};

function UsersTable({
  users,
  learning,
}: {
  users: PortalUser[];
  learning: ReturnType<typeof useLearningState>;
}) {
  const { name } = useAdminActor();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<PortalRole | "all">("all");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const [province, setProvince] = useState("all");
  const [district, setDistrict] = useState("all");
  const [registered, setRegistered] = useState(0);
  const [page, setPage] = useState(0);
  const [change, setChange] = useState<StatusChange>(null);
  const [rejecting, setRejecting] = useState<PortalUser | null>(null);
  const rows = useMemo(
    () =>
      users
        .map((user) => ({ user, location: locationOf(learning, user) }))
        .filter(({ user, location }) => {
          const text = query.trim().toLowerCase();
          const digits = /\d/.test(text) ? normalizePhone(text) : "";
          if (
            text &&
            !`${user.name} ${user.email} ${user.phone} ${location.sector} ${location.village}`
              .toLowerCase()
              .includes(text) &&
            !(digits && normalizePhone(user.phone).includes(digits))
          )
            return false;
          if (role !== "all" && user.role !== role) return false;
          if (status !== "all" && user.status !== status) return false;
          if (province !== "all" && location.province !== province) return false;
          if (district !== "all" && location.district !== district) return false;
          if (registered && !withinDays(user.registeredAt, registered)) return false;
          return true;
        })
        .sort((a, b) => b.user.registeredAt.localeCompare(a.user.registeredAt)),
    [users, learning, query, role, status, province, district, registered],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = () => setPage(0);

  function exportRows() {
    downloadCsv(
      "menyamuhinzi-users.csv",
      rows.map(({ user, location }) => ({
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: roleLabels[user.role],
        province: location.province,
        district: location.district,
        status: accountStatusLabels[user.status],
        registered: user.registeredAt.slice(0, 10),
      })),
    );
    toast.success(`${rows.length} user(s) exported.`);
  }

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
            setRole(event.target.value as PortalRole | "all");
            reset();
          }}
        >
          <option value="all">All roles</option>
          {roles.map((item) => (
            <option key={item} value={item}>
              {roleLabels[item]}
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
          {(Object.keys(accountStatusLabels) as AccountStatus[]).map((item) => (
            <option key={item} value={item}>
              {accountStatusLabels[item]}
            </option>
          ))}
        </select>
        <select
          aria-label="Province"
          value={province}
          onChange={(event) => {
            setProvince(event.target.value);
            setDistrict("all");
            reset();
          }}
        >
          <option value="all">All provinces</option>
          {Object.keys(provinces).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="District"
          value={district}
          onChange={(event) => {
            setDistrict(event.target.value);
            reset();
          }}
        >
          <option value="all">All districts</option>
          {(province === "all" ? Object.values(provinces).flat() : (provinces[province] ?? [])).map(
            (item) => (
              <option key={item}>{item}</option>
            ),
          )}
        </select>
        <select
          aria-label="Registration date"
          value={registered}
          onChange={(event) => {
            setRegistered(Number(event.target.value));
            reset();
          }}
        >
          <option value={0}>Registered any time</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <Button variant="outline" disabled={!rows.length} onClick={exportRows}>
          <Download aria-hidden />
          Export CSV
        </Button>
      </div>
      {!rows.length ? (
        <p className="fac-empty">No users match these filters.</p>
      ) : (
        <>
          <div className="staff-table">
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
                {visible.map(({ user, location }) => (
                  <tr key={user.id}>
                    <td>
                      <Link
                        className="font-bold"
                        to="/admin/users/$userId"
                        params={{ userId: user.id }}
                      >
                        {user.name}
                      </Link>
                    </td>
                    <td>{user.phone}</td>
                    <td>{user.email || <span className="text-muted-foreground">—</span>}</td>
                    <td>{roleLabels[user.role]}</td>
                    <td>
                      {[location.district, location.province].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td>
                      <Pill tone={statusTone(user.status)}>{accountStatusLabels[user.status]}</Pill>
                    </td>
                    <td>{formatDate(user.registeredAt)}</td>
                    <td className="col-actions">
                      <RowMenu label={user.name}>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/users/$userId" params={{ userId: user.id }}>
                            View details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            to="/admin/users/$userId"
                            params={{ userId: user.id }}
                            search={{ edit: true }}
                          >
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        {user.status === "pending" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => {
                                const error = approveUser(name, user.id);
                                if (error) toast.error(error);
                                else
                                  toast.success(
                                    `${user.name} approved. The account is now active.`,
                                  );
                              }}
                            >
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setRejecting(user)}>
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {user.status !== "pending" && user.status !== "rejected" && (
                          <DropdownMenuSeparator />
                        )}
                        {(user.status === "suspended" || user.status === "deactivated") && (
                          <DropdownMenuItem onSelect={() => setChange({ user, status: "active" })}>
                            Activate
                          </DropdownMenuItem>
                        )}
                        {user.status === "active" && (
                          <DropdownMenuItem
                            onSelect={() => setChange({ user, status: "suspended" })}
                          >
                            Suspend
                          </DropdownMenuItem>
                        )}
                        {(user.status === "active" || user.status === "suspended") && (
                          <DropdownMenuItem
                            onSelect={() => setChange({ user, status: "deactivated" })}
                          >
                            Deactivate
                          </DropdownMenuItem>
                        )}
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
              Page {page + 1} of {pages} · {rows.length} user(s)
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages - 1}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!change}
        onOpenChange={(open) => {
          if (!open) setChange(null);
        }}
        title={change ? (statusCopy[change.status]?.title ?? "") : ""}
        text={change ? `${change.user.name}: ${statusCopy[change.status]?.text ?? ""}` : ""}
        confirmLabel={change ? (statusCopy[change.status]?.label ?? "Confirm") : "Confirm"}
        onConfirm={() => {
          if (!change) return;
          setUserStatus(name, [change.user.id], change.status);
          toast.success(
            `${change.user.name} is now ${accountStatusLabels[change.status].toLowerCase()}.`,
          );
          setChange(null);
        }}
      />
      <RejectDialog user={rejecting} onClose={() => setRejecting(null)} />
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
