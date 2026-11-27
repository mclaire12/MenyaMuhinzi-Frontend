import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDate, PageHead, Pill, RowMenu } from "@/components/admin/shell";
import { TargetGroupForm } from "@/components/admin/target-group-form";
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
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import {
  adminGroupListQueryOptions,
  adminGroupsKey,
  audienceCodeLabels,
  cropLabel,
  cropsQueryOptions,
  emptyGroupValues,
  groupBody,
  groupPlace,
  groupValuesFrom,
  recordStatusLabels,
  recordStatusTone,
  type AdminGroup,
  type AdminGroupValues,
  type RecordStatusCode,
} from "@/lib/admin/backend-groups";
import { provinceLabels } from "@/lib/admin/backend-people";
import type { Province } from "@/lib/api/types";

export const Route = createFileRoute("/_authenticated/admin/groups/")({
  validateSearch: (search: Record<string, unknown>): { create?: boolean } =>
    search["create"] === true || search["create"] === "true" ? { create: true } : {},
  component: GroupsPage,
});

const statusCopy: Record<RecordStatusCode, { title: string; label: string; text: string }> = {
  ACTIVE: {
    title: "Activate this group?",
    label: "Activate",
    text: "Courses published to this group become visible to matching farmers again.",
  },
  INACTIVE: {
    title: "Deactivate this group?",
    label: "Deactivate",
    text: "Farmers who only qualify through this group stop seeing its courses. Publication history is kept.",
  },
};

/** Course-targeting groups, read and saved through /admin/groups. */
function GroupsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/groups/" });
  const queryClient = useQueryClient();
  const { permissions, loading: authLoading } = useAuth();
  const canRead = permissions.includes("targeting-groups:read");
  const canManage = permissions.includes("targeting-groups:manage");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<RecordStatusCode | "all">("all");
  const [province, setProvince] = useState<Province | "all">("all");
  const [cropId, setCropId] = useState("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(!!search.create);
  const [editing, setEditing] = useState<AdminGroup | null>(null);
  const [change, setChange] = useState<{ group: AdminGroup; status: RecordStatusCode } | null>(
    null,
  );
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const crops = useQuery(cropsQueryOptions(canRead && !authLoading));
  const list = useQuery({
    ...adminGroupListQueryOptions(
      {
        page,
        ...(debounced ? { search: debounced } : {}),
        ...(status !== "all" ? { status } : {}),
        ...(province !== "all" ? { province } : {}),
        ...(cropId !== "all" ? { cropId } : {}),
      },
      canRead && !authLoading,
    ),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminGroupsKey });
  const save = useMutation({
    mutationFn: ({ id, values }: { id: string | null; values: AdminGroupValues }) =>
      id
        ? adminApi<AdminGroup>("PATCH", `admin/groups/${id}`, { body: groupBody(values) })
        : adminApi<AdminGroup>("POST", "admin/groups", { body: groupBody(values) }),
    onSuccess: async (group, { id }) => {
      await refresh();
      setFormError("");
      if (id) {
        setEditing(null);
        toast.success("Group saved.");
      } else {
        closeCreate();
        toast.success(`${group.name} created.`);
        void navigate({ to: "/admin/groups/$groupId", params: { groupId: group.id } });
      }
    },
    onError: (error) => setFormError(adminErrorMessage(error, "The group could not be saved.")),
  });
  const setGroupStatus = useMutation({
    mutationFn: ({ group, status: next }: { group: AdminGroup; status: RecordStatusCode }) =>
      adminApi<AdminGroup>("PATCH", `admin/groups/${group.id}`, { body: { status: next } }),
    onSuccess: async (group) => {
      await refresh();
      toast.success(`${group.name} is now ${recordStatusLabels[group.status].toLowerCase()}.`);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The status could not be changed.")),
    onSettled: () => setChange(null),
  });

  function closeCreate() {
    setCreating(false);
    setFormError("");
    if (search.create) void navigate({ search: {} });
  }

  const head = (
    <PageHead
      title="Groups"
      text="Target groups organise farmers by location, crop and access channel so a course can be published to the right people."
    >
      {canManage && (
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          Create group
        </Button>
      )}
    </PageHead>
  );
  if (authLoading)
    return (
      <>
        {head}
        <p className="fac-empty">Loading groups…</p>
      </>
    );
  if (!canRead)
    return (
      <>
        {head}
        <p className="fac-empty">You do not have permission to view groups.</p>
      </>
    );

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);
  const filtered = !!debounced || status !== "all" || province !== "all" || cropId !== "all";
  const reset = () => setPage(1);

  return (
    <>
      {head}
      <div className="admin-filters">
        <input
          aria-label="Search groups"
          placeholder="Search groups"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            reset();
          }}
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as RecordStatusCode | "all");
            reset();
          }}
        >
          <option value="all">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select
          aria-label="Crop"
          value={cropId}
          onChange={(event) => {
            setCropId(event.target.value);
            reset();
          }}
        >
          <option value="all">Any crop</option>
          {(crops.data ?? []).map((crop) => (
            <option key={crop.id} value={crop.id}>
              {cropLabel(crop)}
            </option>
          ))}
        </select>
        <select
          aria-label="Province"
          value={province}
          onChange={(event) => {
            setProvince(event.target.value as Province | "all");
            reset();
          }}
        >
          <option value="all">All provinces</option>
          {(Object.keys(provinceLabels) as Province[]).map((item) => (
            <option key={item} value={item}>
              {provinceLabels[item]}
            </option>
          ))}
        </select>
      </div>
      {list.isError ? (
        <div className="fac-empty" role="alert">
          <p>{adminErrorMessage(list.error, "Groups could not be loaded from the server.")}</p>
          <Button className="mt-3" variant="outline" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : list.isLoading ? (
        <p className="fac-empty">Loading groups…</p>
      ) : !rows.length ? (
        <p className="fac-empty">
          {filtered
            ? "No groups match these filters."
            : "No groups yet. Create one to publish courses to specific farmers."}
        </p>
      ) : (
        <>
          <div className="staff-table" aria-busy={list.isFetching}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Audience</th>
                  <th>Location</th>
                  <th>Crop</th>
                  <th>Est. farmers</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <Link
                        className="font-bold"
                        to="/admin/groups/$groupId"
                        params={{ groupId: group.id }}
                      >
                        {group.name}
                      </Link>
                      {group.description && (
                        <small className="block text-muted-foreground">{group.description}</small>
                      )}
                    </td>
                    <td>{audienceCodeLabels[group.targetAudience]}</td>
                    <td>{groupPlace(group, (p) => provinceLabels[p])}</td>
                    <td>{cropLabel(group.crop)}</td>
                    <td>{group.estimatedFarmerCount.toLocaleString()}</td>
                    <td>
                      <Pill tone={recordStatusTone(group.status)}>
                        {recordStatusLabels[group.status]}
                      </Pill>
                    </td>
                    <td>{formatDate(group.updatedAt)}</td>
                    <td className="col-actions">
                      <RowMenu label={group.name}>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/groups/$groupId" params={{ groupId: group.id }}>
                            View
                          </Link>
                        </DropdownMenuItem>
                        {canManage && (
                          <>
                            <DropdownMenuItem onSelect={() => setEditing(group)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {group.status === "ACTIVE" ? (
                              <DropdownMenuItem
                                onSelect={() => setChange({ group, status: "INACTIVE" })}
                              >
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onSelect={() => setChange({ group, status: "ACTIVE" })}
                              >
                                Activate
                              </DropdownMenuItem>
                            )}
                          </>
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
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages} · {meta?.total ?? 0} group(s)
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
      <Dialog
        open={creating}
        onOpenChange={(open) => {
          if (!open) closeCreate();
          else setCreating(true);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a group</DialogTitle>
            <DialogDescription>
              Describe the farmers this group targets. You choose it later when publishing a course.
            </DialogDescription>
          </DialogHeader>
          <TargetGroupForm
            initial={emptyGroupValues()}
            submitLabel="Create group"
            busy={save.isPending}
            serverError={formError}
            onCancel={closeCreate}
            onSubmit={(values) => save.mutate({ id: null, values })}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setFormError("");
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
            <DialogDescription>
              Changes apply straight away to who can see the group's published courses.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <TargetGroupForm
              initial={groupValuesFrom(editing)}
              submitLabel="Save changes"
              busy={save.isPending}
              serverError={formError}
              onCancel={() => setEditing(null)}
              onSubmit={(values) => save.mutate({ id: editing.id, values })}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!change}
        onOpenChange={(open) => {
          if (!open) setChange(null);
        }}
        title={change ? statusCopy[change.status].title : ""}
        text={change ? `${change.group.name}: ${statusCopy[change.status].text}` : ""}
        confirmLabel={change ? statusCopy[change.status].label : "Confirm"}
        onConfirm={() => {
          if (change) setGroupStatus.mutate(change);
        }}
      />
    </>
  );
}
