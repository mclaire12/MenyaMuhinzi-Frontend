import { createFileRoute } from "@tanstack/react-router";
import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  emptyKnowledgeMetadata,
  KnowledgeDetailsDialog,
  KnowledgeFormDialog,
  KnowledgeRejectDialog,
  metadataFrom,
  type KnowledgeMetadata,
} from "@/components/admin/knowledge-dialogs";
import { formatDate, PageHead, Pill, RowMenu } from "@/components/admin/shell";
import { ConfirmDialog, Stat } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import { cropsQueryOptions } from "@/lib/admin/backend-groups";
import {
  adminKnowledgeKey,
  knowledgeCountQueryOptions,
  knowledgeListQueryOptions,
  knowledgeNextActions,
  knowledgeStatusLabels,
  knowledgeStatusTone,
  knowledgeTopicsQueryOptions,
  sourceTypeLabels,
  type KnowledgeSource,
  type KnowledgeStatusCode,
} from "@/lib/admin/backend-knowledge";
import { bffUploadKnowledge } from "@/lib/auth/knowledge-upload-server-fns";

export const Route = createFileRoute("/_authenticated/admin/knowledge")({
  component: KnowledgePage,
});

type Action =
  "process" | "submit-review" | "approve" | "activate" | "deactivate" | "archive" | "delete";
type Pending = { source: KnowledgeSource; action: Action } | null;

const actionCopy: Record<Action, { title: string; text: string; label: string; done: string }> = {
  process: {
    title: "Process this document?",
    text: "Text is extracted, split into passages and indexed. This can take a few minutes.",
    label: "Process",
    done: "Processing started.",
  },
  "submit-review": {
    title: "Submit for review?",
    text: "A reviewer checks the processed document before the assistant may use it.",
    label: "Submit for review",
    done: "Submitted for review.",
  },
  approve: {
    title: "Approve this document?",
    text: "The farmer assistant may use it in answers from now on.",
    label: "Approve",
    done: "Approved. The assistant may use it.",
  },
  activate: {
    title: "Use this document again?",
    text: "The approved version is used by the assistant again.",
    label: "Activate",
    done: "Document activated.",
  },
  deactivate: {
    title: "Stop using this document?",
    text: "The assistant stops using it. It stays approved and can be activated again.",
    label: "Deactivate",
    done: "Document deactivated.",
  },
  archive: {
    title: "Archive this document?",
    text: "It is no longer used by the assistant and cannot be changed.",
    label: "Archive",
    done: "Document archived.",
  },
  delete: {
    title: "Delete this document?",
    text: "The document and its files are removed permanently.",
    label: "Delete",
    done: "Document deleted.",
  },
};

const COUNTED: KnowledgeStatusCode[] = ["PENDING_REVIEW", "APPROVED", "PROCESSING", "FAILED"];

function metadataBody(metadata: KnowledgeMetadata, includeType: boolean) {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    title: metadata.title.trim(),
    ...(optional(metadata.description) ? { description: metadata.description.trim() } : {}),
    ...(includeType ? { sourceType: metadata.sourceType } : {}),
    language: metadata.language,
    ...(optional(metadata.sourceOrganization)
      ? { sourceOrganization: metadata.sourceOrganization.trim() }
      : {}),
    ...(optional(metadata.author) ? { author: metadata.author.trim() } : {}),
    ...(metadata.publicationDate ? { publicationDate: metadata.publicationDate } : {}),
    cropIds: metadata.cropIds,
    topicIds: metadata.topicIds,
    includeInTraining: metadata.includeInTraining,
  };
}

/** Knowledge Base documents (GET /knowledge/sources) and their review workflow. */
function KnowledgePage() {
  const queryClient = useQueryClient();
  const { permissions, loading: authLoading } = useAuth();
  const canRead = permissions.includes("knowledge:read");
  const canManage = permissions.includes("knowledge:manage");
  const canApprove = permissions.includes("knowledge:approve");
  const enabled = canRead && !authLoading;
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<KnowledgeStatusCode | "all">("all");
  const [cropId, setCropId] = useState("all");
  const [topicId, setTopicId] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{
    mode: "create" | "edit" | "version";
    source: KnowledgeSource | null;
  } | null>(null);
  const [formError, setFormError] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [rejecting, setRejecting] = useState<KnowledgeSource | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const crops = useQuery(cropsQueryOptions(enabled));
  const topics = useQuery(knowledgeTopicsQueryOptions(enabled));
  const counts = useQueries({
    queries: COUNTED.map((item) => knowledgeCountQueryOptions(item, enabled)),
  });
  const list = useQuery({
    ...knowledgeListQueryOptions(
      {
        page,
        ...(debounced ? { q: debounced } : {}),
        ...(status !== "all" ? { status } : {}),
        ...(cropId !== "all" ? { cropId } : {}),
        ...(topicId !== "all" ? { topicId } : {}),
      },
      enabled,
    ),
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.data.some((row) => row.status === "PROCESSING") ? 5000 : false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKnowledgeKey });
  const formInitial = useMemo(
    () => (form?.source ? metadataFrom(form.source) : emptyKnowledgeMetadata()),
    [form],
  );

  const save = useMutation({
    mutationFn: async (input: {
      metadata: KnowledgeMetadata;
      file: File | null;
      url: string;
      changeNote: string;
    }) => {
      if (!form) return null;
      if (form.mode === "edit" && form.source) {
        return adminApi("PATCH", `knowledge/sources/${form.source.id}`, {
          body: metadataBody(input.metadata, false),
        });
      }
      const path =
        form.mode === "version" && form.source
          ? `knowledge/sources/${form.source.id}/versions`
          : "knowledge/sources";
      if (!input.file) {
        // Web articles and other links: JSON body with an https storage reference.
        const body =
          form.mode === "version"
            ? {
                storageRef: input.url,
                ...(input.changeNote ? { changeNote: input.changeNote } : {}),
              }
            : {
                ...metadataBody(input.metadata, true),
                storageRef: input.url,
                ...(input.changeNote ? { changeNote: input.changeNote } : {}),
              };
        return adminApi("POST", path, { body });
      }
      const data = new FormData();
      data.set("__path", path);
      data.set("file", input.file);
      if (input.changeNote) data.set("changeNote", input.changeNote);
      if (form.mode === "create") {
        const body = metadataBody(input.metadata, true);
        for (const [key, value] of Object.entries(body)) {
          if (Array.isArray(value)) {
            if (value.length) data.set(key, value.join(","));
          } else if (value !== undefined) data.set(key, String(value));
        }
      }
      return bffUploadKnowledge({ data });
    },
    onSuccess: async () => {
      const mode = form?.mode;
      await refresh();
      setForm(null);
      setFormError("");
      toast.success(
        mode === "edit"
          ? "Details saved."
          : mode === "version"
            ? "New version uploaded. Process it to make it available for review."
            : "Document added. Process it to make it available for review.",
      );
    },
    onError: (error) => setFormError(adminErrorMessage(error, "The document could not be saved.")),
  });

  const act = useMutation({
    mutationFn: ({ source, action }: NonNullable<Pending>) => {
      const base = `knowledge/sources/${source.id}`;
      if (action === "delete") return adminApi("DELETE", base);
      return adminApi("POST", `${base}/${action}`, { body: {} });
    },
    onSuccess: async (_r, { action }) => {
      await refresh();
      toast.success(actionCopy[action].done);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The action could not be completed.")),
    onSettled: () => setPending(null),
  });

  const reject = useMutation({
    mutationFn: ({ source, reason }: { source: KnowledgeSource; reason: string }) =>
      adminApi("POST", `knowledge/sources/${source.id}/reject`, { body: { reason } }),
    onSuccess: async () => {
      await refresh();
      setRejecting(null);
      toast.success("Document rejected. The assistant will not use it.");
    },
    onError: (error) =>
      toast.error(adminErrorMessage(error, "The document could not be rejected.")),
  });

  const head = (
    <PageHead
      title="Knowledge Base"
      text="Reference documents the farmer assistant may draw on. They support answers; they are not courses and farmers do not see them in Amasomo."
    >
      {canManage && (
        <Button
          onClick={() => {
            setFormError("");
            setForm({ mode: "create", source: null });
          }}
        >
          <Plus aria-hidden />
          Add document
        </Button>
      )}
    </PageHead>
  );
  if (authLoading)
    return (
      <>
        {head}
        <p className="fac-empty">Loading documents…</p>
      </>
    );
  if (!canRead)
    return (
      <>
        {head}
        <p className="fac-empty">You do not have permission to view the Knowledge Base.</p>
      </>
    );

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);
  const filtered = !!debounced || status !== "all" || cropId !== "all" || topicId !== "all";

  return (
    <>
      {head}
      <div className="admin-stats">
        {COUNTED.map((item, index) => (
          <Stat key={item} label={knowledgeStatusLabels[item]} value={counts[index]?.data ?? "…"} />
        ))}
      </div>
      <div className="admin-filters">
        <input
          aria-label="Search documents"
          placeholder="Search title or description"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as KnowledgeStatusCode | "all");
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          {(Object.keys(knowledgeStatusLabels) as KnowledgeStatusCode[]).map((item) => (
            <option key={item} value={item}>
              {knowledgeStatusLabels[item]}
            </option>
          ))}
        </select>
        <select
          aria-label="Crop"
          value={cropId}
          onChange={(event) => {
            setCropId(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All crops</option>
          {(crops.data ?? []).map((crop) => (
            <option key={crop.id} value={crop.id}>
              {crop.nameEn}
            </option>
          ))}
        </select>
        <select
          aria-label="Topic"
          value={topicId}
          onChange={(event) => {
            setTopicId(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All topics</option>
          {(topics.data ?? []).map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.nameEn}
            </option>
          ))}
        </select>
      </div>
      {list.isError ? (
        <div className="fac-empty" role="alert">
          <p>{adminErrorMessage(list.error, "Documents could not be loaded from the server.")}</p>
          <Button className="mt-3" variant="outline" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : list.isLoading ? (
        <p className="fac-empty">Loading documents…</p>
      ) : !rows.length ? (
        <p className="fac-empty">
          {filtered ? "No documents match these filters." : "No documents yet."}
        </p>
      ) : (
        <>
          <div className="staff-table" aria-busy={list.isFetching}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Crops</th>
                  <th>Topics</th>
                  <th>Language</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const next = knowledgeNextActions(item);
                  const actions: [Action, boolean][] = [
                    ["process", canManage && next.process],
                    ["submit-review", canManage && next.submitReview],
                    ["approve", canApprove && next.approve],
                    ["activate", canApprove && next.activate],
                    ["deactivate", canApprove && next.deactivate],
                  ];
                  return (
                    <tr key={item.id}>
                      <td>
                        <button
                          type="button"
                          className="text-left font-bold hover:underline"
                          onClick={() => setViewing(item.id)}
                        >
                          {item.title}
                        </button>
                        {item.description && (
                          <small className="block text-muted-foreground">{item.description}</small>
                        )}
                      </td>
                      <td>{item.crops.map((crop) => crop.nameEn).join(", ") || "—"}</td>
                      <td>{item.topics.map((topic) => topic.nameEn).join(", ") || "—"}</td>
                      <td>{item.language === "en" ? "English" : "Kinyarwanda"}</td>
                      <td>{item.sourceOrganization ?? item.author ?? "—"}</td>
                      <td>
                        <span className="type-pill">{sourceTypeLabels[item.sourceType]}</span>
                      </td>
                      <td>
                        <Pill tone={knowledgeStatusTone(item.status)}>
                          {knowledgeStatusLabels[item.status]}
                        </Pill>
                        {item.approvedVersionId && !item.isActive && !item.archivedAt && (
                          <small className="block text-muted-foreground">Not in use</small>
                        )}
                        {!item.includeInTraining && (
                          <small className="block text-muted-foreground">
                            Not used for retraining
                          </small>
                        )}
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td className="col-actions">
                        <RowMenu label={item.title}>
                          <DropdownMenuItem onSelect={() => setViewing(item.id)}>
                            View details
                          </DropdownMenuItem>
                          {canManage && next.edit && (
                            <DropdownMenuItem
                              onSelect={() => {
                                setFormError("");
                                setForm({ mode: "edit", source: item });
                              }}
                            >
                              Edit details
                            </DropdownMenuItem>
                          )}
                          {canManage && next.newVersion && (
                            <DropdownMenuItem
                              onSelect={() => {
                                setFormError("");
                                setForm({ mode: "version", source: item });
                              }}
                            >
                              Upload new version
                            </DropdownMenuItem>
                          )}
                          {actions.some(([, allowed]) => allowed) && <DropdownMenuSeparator />}
                          {actions
                            .filter(([, allowed]) => allowed)
                            .map(([action]) => (
                              <DropdownMenuItem
                                key={action}
                                onSelect={() => setPending({ source: item, action })}
                              >
                                {actionCopy[action].label}
                              </DropdownMenuItem>
                            ))}
                          {canApprove && next.reject && (
                            <DropdownMenuItem onSelect={() => setRejecting(item)}>
                              Reject
                            </DropdownMenuItem>
                          )}
                          {canManage && (next.archive || next.remove) && <DropdownMenuSeparator />}
                          {canManage && next.archive && (
                            <DropdownMenuItem
                              onSelect={() => setPending({ source: item, action: "archive" })}
                            >
                              Archive
                            </DropdownMenuItem>
                          )}
                          {canManage && next.remove && (
                            <DropdownMenuItem
                              onSelect={() => setPending({ source: item, action: "delete" })}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
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
              Page {page} of {totalPages} · {meta?.total ?? 0} document(s)
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
      <KnowledgeFormDialog
        open={!!form}
        mode={form?.mode ?? "create"}
        initial={formInitial}
        busy={save.isPending}
        error={formError}
        onClose={() => setForm(null)}
        onSubmit={(input) => save.mutate(input)}
      />
      <KnowledgeDetailsDialog sourceId={viewing} onClose={() => setViewing(null)} />
      <KnowledgeRejectDialog
        source={rejecting}
        busy={reject.isPending}
        onClose={() => setRejecting(null)}
        onReject={(reason) => rejecting && reject.mutate({ source: rejecting, reason })}
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? actionCopy[pending.action].title : ""}
        text={pending ? `${pending.source.title}: ${actionCopy[pending.action].text}` : ""}
        confirmLabel={pending ? actionCopy[pending.action].label : "Confirm"}
        onConfirm={() => {
          if (pending) act.mutate(pending);
        }}
      />
    </>
  );
}
