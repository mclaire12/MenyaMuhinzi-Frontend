import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileSpreadsheet, Search, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDate, Pill } from "@/components/admin/shell";
import {
  AddExistingMemberDialog,
  ImportMembersDialog,
  NewMemberDialog,
} from "@/components/facilitator/group-member-dialogs";
import { PageHead } from "@/components/facilitator/shell";
import { ConfirmDialog, Stat } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import { cropLabel } from "@/lib/admin/backend-groups";
import { provinceLabels } from "@/lib/admin/backend-people";
import type { Province } from "@/lib/api/types";
import { parseBffError } from "@/lib/auth/parse-bff-error";
import {
  facilitatorGroupsKey,
  farmerTypeLabels,
  groupMembersQueryOptions,
  groupQueryOptions,
  type GroupMember,
} from "@/lib/facilitator/backend-groups";

export const Route = createFileRoute("/_authenticated/facilitator/groups/$groupId")({
  component: GroupPage,
});

type AddMode = "new" | "import" | "existing" | null;

/** One farmer group and its members (GET /facilitator/groups/:id, /members). */
function GroupPage() {
  const { groupId } = Route.useParams();
  const queryClient = useQueryClient();
  const { permissions, loading } = useAuth();
  const canRead = permissions.includes("farmer-groups:read");
  const canManage = permissions.includes("farmer-groups:manage");
  const enabled = canRead && !loading;
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState<AddMode>(null);
  const [removing, setRemoving] = useState<GroupMember | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const group = useQuery(groupQueryOptions(groupId, enabled));
  const members = useQuery(
    groupMembersQueryOptions(
      groupId,
      { page, ...(debounced ? { search: debounced } : {}) },
      enabled,
    ),
  );
  const remove = useMutation({
    mutationFn: (member: GroupMember) =>
      adminApi("DELETE", `facilitator/groups/${groupId}/members/${member.userId}`),
    onSuccess: async (_r, member) => {
      await queryClient.invalidateQueries({ queryKey: facilitatorGroupsKey });
      toast.success(
        `${member.fullName} removed from the group. Their account and progress are kept.`,
      );
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The farmer could not be removed.")),
  });
  const memberIds = useMemo(
    () => new Set((members.data?.data ?? []).map((member) => member.userId)),
    [members.data],
  );

  const back = (
    <Link
      to="/facilitator/groups"
      className="inline-flex items-center gap-1 text-sm font-bold text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to My Groups
    </Link>
  );
  if (loading || group.isLoading)
    return (
      <>
        {back}
        <p className="fac-empty">Loading group…</p>
      </>
    );
  if (group.isError || !group.data) {
    const status = parseBffError(group.error).status;
    return (
      <>
        {back}
        <PageHead
          title={status === 404 || status === 403 ? "Group not found" : "Group could not be loaded"}
          text={
            status === 404 || status === 403
              ? "This group does not exist or belongs to another facilitator."
              : adminErrorMessage(group.error, "Try again.")
          }
        />
      </>
    );
  }

  const current = group.data;
  const open = current.status === "ACTIVE";
  const rows = members.data?.data ?? [];
  const meta = members.data?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);
  const place = [
    current.location.village,
    current.location.cell,
    current.location.sector,
    current.location.district,
    provinceLabels[current.location.province as Province],
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      {back}
      <PageHead
        title={current.name}
        text={current.description || `${cropLabel(current.crop)} · ${place}`}
      >
        <Pill tone={open ? "ok" : "muted"}>{open ? "Active" : "Inactive"}</Pill>
      </PageHead>
      <div className="admin-stats">
        <Stat label="Farmers" value={current.memberCount} />
        <Stat label="Crop" value={cropLabel(current.crop)} />
        <Stat label="Location" value={place} />
        <Stat label="Created" value={formatDate(current.createdAt)} />
      </div>

      {canManage && open && (
        <section className="admin-panel mb-4" aria-label="Add farmers">
          <h2 className="mb-1 font-bold">Add farmers to this group</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            New farmers become users on MenyaMuhinzi and receive an email to verify their personal
            address.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-1 p-3 text-left"
              onClick={() => setAdding("import")}
            >
              <span className="flex items-center gap-2 font-bold">
                <FileSpreadsheet aria-hidden />
                Import from Excel
              </span>
              <span className="whitespace-normal text-xs font-normal text-muted-foreground">
                Download the template, fill it, upload it.
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-1 p-3 text-left"
              onClick={() => setAdding("new")}
            >
              <span className="flex items-center gap-2 font-bold">
                <UserPlus aria-hidden />
                Register one farmer
              </span>
              <span className="whitespace-normal text-xs font-normal text-muted-foreground">
                Fill the registration form for a new farmer.
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-1 p-3 text-left"
              onClick={() => setAdding("existing")}
            >
              <span className="flex items-center gap-2 font-bold">
                <Search aria-hidden />
                Add existing farmer
              </span>
              <span className="whitespace-normal text-xs font-normal text-muted-foreground">
                Already on MenyaMuhinzi? Search their email.
              </span>
            </Button>
          </div>
        </section>
      )}
      {!open && (
        <p className="fac-note mb-3">This group is inactive and cannot take new farmers.</p>
      )}

      <div className="admin-filters">
        <h2 className="text-lg font-bold">Members</h2>
        <input
          aria-label="Search members"
          placeholder="Search name, phone or email"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </div>
      {members.isError ? (
        <p className="fac-empty" role="alert">
          {adminErrorMessage(members.error, "Members could not be loaded.")}
        </p>
      ) : members.isLoading ? (
        <p className="fac-empty">Loading members…</p>
      ) : rows.length === 0 ? (
        <p className="fac-empty">
          {debounced ? "No member matches this search." : "No farmers in this group yet."}
        </p>
      ) : (
        <>
          <div className="staff-table" aria-busy={members.isFetching}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Phone type</th>
                  <th>Account</th>
                  <th>Added</th>
                  {canManage && <th className="col-actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((member) => (
                  <tr key={member.userId}>
                    <td className="font-bold">{member.fullName}</td>
                    <td>{member.phoneNumber}</td>
                    <td>{member.email ?? "—"}</td>
                    <td>{farmerTypeLabels[member.farmerType]}</td>
                    <td>
                      <Pill tone={member.status === "ACTIVE" ? "ok" : "muted"}>
                        {member.status.toLowerCase()}
                      </Pill>
                    </td>
                    <td>{formatDate(member.addedAt)}</td>
                    {canManage && (
                      <td className="col-actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={remove.isPending}
                          onClick={() => setRemoving(member)}
                        >
                          Remove
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
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
                Page {page} of {totalPages} · {meta?.total ?? 0} farmer(s)
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
          )}
        </>
      )}

      <NewMemberDialog group={current} open={adding === "new"} onClose={() => setAdding(null)} />
      <ImportMembersDialog
        group={current}
        open={adding === "import"}
        onClose={() => setAdding(null)}
      />
      <AddExistingMemberDialog
        group={current}
        memberIds={memberIds}
        open={adding === "existing"}
        onClose={() => setAdding(null)}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(value) => {
          if (!value) setRemoving(null);
        }}
        title="Remove this farmer from the group?"
        text={
          removing
            ? `${removing.fullName} leaves ${current.name}. Their account and learning progress are kept.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (removing) remove.mutate(removing);
          setRemoving(null);
        }}
      />
    </>
  );
}
