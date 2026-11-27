import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { formatDate, formatDateTime, Pill, RowMenu } from "@/components/admin/shell";
import { ConfirmDialog, Stat } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage, type Paginated } from "@/lib/admin/api";
import {
  AI_CODE_PATTERN,
  aiAllAssistantsQueryOptions,
  aiAllModelsQueryOptions,
  aiAllPromptsQueryOptions,
  aiAssistantsQueryOptions,
  aiKey,
  aiModelConfigurationsQueryOptions,
  aiModelsQueryOptions,
  aiPromptsQueryOptions,
  aiPromptVersionsQueryOptions,
  aiRequestsQueryOptions,
  aiSafetyQueryOptions,
  aiStatusLabels,
  aiStatusTone,
  aiUsageSummaryQueryOptions,
  ASSISTANT_TYPES,
  capabilityLabels,
  formatNumber,
  lifecycleActions,
  promptCategoryLabels,
  requestStatusLabels,
  safetyCategoryLabels,
  type AiAssistant,
  type AiCapability,
  type AiModel,
  type AiPrompt,
  type AiPromptCategory,
  type AiRecordStatus,
  type AiRequestStatus,
  type AiSafetyCategory,
  type AiSafetyPolicy,
  type Lang,
} from "@/lib/admin/backend-ai";
import type { Permission } from "@/lib/api/types";
import type { UseQueryResult } from "@tanstack/react-query";

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
const optional = (text: string) => (text.trim() ? text.trim() : undefined);
const langName = (code: string) => (code === "en" ? "English" : "Kinyarwanda");

// ---------------------------------------------------------------- shared pieces

function ListState<T>({
  query,
  empty,
  children,
}: {
  query: UseQueryResult<Paginated<T>>;
  empty: string;
  children: (rows: T[]) => ReactNode;
}) {
  if (query.isError) {
    return (
      <div className="fac-empty" role="alert">
        <p>{adminErrorMessage(query.error, "The list could not be loaded from the server.")}</p>
        <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (query.isLoading) return <p className="fac-empty">Loading…</p>;
  const rows = query.data?.data ?? [];
  if (!rows.length) return <p className="fac-empty">{empty}</p>;
  return <>{children(rows)}</>;
}

function Pager({
  page,
  setPage,
  meta,
  noun,
}: {
  page: number;
  setPage: (page: number) => void;
  meta: Paginated<unknown>["meta"] | undefined;
  noun: string;
}) {
  const total = Math.max(1, meta?.totalPages ?? 1);
  if (!meta || meta.total <= meta.limit) return null;
  return (
    <div className="admin-actions mt-3 items-center">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        Previous
      </Button>
      <span className="text-sm">
        Page {page} of {total} · {meta.total} {noun}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= total}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  value: AiRecordStatus | "all";
  onChange: (value: AiRecordStatus | "all") => void;
}) {
  return (
    <select
      aria-label="Status"
      value={value}
      onChange={(event) => onChange(event.target.value as AiRecordStatus | "all")}
    >
      <option value="all">All statuses</option>
      {(Object.keys(aiStatusLabels) as AiRecordStatus[]).map((item) => (
        <option key={item} value={item}>
          {aiStatusLabels[item]}
        </option>
      ))}
    </select>
  );
}

const lifecycleCopy = {
  activate: { label: "Activate", text: "It becomes available to the farmer assistant." },
  deactivate: {
    label: "Deactivate",
    text: "It stops being used. You can activate it again later.",
  },
  archive: {
    label: "Archive",
    text: "It is kept for history but can no longer be used or changed.",
  },
} as const;

/** Activate / deactivate / archive through POST {base}/{id}/{action}. */
function useLifecycle(base: string) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{
    id: string;
    name: string;
    action: keyof typeof lifecycleCopy;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: (item: NonNullable<typeof pending>) =>
      adminApi("POST", `${base}/${item.id}/${item.action}`, { body: {} }),
    onSuccess: async (_r, item) => {
      await queryClient.invalidateQueries({ queryKey: aiKey });
      toast.success(`${item.name}: ${lifecycleCopy[item.action].label.toLowerCase()}d.`);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The status could not be changed.")),
    onSettled: () => setPending(null),
  });
  const items = (row: { id: string; name: string; status: AiRecordStatus }, allowed: boolean) =>
    allowed
      ? lifecycleActions(row.status).map((action) => (
          <DropdownMenuItem
            key={action}
            onSelect={() => setPending({ id: row.id, name: row.name, action })}
          >
            {lifecycleCopy[action].label}
          </DropdownMenuItem>
        ))
      : null;
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      title={pending ? `${lifecycleCopy[pending.action].label} ${pending.name}?` : ""}
      text={pending ? lifecycleCopy[pending.action].text : ""}
      confirmLabel={pending ? lifecycleCopy[pending.action].label : "Confirm"}
      onConfirm={() => {
        if (pending) mutation.mutate(pending);
      }}
    />
  );
  return { items, dialog };
}

function FormDialog({
  open,
  title,
  description,
  busy,
  error,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  busy: boolean;
  error: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="admin-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {children}
          {error && (
            <p className="fac-field-error" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" aria-hidden />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Save mutation that refreshes AI lists and reports errors inline. */
function useSave<T>(fn: (input: T) => Promise<unknown>, done: string, onDone: () => void) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: aiKey });
      setError("");
      onDone();
      toast.success(done);
    },
    onError: (failure) => setError(adminErrorMessage(failure, "The change could not be saved.")),
  });
  return { mutation, error, setError };
}

function useCan(permission: Permission) {
  const { permissions } = useAuth();
  return permissions.includes(permission);
}

function LanguagesPicker({
  value,
  onChange,
}: {
  value: Lang[];
  onChange: (value: Lang[]) => void;
}) {
  return (
    <fieldset className="grid gap-1">
      <legend className="text-sm font-bold">Languages</legend>
      <div className="flex gap-4 text-sm">
        {(["rw", "en"] as Lang[]).map((code) => (
          <label key={code} className="flex items-center gap-1 font-normal">
            <input
              type="checkbox"
              checked={value.includes(code)}
              onChange={(event) =>
                onChange(
                  event.target.checked ? [...value, code] : value.filter((item) => item !== code),
                )
              }
            />
            {langName(code)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------- assistants

type AssistantValues = {
  code: string;
  name: string;
  assistantType: string;
  purpose: string;
  description: string;
  supportedLanguages: Lang[];
  defaultLanguage: Lang;
  knowledgeAccess: boolean;
  maxKnowledgeChunks: number;
  requireSourceReferences: boolean;
};

const assistantValues = (row: AiAssistant | null): AssistantValues => ({
  code: row?.code ?? "",
  name: row?.name ?? "",
  assistantType: row?.assistantType ?? "GENERAL_AGRICULTURE",
  purpose: row?.purpose ?? "",
  description: row?.description ?? "",
  supportedLanguages: row?.supportedLanguages ?? ["rw", "en"],
  defaultLanguage: row?.defaultLanguage ?? "rw",
  knowledgeAccess: row?.knowledgeAccess ?? true,
  maxKnowledgeChunks: row?.maxKnowledgeChunks ?? 5,
  requireSourceReferences: row?.requireSourceReferences ?? false,
});

export function AssistantsPanel() {
  const canManage = useCan("ai-assistants:manage");
  const [status, setStatus] = useState<AiRecordStatus | "all">("all");
  const [page, setPage] = useState(1);
  const list = useQuery({
    ...aiAssistantsQueryOptions({ page, ...(status !== "all" ? { status } : {}) }, true),
    placeholderData: keepPreviousData,
  });
  const lifecycle = useLifecycle("admin/ai/assistants");
  const [editing, setEditing] = useState<{ row: AiAssistant | null } | null>(null);
  const [models, setModels] = useState<AiAssistant | null>(null);
  const [prompts, setPrompts] = useState<AiAssistant | null>(null);
  const [values, setValues] = useState<AssistantValues>(assistantValues(null));
  useEffect(() => {
    if (editing) setValues(assistantValues(editing.row));
  }, [editing]);
  const save = useSave(
    (input: { id: string | null; values: AssistantValues }) => {
      const body = {
        name: input.values.name.trim(),
        assistantType: input.values.assistantType,
        purpose: input.values.purpose.trim(),
        ...(optional(input.values.description)
          ? { description: input.values.description.trim() }
          : {}),
        supportedLanguages: input.values.supportedLanguages,
        defaultLanguage: input.values.defaultLanguage,
        knowledgeAccess: input.values.knowledgeAccess,
        maxKnowledgeChunks: input.values.maxKnowledgeChunks,
        requireSourceReferences:
          input.values.knowledgeAccess && input.values.requireSourceReferences,
      };
      return input.id
        ? adminApi("PATCH", `admin/ai/assistants/${input.id}`, { body })
        : adminApi("POST", "admin/ai/assistants", {
            body: { ...body, code: input.values.code.trim() },
          });
    },
    editing?.row ? "Assistant saved." : "Assistant created.",
    () => setEditing(null),
  );
  const set = <K extends keyof AssistantValues>(key: K, value: AssistantValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    save.setError("");
  };

  function submit() {
    if (!editing?.row && !AI_CODE_PATTERN.test(values.code.trim()))
      return save.setError(
        "Code: upper-case letters, digits and underscores, starting with a letter.",
      );
    if (!values.name.trim()) return save.setError("Enter a name.");
    if (!values.purpose.trim()) return save.setError("Describe the purpose.");
    if (!values.supportedLanguages.length) return save.setError("Choose at least one language.");
    if (!values.supportedLanguages.includes(values.defaultLanguage))
      return save.setError("The default language must be one of the languages.");
    save.mutation.mutate({ id: editing?.row?.id ?? null, values });
  }

  return (
    <section>
      <div className="admin-filters">
        <StatusFilter
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        {canManage && (
          <Button onClick={() => setEditing({ row: null })}>
            <Plus aria-hidden />
            New assistant
          </Button>
        )}
      </div>
      <ListState query={list} empty="No assistants yet.">
        {(rows) => (
          <div className="staff-table">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Assistant</th>
                  <th>Type</th>
                  <th>Languages</th>
                  <th>Knowledge</th>
                  <th>Prompts</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.name}</b>
                      <small className="block text-muted-foreground">
                        {row.code} · v{row.currentVersion} · {row.purpose}
                      </small>
                    </td>
                    <td>
                      {ASSISTANT_TYPES.find((item) => item.value === row.assistantType)?.label ??
                        row.assistantType}
                    </td>
                    <td>{row.supportedLanguages.map(langName).join(", ")}</td>
                    <td>
                      {row.knowledgeAccess ? `Yes (${row.maxKnowledgeChunks} passages)` : "No"}
                    </td>
                    <td>{row.prompts.length}</td>
                    <td>
                      {row.activeModelConfigurationId ? (
                        "Configured"
                      ) : (
                        <span className="text-destructive">Not set</span>
                      )}
                    </td>
                    <td>
                      <Pill tone={aiStatusTone(row.status)}>{aiStatusLabels[row.status]}</Pill>
                    </td>
                    <td className="col-actions">
                      <RowMenu label={row.name}>
                        {canManage && row.status !== "ARCHIVED" && (
                          <>
                            <DropdownMenuItem onSelect={() => setEditing({ row })}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setPrompts(row)}>
                              Prompts
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setModels(row)}>
                              Model
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {lifecycle.items(row, canManage)}
                      </RowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListState>
      <Pager page={page} setPage={setPage} meta={list.data?.meta} noun="assistant(s)" />
      {lifecycle.dialog}
      <FormDialog
        open={!!editing}
        title={editing?.row ? `Edit ${editing.row.name}` : "New assistant"}
        description="Assistants answer farmers. Link prompts and a model before activating."
        busy={save.mutation.isPending}
        error={save.error}
        submitLabel={editing?.row ? "Save assistant" : "Create assistant"}
        onClose={() => setEditing(null)}
        onSubmit={submit}
      >
        <div className="fac-row">
          <label>
            Code
            <input
              value={values.code}
              disabled={!!editing?.row}
              placeholder="FARMER_ASSISTANT"
              onChange={(event) => set("code", event.target.value.toUpperCase())}
            />
          </label>
          <label>
            Name
            <input
              value={values.name}
              maxLength={150}
              onChange={(event) => set("name", event.target.value)}
            />
          </label>
        </div>
        <label>
          Type
          <select
            value={values.assistantType}
            onChange={(event) => set("assistantType", event.target.value)}
          >
            {ASSISTANT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Purpose
          <input
            value={values.purpose}
            maxLength={1000}
            onChange={(event) => set("purpose", event.target.value)}
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
        <LanguagesPicker
          value={values.supportedLanguages}
          onChange={(value) => set("supportedLanguages", value)}
        />
        <label>
          Default language
          <select
            value={values.defaultLanguage}
            onChange={(event) => set("defaultLanguage", event.target.value as Lang)}
          >
            <option value="rw">Kinyarwanda</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.knowledgeAccess}
            onChange={(event) => set("knowledgeAccess", event.target.checked)}
          />
          Uses approved Knowledge Base documents
        </label>
        {values.knowledgeAccess && (
          <div className="fac-row">
            <label>
              Passages per answer
              <input
                type="number"
                min={1}
                max={20}
                value={values.maxKnowledgeChunks}
                onChange={(event) => set("maxKnowledgeChunks", event.target.valueAsNumber)}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.requireSourceReferences}
                onChange={(event) => set("requireSourceReferences", event.target.checked)}
              />
              Answers must cite their sources
            </label>
          </div>
        )}
      </FormDialog>
      <AssistantModelDialog assistant={models} onClose={() => setModels(null)} />
      <AssistantPromptsDialog assistant={prompts} onClose={() => setPrompts(null)} />
    </section>
  );
}

function AssistantModelDialog({
  assistant,
  onClose,
}: {
  assistant: AiAssistant | null;
  onClose: () => void;
}) {
  const open = !!assistant;
  const models = useQuery(aiAllModelsQueryOptions(open));
  const configs = useQuery(aiModelConfigurationsQueryOptions(assistant?.id ?? "", open));
  const [primary, setPrimary] = useState("");
  const [fallback, setFallback] = useState("");
  useEffect(() => {
    setPrimary("");
    setFallback("");
  }, [assistant]);
  const save = useSave(
    () =>
      adminApi("POST", "admin/ai/model-configurations", {
        body: {
          assistantId: assistant?.id,
          primaryModelId: primary,
          ...(fallback ? { fallbackModelId: fallback } : {}),
        },
      }),
    "Model configuration saved.",
    onClose,
  );
  const usable = (models.data ?? []).filter(
    (model) => model.status === "ACTIVE" && model.capabilities.includes("TEXT_GENERATION"),
  );
  const active = (configs.data ?? []).find((config) => config.status === "ACTIVE");
  return (
    <FormDialog
      open={open}
      title={`Model for ${assistant?.name ?? ""}`}
      description="The assistant uses the primary model, and the fallback model if the primary one fails."
      busy={save.mutation.isPending}
      error={save.error}
      submitLabel="Save model"
      onClose={onClose}
      onSubmit={() => {
        if (!primary) return save.setError("Choose a primary model.");
        if (fallback && fallback === primary)
          return save.setError("Choose a different fallback model.");
        save.mutation.mutate(undefined);
      }}
    >
      <p className="text-sm">
        Current:{" "}
        {configs.isLoading
          ? "loading…"
          : active
            ? `${active.primaryModel.displayName}${active.fallbackModel ? `, fallback ${active.fallbackModel.displayName}` : ""} (version ${active.version})`
            : "none"}
      </p>
      {models.isError && (
        <p className="text-destructive">
          {adminErrorMessage(models.error, "Models could not be loaded.")}
        </p>
      )}
      {!models.isLoading && usable.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No active text-generation model. Add or activate one under Models.
        </p>
      )}
      <label>
        Primary model
        <select
          value={primary}
          onChange={(event) => {
            setPrimary(event.target.value);
            save.setError("");
          }}
        >
          <option value="">Choose a model</option>
          {usable.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName} · {model.provider}/{model.modelName}
              {model.providerRegistered ? "" : " (provider not connected)"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fallback model (optional)
        <select
          value={fallback}
          onChange={(event) => {
            setFallback(event.target.value);
            save.setError("");
          }}
        >
          <option value="">None</option>
          {usable.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName} · {model.provider}/{model.modelName}
            </option>
          ))}
        </select>
      </label>
    </FormDialog>
  );
}

function AssistantPromptsDialog({
  assistant,
  onClose,
}: {
  assistant: AiAssistant | null;
  onClose: () => void;
}) {
  const open = !!assistant;
  const prompts = useQuery(aiAllPromptsQueryOptions(open));
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    setSelected(
      assistant
        ? [...assistant.prompts]
            .sort((a, b) => a.position - b.position)
            .map((link) => link.templateId)
        : [],
    );
  }, [assistant]);
  const save = useSave(
    () =>
      adminApi("PUT", `admin/ai/assistants/${assistant?.id}/prompts`, {
        body: { prompts: selected.map((templateId, position) => ({ templateId, position })) },
      }),
    "Prompts saved.",
    onClose,
  );
  const available = (prompts.data ?? []).filter((prompt) => prompt.status !== "ARCHIVED");
  return (
    <FormDialog
      open={open}
      title={`Prompts for ${assistant?.name ?? ""}`}
      description="Prompts are combined in the order you tick them. The default version of each prompt is used."
      busy={save.mutation.isPending}
      error={save.error}
      submitLabel="Save prompts"
      onClose={onClose}
      onSubmit={() => save.mutation.mutate(undefined)}
    >
      {prompts.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading prompts…</p>
      ) : available.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prompts yet. Create one under Prompts.</p>
      ) : (
        <div className="space-y-1 text-sm">
          {available.map((prompt) => {
            const index = selected.indexOf(prompt.id);
            return (
              <label key={prompt.id} className="flex items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  checked={index >= 0}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, prompt.id]
                        : current.filter((id) => id !== prompt.id),
                    )
                  }
                />
                {index >= 0 && <b>{index + 1}.</b>} {prompt.name} ·{" "}
                {promptCategoryLabels[prompt.category]} · {langName(prompt.language)} ·{" "}
                {aiStatusLabels[prompt.status]}
              </label>
            );
          })}
        </div>
      )}
    </FormDialog>
  );
}

// ---------------------------------------------------------------- prompts

export function PromptsPanel() {
  const canManage = useCan("ai-prompts:manage");
  const [status, setStatus] = useState<AiRecordStatus | "all">("all");
  const [page, setPage] = useState(1);
  const list = useQuery({
    ...aiPromptsQueryOptions({ page, ...(status !== "all" ? { status } : {}) }, true),
    placeholderData: keepPreviousData,
  });
  const lifecycle = useLifecycle("admin/ai/prompts");
  const [creating, setCreating] = useState(false);
  const [versioning, setVersioning] = useState<AiPrompt | null>(null);
  const [viewing, setViewing] = useState<AiPrompt | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "AGRICULTURAL_ASSISTANCE" as AiPromptCategory,
    language: "rw" as Lang,
    purpose: "",
    content: "",
  });
  const [version, setVersion] = useState({ content: "", changeNote: "", makeDefault: true });
  useEffect(() => {
    if (creating)
      setForm({
        code: "",
        name: "",
        category: "AGRICULTURAL_ASSISTANCE",
        language: "rw",
        purpose: "",
        content: "",
      });
  }, [creating]);
  useEffect(() => {
    if (versioning)
      setVersion({
        content: versioning.defaultVersion?.content ?? "",
        changeNote: "",
        makeDefault: true,
      });
  }, [versioning]);
  const create = useSave(
    () =>
      adminApi("POST", "admin/ai/prompts", {
        body: {
          code: form.code.trim(),
          name: form.name.trim(),
          category: form.category,
          language: form.language,
          content: form.content,
          ...(optional(form.purpose) ? { purpose: form.purpose.trim() } : {}),
        },
      }),
    "Prompt created.",
    () => setCreating(false),
  );
  const addVersion = useSave(
    () =>
      adminApi("POST", `admin/ai/prompts/${versioning?.id}/versions`, {
        body: {
          content: version.content,
          makeDefault: version.makeDefault,
          ...(optional(version.changeNote) ? { changeNote: version.changeNote.trim() } : {}),
        },
      }),
    "New prompt version saved.",
    () => setVersioning(null),
  );
  return (
    <section>
      <div className="admin-filters">
        <StatusFilter
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New prompt
          </Button>
        )}
      </div>
      <ListState query={list} empty="No prompts yet.">
        {(rows) => (
          <div className="staff-table">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Prompt</th>
                  <th>Category</th>
                  <th>Language</th>
                  <th>Default version</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="text-left font-bold hover:underline"
                        onClick={() => setViewing(row)}
                      >
                        {row.name}
                      </button>
                      <small className="block text-muted-foreground">
                        {row.code}
                        {row.purpose ? ` · ${row.purpose}` : ""}
                      </small>
                    </td>
                    <td>{promptCategoryLabels[row.category]}</td>
                    <td>{langName(row.language)}</td>
                    <td>
                      {row.defaultVersion ? `v${row.defaultVersion.versionNumber}` : "—"} of{" "}
                      {row.latestVersionNumber}
                    </td>
                    <td>
                      <Pill tone={aiStatusTone(row.status)}>{aiStatusLabels[row.status]}</Pill>
                    </td>
                    <td>{formatDate(row.updatedAt)}</td>
                    <td className="col-actions">
                      <RowMenu label={row.name}>
                        <DropdownMenuItem onSelect={() => setViewing(row)}>
                          View versions
                        </DropdownMenuItem>
                        {canManage && row.status !== "ARCHIVED" && (
                          <DropdownMenuItem onSelect={() => setVersioning(row)}>
                            New version
                          </DropdownMenuItem>
                        )}
                        {canManage && <DropdownMenuSeparator />}
                        {lifecycle.items(row, canManage)}
                      </RowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListState>
      <Pager page={page} setPage={setPage} meta={list.data?.meta} noun="prompt(s)" />
      {lifecycle.dialog}
      <FormDialog
        open={creating}
        title="New prompt"
        description="Prompt text tells the assistant how to answer. Use {{variable}} placeholders where needed."
        busy={create.mutation.isPending}
        error={create.error}
        submitLabel="Create prompt"
        onClose={() => setCreating(false)}
        onSubmit={() => {
          if (!AI_CODE_PATTERN.test(form.code.trim()))
            return create.setError(
              "Code: upper-case letters, digits and underscores, starting with a letter.",
            );
          if (!form.name.trim()) return create.setError("Enter a name.");
          if (!form.content.trim()) return create.setError("Write the prompt text.");
          create.mutation.mutate(undefined);
        }}
      >
        <div className="fac-row">
          <label>
            Code
            <input
              value={form.code}
              placeholder="FARMER_ANSWER_RW"
              onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            />
          </label>
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
        </div>
        <div className="fac-row">
          <label>
            Category
            <select
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value as AiPromptCategory })
              }
            >
              {(Object.keys(promptCategoryLabels) as AiPromptCategory[]).map((item) => (
                <option key={item} value={item}>
                  {promptCategoryLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Language
            <select
              value={form.language}
              onChange={(event) => setForm({ ...form, language: event.target.value as Lang })}
            >
              <option value="rw">Kinyarwanda</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <label>
          Purpose (optional)
          <input
            value={form.purpose}
            onChange={(event) => setForm({ ...form, purpose: event.target.value })}
          />
        </label>
        <label>
          Prompt text
          <textarea
            rows={8}
            value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
          />
        </label>
      </FormDialog>
      <FormDialog
        open={!!versioning}
        title={`New version of ${versioning?.name ?? ""}`}
        description="Earlier versions are kept. The default version is the one assistants use."
        busy={addVersion.mutation.isPending}
        error={addVersion.error}
        submitLabel="Save version"
        onClose={() => setVersioning(null)}
        onSubmit={() => {
          if (!version.content.trim()) return addVersion.setError("Write the prompt text.");
          addVersion.mutation.mutate(undefined);
        }}
      >
        <label>
          Prompt text
          <textarea
            rows={10}
            value={version.content}
            onChange={(event) => setVersion({ ...version, content: event.target.value })}
          />
        </label>
        <label>
          Change note (optional)
          <input
            value={version.changeNote}
            onChange={(event) => setVersion({ ...version, changeNote: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={version.makeDefault}
            onChange={(event) => setVersion({ ...version, makeDefault: event.target.checked })}
          />
          Make this the default version
        </label>
      </FormDialog>
      <PromptVersionsDialog prompt={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}

function PromptVersionsDialog({
  prompt,
  onClose,
}: {
  prompt: AiPrompt | null;
  onClose: () => void;
}) {
  const versions = useQuery(aiPromptVersionsQueryOptions(prompt?.id ?? "", !!prompt));
  return (
    <Dialog open={!!prompt} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prompt?.name}</DialogTitle>
          <DialogDescription>
            {prompt?.description ?? "Prompt versions, newest first."}
          </DialogDescription>
        </DialogHeader>
        {versions.isError ? (
          <p className="text-destructive">
            {adminErrorMessage(versions.error, "Versions could not be loaded.")}
          </p>
        ) : versions.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {[...(versions.data ?? [])]
              .sort((a, b) => b.versionNumber - a.versionNumber)
              .map((item) => (
                <li key={item.id} className="admin-panel">
                  <b>Version {item.versionNumber}</b>
                  {item.isDefault && (
                    <>
                      {" "}
                      <Pill tone="ok">Default</Pill>
                    </>
                  )}{" "}
                  · {formatDateTime(item.createdAt)}
                  {item.changeNote && (
                    <span className="block text-muted-foreground">{item.changeNote}</span>
                  )}
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                    {item.content}
                  </pre>
                </li>
              ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- models

type ModelValues = {
  provider: string;
  modelName: string;
  modelVersion: string;
  displayName: string;
  capabilities: AiCapability[];
  supportedLanguages: Lang[];
  contextWindowTokens: string;
  maxOutputTokens: string;
};
const modelValues = (row: AiModel | null): ModelValues => ({
  provider: row?.provider ?? "",
  modelName: row?.modelName ?? "",
  modelVersion: row?.modelVersion ?? "",
  displayName: row?.displayName ?? "",
  capabilities: row?.capabilities ?? ["TEXT_GENERATION"],
  supportedLanguages: row?.supportedLanguages ?? ["rw", "en"],
  contextWindowTokens: row?.contextWindowTokens ? String(row.contextWindowTokens) : "",
  maxOutputTokens: row?.maxOutputTokens ? String(row.maxOutputTokens) : "",
});

export function ModelsPanel() {
  const canManage = useCan("ai-models:manage");
  const [status, setStatus] = useState<AiRecordStatus | "all">("all");
  const [page, setPage] = useState(1);
  const list = useQuery({
    ...aiModelsQueryOptions({ page, ...(status !== "all" ? { status } : {}) }, true),
    placeholderData: keepPreviousData,
  });
  const lifecycle = useLifecycle("admin/ai/models");
  const [editing, setEditing] = useState<{ row: AiModel | null } | null>(null);
  const [values, setValues] = useState<ModelValues>(modelValues(null));
  useEffect(() => {
    if (editing) setValues(modelValues(editing.row));
  }, [editing]);
  const save = useSave(
    () => {
      const numbers = {
        ...(values.contextWindowTokens
          ? { contextWindowTokens: Number(values.contextWindowTokens) }
          : {}),
        ...(values.maxOutputTokens ? { maxOutputTokens: Number(values.maxOutputTokens) } : {}),
      };
      const body = {
        displayName: values.displayName.trim(),
        capabilities: values.capabilities,
        supportedLanguages: values.supportedLanguages,
        ...numbers,
      };
      return editing?.row
        ? adminApi("PATCH", `admin/ai/models/${editing.row.id}`, { body })
        : adminApi("POST", "admin/ai/models", {
            body: {
              ...body,
              provider: values.provider.trim(),
              modelName: values.modelName.trim(),
              modelVersion: values.modelVersion.trim(),
            },
          });
    },
    editing?.row ? "Model saved." : "Model registered.",
    () => setEditing(null),
  );
  const set = <K extends keyof ModelValues>(key: K, value: ModelValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    save.setError("");
  };
  return (
    <section>
      <p className="fac-note mb-3">
        Models are registered here; API keys stay in the backend configuration. “Provider connected”
        means the backend can actually call it.
      </p>
      <div className="admin-filters">
        <StatusFilter
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        {canManage && (
          <Button onClick={() => setEditing({ row: null })}>
            <Plus aria-hidden />
            Register model
          </Button>
        )}
      </div>
      <ListState query={list} empty="No models registered yet.">
        {(rows) => (
          <div className="staff-table">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Capabilities</th>
                  <th>Context / output</th>
                  <th>Provider connected</th>
                  <th>Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.displayName}</b>
                      <small className="block text-muted-foreground">
                        {row.modelName} · {row.modelVersion}
                      </small>
                    </td>
                    <td>{row.provider}</td>
                    <td>{row.capabilities.map((item) => capabilityLabels[item]).join(", ")}</td>
                    <td>
                      {formatNumber(row.contextWindowTokens)} / {formatNumber(row.maxOutputTokens)}
                    </td>
                    <td>
                      {row.providerRegistered ? (
                        <Pill tone="ok">Yes</Pill>
                      ) : (
                        <Pill tone="bad">No</Pill>
                      )}
                    </td>
                    <td>
                      <Pill tone={aiStatusTone(row.status)}>{aiStatusLabels[row.status]}</Pill>
                    </td>
                    <td className="col-actions">
                      <RowMenu label={row.displayName}>
                        {canManage && row.status !== "ARCHIVED" && (
                          <>
                            <DropdownMenuItem onSelect={() => setEditing({ row })}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {lifecycle.items({ ...row, name: row.displayName }, canManage)}
                      </RowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListState>
      <Pager page={page} setPage={setPage} meta={list.data?.meta} noun="model(s)" />
      {lifecycle.dialog}
      <FormDialog
        open={!!editing}
        title={editing?.row ? `Edit ${editing.row.displayName}` : "Register a model"}
        description="Provider, model name and version identify the model and cannot be changed later."
        busy={save.mutation.isPending}
        error={save.error}
        submitLabel={editing?.row ? "Save model" : "Register model"}
        onClose={() => setEditing(null)}
        onSubmit={() => {
          if (
            !editing?.row &&
            (!values.provider.trim() || !values.modelName.trim() || !values.modelVersion.trim())
          )
            return save.setError("Enter the provider, model name and version.");
          if (!values.displayName.trim()) return save.setError("Enter a display name.");
          if (!values.capabilities.length) return save.setError("Choose at least one capability.");
          save.mutation.mutate(undefined);
        }}
      >
        <div className="fac-row">
          <label>
            Provider
            <input
              value={values.provider}
              disabled={!!editing?.row}
              placeholder="anthropic"
              onChange={(event) => set("provider", event.target.value)}
            />
          </label>
          <label>
            Model name
            <input
              value={values.modelName}
              disabled={!!editing?.row}
              onChange={(event) => set("modelName", event.target.value)}
            />
          </label>
          <label>
            Version
            <input
              value={values.modelVersion}
              disabled={!!editing?.row}
              onChange={(event) => set("modelVersion", event.target.value)}
            />
          </label>
        </div>
        <label>
          Display name
          <input
            value={values.displayName}
            onChange={(event) => set("displayName", event.target.value)}
          />
        </label>
        <fieldset className="grid gap-1">
          <legend className="text-sm font-bold">Capabilities</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {(Object.keys(capabilityLabels) as AiCapability[]).map((item) => (
              <label key={item} className="flex items-center gap-1 font-normal">
                <input
                  type="checkbox"
                  checked={values.capabilities.includes(item)}
                  onChange={(event) =>
                    set(
                      "capabilities",
                      event.target.checked
                        ? [...values.capabilities, item]
                        : values.capabilities.filter((cap) => cap !== item),
                    )
                  }
                />
                {capabilityLabels[item]}
              </label>
            ))}
          </div>
        </fieldset>
        <LanguagesPicker
          value={values.supportedLanguages}
          onChange={(value) => set("supportedLanguages", value)}
        />
        <div className="fac-row">
          <label>
            Context window (tokens, optional)
            <input
              type="number"
              min={1}
              value={values.contextWindowTokens}
              onChange={(event) => set("contextWindowTokens", event.target.value)}
            />
          </label>
          <label>
            Max output (tokens, optional)
            <input
              type="number"
              min={1}
              value={values.maxOutputTokens}
              onChange={(event) => set("maxOutputTokens", event.target.value)}
            />
          </label>
        </div>
      </FormDialog>
    </section>
  );
}

// ---------------------------------------------------------------- safety policies

type PolicyValues = {
  code: string;
  name: string;
  description: string;
  category: AiSafetyCategory;
  instructions: string;
  restrictions: string;
  triggerKeywords: string;
  requiresEscalation: boolean;
  escalationGuidance: string;
  changeNote: string;
};
const policyValues = (row: AiSafetyPolicy | null): PolicyValues => ({
  code: row?.code ?? "",
  name: row?.name ?? "",
  description: row?.description ?? "",
  category: row?.category ?? "GENERAL_SAFETY",
  instructions: row?.currentVersion?.instructions ?? "",
  restrictions: row?.currentVersion?.restrictions.join("\n") ?? "",
  triggerKeywords: row?.currentVersion?.triggerKeywords.join("\n") ?? "",
  requiresEscalation: row?.currentVersion?.requiresEscalation ?? false,
  escalationGuidance: row?.currentVersion?.escalationGuidance ?? "",
  changeNote: "",
});

export function SafetyPanel() {
  const canManage = useCan("ai-safety:manage");
  const [status, setStatus] = useState<AiRecordStatus | "all">("all");
  const [page, setPage] = useState(1);
  const list = useQuery({
    ...aiSafetyQueryOptions({ page, ...(status !== "all" ? { status } : {}) }, true),
    placeholderData: keepPreviousData,
  });
  const lifecycle = useLifecycle("admin/ai/safety-policies");
  const [editing, setEditing] = useState<{ row: AiSafetyPolicy | null } | null>(null);
  const [values, setValues] = useState<PolicyValues>(policyValues(null));
  useEffect(() => {
    if (editing) setValues(policyValues(editing.row));
  }, [editing]);
  const save = useSave(
    () => {
      const body = {
        name: values.name.trim(),
        ...(optional(values.description) ? { description: values.description.trim() } : {}),
        category: values.category,
        instructions: values.instructions.trim(),
        restrictions: lines(values.restrictions),
        triggerKeywords: lines(values.triggerKeywords),
        requiresEscalation: values.requiresEscalation,
        ...(values.requiresEscalation && optional(values.escalationGuidance)
          ? { escalationGuidance: values.escalationGuidance.trim() }
          : {}),
        ...(optional(values.changeNote) ? { changeNote: values.changeNote.trim() } : {}),
      };
      return editing?.row
        ? adminApi("PATCH", `admin/ai/safety-policies/${editing.row.id}`, { body })
        : adminApi("POST", "admin/ai/safety-policies", {
            body: { ...body, code: values.code.trim() },
          });
    },
    editing?.row ? "Policy saved as a new version." : "Policy created.",
    () => setEditing(null),
  );
  const set = <K extends keyof PolicyValues>(key: K, value: PolicyValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    save.setError("");
  };
  return (
    <section>
      <div className="admin-filters">
        <StatusFilter
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        {canManage && (
          <Button onClick={() => setEditing({ row: null })}>
            <Plus aria-hidden />
            New policy
          </Button>
        )}
      </div>
      <ListState query={list} empty="No safety policies yet.">
        {(rows) => (
          <div className="staff-table">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Category</th>
                  <th>Version</th>
                  <th>Escalation</th>
                  <th>Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.name}</b>
                      <small className="block text-muted-foreground">
                        {row.code}
                        {row.description ? ` · ${row.description}` : ""}
                      </small>
                    </td>
                    <td>{safetyCategoryLabels[row.category]}</td>
                    <td>v{row.latestVersionNumber}</td>
                    <td>
                      {row.currentVersion?.requiresEscalation ? "Hand over to a person" : "No"}
                    </td>
                    <td>
                      <Pill tone={aiStatusTone(row.status)}>{aiStatusLabels[row.status]}</Pill>
                    </td>
                    <td className="col-actions">
                      <RowMenu label={row.name}>
                        {canManage && row.status !== "ARCHIVED" && (
                          <>
                            <DropdownMenuItem onSelect={() => setEditing({ row })}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {lifecycle.items(row, canManage)}
                      </RowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListState>
      <Pager page={page} setPage={setPage} meta={list.data?.meta} noun="policy(ies)" />
      {lifecycle.dialog}
      <FormDialog
        open={!!editing}
        title={editing?.row ? `Edit ${editing.row.name}` : "New safety policy"}
        description="Safety policies limit what the assistant may say, for example about pesticide doses."
        busy={save.mutation.isPending}
        error={save.error}
        submitLabel={editing?.row ? "Save policy" : "Create policy"}
        onClose={() => setEditing(null)}
        onSubmit={() => {
          if (!editing?.row && !AI_CODE_PATTERN.test(values.code.trim()))
            return save.setError(
              "Code: upper-case letters, digits and underscores, starting with a letter.",
            );
          if (!values.name.trim()) return save.setError("Enter a name.");
          if (!values.instructions.trim()) return save.setError("Write the instructions.");
          save.mutation.mutate(undefined);
        }}
      >
        <div className="fac-row">
          <label>
            Code
            <input
              value={values.code}
              disabled={!!editing?.row}
              placeholder="CHEMICAL_DOSES"
              onChange={(event) => set("code", event.target.value.toUpperCase())}
            />
          </label>
          <label>
            Name
            <input value={values.name} onChange={(event) => set("name", event.target.value)} />
          </label>
        </div>
        <label>
          Category
          <select
            value={values.category}
            onChange={(event) => set("category", event.target.value as AiSafetyCategory)}
          >
            {(Object.keys(safetyCategoryLabels) as AiSafetyCategory[]).map((item) => (
              <option key={item} value={item}>
                {safetyCategoryLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Description (optional)
          <input
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </label>
        <label>
          Instructions
          <textarea
            rows={5}
            value={values.instructions}
            onChange={(event) => set("instructions", event.target.value)}
          />
        </label>
        <label>
          Restrictions (one per line)
          <textarea
            rows={3}
            value={values.restrictions}
            onChange={(event) => set("restrictions", event.target.value)}
          />
        </label>
        <label>
          Trigger keywords (one per line)
          <textarea
            rows={2}
            value={values.triggerKeywords}
            onChange={(event) => set("triggerKeywords", event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.requiresEscalation}
            onChange={(event) => set("requiresEscalation", event.target.checked)}
          />
          Hand the question over to a person
        </label>
        {values.requiresEscalation && (
          <label>
            Escalation guidance
            <textarea
              rows={2}
              value={values.escalationGuidance}
              onChange={(event) => set("escalationGuidance", event.target.value)}
            />
          </label>
        )}
        {editing?.row && (
          <label>
            Change note (optional)
            <input
              value={values.changeNote}
              onChange={(event) => set("changeNote", event.target.value)}
            />
          </label>
        )}
      </FormDialog>
    </section>
  );
}

// ---------------------------------------------------------------- usage & requests

export function UsagePanel() {
  const [days, setDays] = useState(30);
  const from = (() => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (days - 1));
    return date.toISOString();
  })();
  const summary = useQuery(aiUsageSummaryQueryOptions(from, true));
  const assistants = useQuery(aiAllAssistantsQueryOptions(true));
  const [status, setStatus] = useState<AiRequestStatus | "all">("all");
  const [page, setPage] = useState(1);
  const requests = useQuery({
    ...aiRequestsQueryOptions({ page, ...(status !== "all" ? { status } : {}) }, true),
    placeholderData: keepPreviousData,
  });
  const assistantName = (id: string) =>
    assistants.data?.find((item) => item.id === id)?.name ?? id.slice(0, 8);
  const data = summary.data;
  return (
    <section className="space-y-4">
      <label className="admin-filters">
        Range
        <select
          aria-label="Usage range"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </label>
      {summary.isError ? (
        <p className="fac-empty" role="alert">
          {adminErrorMessage(summary.error, "Usage could not be loaded.")}
        </p>
      ) : !data ? (
        <p className="fac-empty">Loading usage…</p>
      ) : (
        <>
          <div className="admin-stats">
            <Stat label="AI requests" value={formatNumber(data.records)} />
            <Stat label="With provider figures" value={formatNumber(data.recorded)} />
            <Stat
              label="Without figures"
              value={formatNumber(data.notAvailable)}
              hint="The provider did not report usage"
            />
            <Stat label="Input tokens" value={formatNumber(data.inputTokens)} />
            <Stat label="Output tokens" value={formatNumber(data.outputTokens)} />
            <Stat
              label="Estimated cost"
              value={
                data.costs.length
                  ? data.costs.map((cost) => `${cost.amount} ${cost.currency}`).join(" · ")
                  : "—"
              }
            />
          </div>
          <div className="admin-grid-2">
            <article className="admin-panel">
              <h2 className="mb-2 font-bold">By assistant</h2>
              {data.byAssistant.length === 0 ? (
                <p className="text-sm text-muted-foreground">No usage in this range.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.byAssistant.map((row) => (
                    <li key={row.key}>
                      {assistantName(row.key)} · {row.records} request(s) ·{" "}
                      {formatNumber(row.totalTokens)} tokens
                    </li>
                  ))}
                </ul>
              )}
            </article>
            <article className="admin-panel">
              <h2 className="mb-2 font-bold">By provider</h2>
              {data.byProvider.length === 0 ? (
                <p className="text-sm text-muted-foreground">No usage in this range.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.byProvider.map((row) => (
                    <li key={row.key}>
                      {row.key} · {row.records} request(s) · {formatNumber(row.totalTokens)} tokens
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </>
      )}
      <article>
        <div className="admin-filters">
          <h2 className="font-bold">Recent requests</h2>
          <select
            aria-label="Request status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AiRequestStatus | "all");
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            {(Object.keys(requestStatusLabels) as AiRequestStatus[]).map((item) => (
              <option key={item} value={item}>
                {requestStatusLabels[item]}
              </option>
            ))}
          </select>
        </div>
        <ListState query={requests} empty="No AI requests yet.">
          {(rows) => (
            <div className="staff-table">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Assistant</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Tokens</th>
                    <th>Sources cited</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{assistantName(row.assistantId)}</td>
                      <td>
                        <Pill
                          tone={
                            row.status === "COMPLETED"
                              ? "ok"
                              : row.status === "FAILED"
                                ? "bad"
                                : row.status === "CANCELLED"
                                  ? "muted"
                                  : "warn"
                          }
                        >
                          {requestStatusLabels[row.status]}
                        </Pill>
                      </td>
                      <td>
                        {row.durationMs != null ? `${(row.durationMs / 1000).toFixed(1)} s` : "—"}
                      </td>
                      <td>{formatNumber(row.usage?.totalTokens)}</td>
                      <td>{row.references.length}</td>
                      <td>{row.errorMessage ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ListState>
        <Pager page={page} setPage={setPage} meta={requests.data?.meta} noun="request(s)" />
      </article>
    </section>
  );
}
