import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDate, formatDateTime, Pill } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cropLabel, cropsQueryOptions } from "@/lib/admin/backend-groups";
import {
  formatBytes,
  knowledgeHistoryQueryOptions,
  knowledgeProcessingQueryOptions,
  knowledgeSourceQueryOptions,
  knowledgeStatusLabels,
  knowledgeStatusTone,
  knowledgeTopicsQueryOptions,
  sourceTypeLabels,
  type KnowledgeSource,
  type KnowledgeSourceTypeCode,
} from "@/lib/admin/backend-knowledge";
import { adminErrorMessage } from "@/lib/admin/api";
import { KNOWLEDGE_MAX_UPLOAD_BYTES } from "@/lib/auth/knowledge-upload-server-fns";

export interface KnowledgeMetadata {
  title: string;
  description: string;
  sourceType: KnowledgeSourceTypeCode;
  language: "rw" | "en";
  sourceOrganization: string;
  author: string;
  publicationDate: string;
  cropIds: string[];
  topicIds: string[];
  includeInTraining: boolean;
}

export const emptyKnowledgeMetadata = (): KnowledgeMetadata => ({
  title: "",
  description: "",
  sourceType: "PDF",
  language: "rw",
  sourceOrganization: "",
  author: "",
  publicationDate: "",
  cropIds: [],
  topicIds: [],
  includeInTraining: true,
});

export const metadataFrom = (source: KnowledgeSource): KnowledgeMetadata => ({
  title: source.title,
  description: source.description ?? "",
  sourceType: source.sourceType,
  language: source.language,
  sourceOrganization: source.sourceOrganization ?? "",
  author: source.author ?? "",
  publicationDate: source.publicationDate ?? "",
  cropIds: source.crops.map((crop) => crop.id),
  topicIds: source.topics.map((topic) => topic.id),
  includeInTraining: source.includeInTraining,
});

const FILE_TYPES: KnowledgeSourceTypeCode[] = ["PDF", "DOCX", "TXT", "HTML"];
const ACCEPT = ".pdf,.docx,.txt,.html,.htm";

function TagPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="grid gap-1">
      <legend className="text-sm font-bold">{label}</legend>
      {options.length === 0 ? (
        <span className="text-sm text-muted-foreground">None available.</span>
      ) : (
        <div className="flex flex-wrap gap-3 text-sm">
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-1 font-normal">
              <input
                type="checkbox"
                checked={value.includes(option.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, option.id]
                      : value.filter((id) => id !== option.id),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/**
 * Add a document (upload a file, or an https link for web articles) or edit its details.
 * `mode: "edit"` only changes metadata (PATCH); new files go through "version".
 */
export function KnowledgeFormDialog({
  open,
  mode,
  initial,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit" | "version";
  initial: KnowledgeMetadata;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: {
    metadata: KnowledgeMetadata;
    file: File | null;
    url: string;
    changeNote: string;
  }) => void;
}) {
  const crops = useQuery(cropsQueryOptions(open));
  const topics = useQuery(knowledgeTopicsQueryOptions(open));
  const [values, setValues] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [local, setLocal] = useState("");
  useEffect(() => {
    if (!open) return;
    setValues(initial);
    setFile(null);
    setUrl("");
    setChangeNote("");
    setLocal("");
  }, [open, initial]);

  const set = <K extends keyof KnowledgeMetadata>(key: K, value: KnowledgeMetadata[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setLocal("");
  };
  const usesFile = FILE_TYPES.includes(values.sourceType);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mode !== "version" && !values.title.trim()) return setLocal("Enter a title.");
    if (mode !== "edit") {
      if (usesFile && !file) return setLocal("Choose the file to upload.");
      if (!usesFile && !/^https:\/\//i.test(url.trim()))
        return setLocal("Enter an https link to the article.");
      if (file && file.size > KNOWLEDGE_MAX_UPLOAD_BYTES)
        return setLocal("The file is larger than 20 MB.");
    }
    if (values.publicationDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.publicationDate)) {
      return setLocal("Use a full date for the publication date.");
    }
    onSubmit({
      metadata: values,
      file: usesFile ? file : null,
      url: usesFile ? "" : url.trim(),
      changeNote: changeNote.trim(),
    });
  }

  const title =
    mode === "create"
      ? "Add a document"
      : mode === "edit"
        ? `Edit ${initial.title}`
        : `Upload a new version of ${initial.title}`;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "version"
              ? "The new version is processed and reviewed before the assistant uses it. The approved version stays in use until then."
              : "Documents are processed, then reviewed. Only approved documents are used by the farmer assistant."}
          </DialogDescription>
        </DialogHeader>
        <form className="admin-form" noValidate onSubmit={submit}>
          {mode !== "version" && (
            <>
              <label>
                Title
                <input
                  value={values.title}
                  maxLength={300}
                  onChange={(event) => set("title", event.target.value)}
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
              <div className="fac-row">
                {mode === "create" && (
                  <label>
                    Document type
                    <select
                      value={values.sourceType}
                      onChange={(event) =>
                        set("sourceType", event.target.value as KnowledgeSourceTypeCode)
                      }
                    >
                      {(Object.keys(sourceTypeLabels) as KnowledgeSourceTypeCode[]).map((item) => (
                        <option key={item} value={item}>
                          {sourceTypeLabels[item]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Language
                  <select
                    value={values.language}
                    onChange={(event) => set("language", event.target.value as "rw" | "en")}
                  >
                    <option value="rw">Kinyarwanda</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  Publication date (optional)
                  <input
                    type="date"
                    value={values.publicationDate}
                    onChange={(event) => set("publicationDate", event.target.value)}
                  />
                </label>
              </div>
              <div className="fac-row">
                <label>
                  Source organisation (optional)
                  <input
                    value={values.sourceOrganization}
                    placeholder="e.g. Rwanda Agriculture Board"
                    onChange={(event) => set("sourceOrganization", event.target.value)}
                  />
                </label>
                <label>
                  Author (optional)
                  <input
                    value={values.author}
                    onChange={(event) => set("author", event.target.value)}
                  />
                </label>
              </div>
              <TagPicker
                label="Crops"
                options={(crops.data ?? []).map((crop) => ({
                  id: crop.id,
                  label: cropLabel(crop),
                }))}
                value={values.cropIds}
                onChange={(next) => set("cropIds", next)}
              />
              <TagPicker
                label="Topics"
                options={(topics.data ?? []).map((topic) => ({
                  id: topic.id,
                  label: topic.nameEn,
                }))}
                value={values.topicIds}
                onChange={(next) => set("topicIds", next)}
              />
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={values.includeInTraining}
                  onChange={(event) => set("includeInTraining", event.target.checked)}
                />
                <span>
                  Use to retrain the AI models
                  <small className="block text-muted-foreground">
                    Once approved, the document is used right away as up-to-date information for
                    answers and course generation, and is added to the corpus for the next model
                    retraining.
                  </small>
                </span>
              </label>
            </>
          )}
          {mode !== "edit" &&
            (usesFile ? (
              <label>
                File ({FILE_TYPES.join(", ")}, up to 20 MB)
                <input
                  type="file"
                  accept={ACCEPT}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setLocal("");
                  }}
                />
              </label>
            ) : (
              <label>
                Link (https)
                <input
                  value={url}
                  placeholder="https://…"
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setLocal("");
                  }}
                />
              </label>
            ))}
          {mode !== "edit" && (
            <label>
              Change note (optional)
              <input
                value={changeNote}
                maxLength={1000}
                onChange={(event) => setChangeNote(event.target.value)}
              />
            </label>
          )}
          {(local || error) && (
            <p className="fac-field-error" role="alert">
              {local || error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" aria-hidden />}
              {mode === "create"
                ? "Add document"
                : mode === "edit"
                  ? "Save details"
                  : "Upload version"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Details, processing status and history of one source. */
export function KnowledgeDetailsDialog({
  sourceId,
  onClose,
}: {
  sourceId: string | null;
  onClose: () => void;
}) {
  const enabled = !!sourceId;
  const detail = useQuery(knowledgeSourceQueryOptions(sourceId ?? "", enabled));
  const processing = useQuery({
    ...knowledgeProcessingQueryOptions(sourceId ?? "", enabled),
    refetchInterval: (query) => (query.state.data?.sourceStatus === "PROCESSING" ? 3000 : false),
  });
  const history = useQuery(knowledgeHistoryQueryOptions(sourceId ?? "", enabled));
  const source = detail.data;

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{source?.title ?? "Document"}</DialogTitle>
          <DialogDescription>{source?.description ?? "Knowledge Base document"}</DialogDescription>
        </DialogHeader>
        {detail.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {adminErrorMessage(detail.error, "The document could not be loaded.")}
          </p>
        ) : !source ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="fac-facts">
              <div>
                <dt>Status</dt>
                <dd>
                  <Pill tone={knowledgeStatusTone(source.status)}>
                    {knowledgeStatusLabels[source.status]}
                  </Pill>
                  {source.approvedVersionId && (
                    <> · {source.isActive ? "used by the assistant" : "not in use (deactivated)"}</>
                  )}
                </dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{sourceTypeLabels[source.sourceType]}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{source.language === "en" ? "English" : "Kinyarwanda"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>
                  {[source.sourceOrganization, source.author].filter(Boolean).join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt>Published</dt>
                <dd>{source.publicationDate ?? "—"}</dd>
              </div>
              <div>
                <dt>Crops</dt>
                <dd>{source.crops.map((crop) => crop.nameEn).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Topics</dt>
                <dd>{source.topics.map((topic) => topic.nameEn).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Approved</dt>
                <dd>{source.approvedAt ? formatDate(source.approvedAt) : "Not yet"}</dd>
              </div>
            </dl>
            {processing.data && (
              <section>
                <h3 className="font-bold">Latest processing</h3>
                <p>
                  Version {processing.data.version.versionNumber}:{" "}
                  {knowledgeStatusLabels[processing.data.version.status]} ·{" "}
                  {processing.data.chunkCount} chunk(s)
                  {processing.data.document?.detectedLanguage
                    ? ` · detected language ${processing.data.document.detectedLanguage}`
                    : ""}
                </p>
                {processing.data.version.processingError && (
                  <p className="text-destructive">{processing.data.version.processingError}</p>
                )}
                {Object.keys(processing.data.embeddings ?? {}).length > 0 && (
                  <p className="text-muted-foreground">
                    Embeddings:{" "}
                    {Object.entries(processing.data.embeddings)
                      .map(([key, value]) => `${key} ${value}`)
                      .join(" · ")}
                  </p>
                )}
              </section>
            )}
            <section>
              <h3 className="font-bold">Versions</h3>
              <ul className="space-y-1">
                {(history.data?.versions ?? source.versions ?? []).map((version) => (
                  <li key={version.id}>
                    v{version.versionNumber} · {version.originalFilename ?? version.storageRef} ·{" "}
                    {formatBytes(version.fileSizeBytes)} · {knowledgeStatusLabels[version.status]} ·{" "}
                    {formatDate(version.createdAt)}
                    {version.reviewReason ? ` · review note: ${version.reviewReason}` : ""}
                  </li>
                ))}
              </ul>
            </section>
            {history.data && history.data.processing.length > 0 && (
              <section>
                <h3 className="font-bold">Activity</h3>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {history.data.processing.slice(0, 20).map((entry) => (
                    <li key={entry.id}>
                      {formatDateTime(entry.createdAt)} · {entry.message}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
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

/** Reject a version waiting for review; the reason is stored with the review. */
export function KnowledgeRejectDialog({
  source,
  busy,
  onClose,
  onReject,
}: {
  source: KnowledgeSource | null;
  busy: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setReason("");
    setError("");
  }, [source]);
  return (
    <Dialog open={!!source} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {source?.title}</DialogTitle>
          <DialogDescription>
            The document is not used by the assistant. Explain what must change.
          </DialogDescription>
        </DialogHeader>
        <label className="admin-form">
          Reason
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError("");
            }}
          />
          {error && <span className="fac-field-error">{error}</span>}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (reason.trim().length < 5)
                return setError("Give a reason of at least 5 characters.");
              onReject(reason.trim());
            }}
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
