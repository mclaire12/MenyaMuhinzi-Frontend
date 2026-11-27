import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDate, Pill } from "@/components/admin/shell";
import { PageHead } from "@/components/facilitator/shell";
import { LocationFields } from "@/components/location/location-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import { cropLabel, cropsQueryOptions } from "@/lib/admin/backend-groups";
import type { Province } from "@/lib/api/types";
import type { FacilitatorGroupSummary } from "@/lib/facilitator/backend-courses";
import { facilitatorCoursesKey } from "@/lib/facilitator/backend-courses";
import { facilitatorGroupsKey, groupListQueryOptions } from "@/lib/facilitator/backend-groups";

export const Route = createFileRoute("/_authenticated/facilitator/groups/")({
  validateSearch: (search: Record<string, unknown>): { create?: boolean } =>
    search["create"] ? { create: true } : {},
  component: Groups,
});

/** The facilitator's farmer groups, from GET /facilitator/groups. */
function Groups() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/facilitator/groups/" });
  const { permissions, loading } = useAuth();
  const canRead = permissions.includes("farmer-groups:read");
  const canManage = permissions.includes("farmer-groups:manage");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(!!search.create);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const list = useQuery(
    groupListQueryOptions(
      { page, ...(debounced ? { search: debounced } : {}) },
      canRead && !loading,
    ),
  );
  const head = (
    <PageHead
      title="My Groups"
      text="Your farmer groups. Add farmers one by one, from Excel, or by searching farmers already on MenyaMuhinzi."
    >
      {canManage && (
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          Create group
        </Button>
      )}
    </PageHead>
  );
  if (loading)
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
            setPage(1);
          }}
        />
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
      ) : rows.length === 0 ? (
        <div className="fac-empty">
          <p>{debounced ? "No groups match this search." : "You have no groups yet."}</p>
          {!debounced && canManage && (
            <Button className="mt-3" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Create your first group
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="staff-table" aria-busy={list.isFetching}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Crop</th>
                  <th>Location</th>
                  <th>Farmers</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <Link
                        className="font-bold"
                        to="/facilitator/groups/$groupId"
                        params={{ groupId: group.id }}
                      >
                        {group.name}
                      </Link>
                      {group.description && (
                        <small className="block text-muted-foreground">{group.description}</small>
                      )}
                    </td>
                    <td>{cropLabel(group.crop)}</td>
                    <td>
                      {[group.location.sector, group.location.district].filter(Boolean).join(", ")}
                    </td>
                    <td>{group.memberCount}</td>
                    <td>
                      <Pill tone={group.status === "ACTIVE" ? "ok" : "muted"}>
                        {group.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Pill>
                    </td>
                    <td>{formatDate(group.createdAt)}</td>
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
          )}
        </>
      )}
      <CreateGroupDialog
        open={creating}
        onClose={() => {
          setCreating(false);
          if (search.create) void navigate({ search: {} });
        }}
        onCreated={(group) =>
          void navigate({ to: "/facilitator/groups/$groupId", params: { groupId: group.id } })
        }
      />
    </>
  );
}

function CreateGroupDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (group: FacilitatorGroupSummary) => void;
}) {
  const queryClient = useQueryClient();
  const crops = useQuery(cropsQueryOptions(open));
  const initial = {
    name: "",
    description: "",
    cropId: "",
    province: "NORTHERN" as Province,
    district: "",
    sector: "",
    cell: "",
    village: "",
  };
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setValues(initial);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const create = useMutation({
    mutationFn: () =>
      adminApi<FacilitatorGroupSummary>("POST", "facilitator/groups", {
        body: {
          name: values.name.trim(),
          ...(values.description.trim() ? { description: values.description.trim() } : {}),
          cropId: values.cropId,
          location: {
            province: values.province,
            district: values.district,
            sector: values.sector.trim(),
            ...(values.cell.trim() ? { cell: values.cell.trim() } : {}),
            ...(values.village.trim() ? { village: values.village.trim() } : {}),
          },
        },
      }),
    onSuccess: async (group) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: facilitatorGroupsKey }),
        queryClient.invalidateQueries({ queryKey: facilitatorCoursesKey }),
      ]);
      toast.success(`${group.name} created. Now add its farmers.`);
      onClose();
      onCreated(group);
    },
    onError: (failure) => setError(adminErrorMessage(failure, "The group could not be created.")),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (values.name.trim().length < 3)
      return setError("Enter a group name (at least 3 characters).");
    if (!values.cropId) return setError("Choose the crop the group grows.");
    if (!values.district) return setError("Choose a district.");
    if (!values.sector.trim()) return setError("Choose the sector.");
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !create.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a farmer group</DialogTitle>
          <DialogDescription>Add the farmers on the next page.</DialogDescription>
        </DialogHeader>
        <form className="admin-form" noValidate onSubmit={submit}>
          <fieldset disabled={create.isPending} className="contents">
            <label>
              Group name
              <input
                value={values.name}
                maxLength={150}
                placeholder="e.g. Kinigi tomato growers"
                onChange={(event) => set("name", event.target.value)}
              />
            </label>
            <label>
              Description (optional)
              <textarea
                rows={2}
                value={values.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </label>
            <label>
              Crop
              <select value={values.cropId} onChange={(event) => set("cropId", event.target.value)}>
                <option value="">{crops.isLoading ? "Loading crops…" : "Choose a crop"}</option>
                {(crops.data ?? []).map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {cropLabel(crop)}
                  </option>
                ))}
              </select>
            </label>
            <LocationFields
              idPrefix="new-group"
              value={values}
              labels={{ cell: "Cell (optional)", village: "Village (optional)" }}
              placeholders={{ cell: "Whole sector", village: "Whole cell" }}
              onChange={(next) => {
                setValues((current) => ({ ...current, ...next }));
                setError("");
              }}
            />
          </fieldset>
          {error && (
            <p className="fac-field-error" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
