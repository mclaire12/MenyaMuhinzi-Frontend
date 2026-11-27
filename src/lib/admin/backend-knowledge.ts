import { queryOptions } from "@tanstack/react-query";
import { adminGet, type Paginated } from "@/lib/admin/api";

/** Knowledge Base sources from the backend (/knowledge/sources, /knowledge/topics). */

export type KnowledgeSourceTypeCode = "PDF" | "DOCX" | "TXT" | "HTML" | "WEB_ARTICLE" | "OTHER";
export type KnowledgeStatusCode =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED";

export interface KnowledgeTag {
  id: string;
  code: string;
  nameEn: string;
  nameRw: string | null;
}

export interface KnowledgeVersion {
  id: string;
  versionNumber: number;
  storageKind: string;
  originalFilename: string | null;
  storageRef: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
  status: KnowledgeStatusCode;
  processingError: string | null;
  changeNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  description: string | null;
  sourceType: KnowledgeSourceTypeCode;
  language: "rw" | "en";
  sourceOrganization: string | null;
  author: string | null;
  publicationDate: string | null;
  status: KnowledgeStatusCode;
  isActive: boolean;
  /** Part of the corpus used to retrain the AI models once approved. */
  includeInTraining: boolean;
  latestVersionNumber: number;
  approvedVersionId: string | null;
  approvedAt: string | null;
  archivedAt: string | null;
  crops: KnowledgeTag[];
  topics: KnowledgeTag[];
  latestVersion?: KnowledgeVersion | null;
  versions?: KnowledgeVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeProcessingStatus {
  sourceId: string;
  sourceStatus: KnowledgeStatusCode;
  version: KnowledgeVersion;
  jobs: { id: string; stage: string; status: string; [key: string]: unknown }[];
  document: { detectedLanguage: string | null; [key: string]: unknown } | null;
  chunkCount: number;
  embeddings: Record<string, number>;
}

export interface KnowledgeHistory {
  versions: KnowledgeVersion[];
  approvals: {
    id: string;
    versionId: string | null;
    action: string;
    reason: string | null;
    createdAt: string;
  }[];
  processing: {
    id: string;
    stage: string | null;
    event: string;
    message: string;
    createdAt: string;
  }[];
  audit: { id: string; action: string; createdAt: string }[];
}

export const sourceTypeLabels: Record<KnowledgeSourceTypeCode, string> = {
  PDF: "PDF",
  DOCX: "Word (DOCX)",
  TXT: "Text",
  HTML: "HTML",
  WEB_ARTICLE: "Web article",
  OTHER: "Other",
};

export const knowledgeStatusLabels: Record<KnowledgeStatusCode, string> = {
  DRAFT: "Uploaded",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  PENDING_REVIEW: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FAILED: "Processing failed",
  ARCHIVED: "Archived",
};

export const knowledgeStatusTone = (status: KnowledgeStatusCode) =>
  status === "APPROVED"
    ? "ok"
    : status === "PENDING_REVIEW" || status === "PROCESSING"
      ? "warn"
      : status === "REJECTED" || status === "FAILED"
        ? "bad"
        : status === "PROCESSED"
          ? "info"
          : "muted";

/** What the administrator can do next, following the backend workflow. */
export function knowledgeNextActions(source: KnowledgeSource) {
  const status = source.status;
  return {
    process: status === "DRAFT" || status === "FAILED" || status === "REJECTED",
    submitReview: status === "PROCESSED",
    approve: status === "PENDING_REVIEW",
    reject: status === "PENDING_REVIEW",
    activate: !!source.approvedVersionId && !source.isActive && !source.archivedAt,
    deactivate: !!source.approvedVersionId && source.isActive && !source.archivedAt,
    archive: !source.archivedAt && status !== "PROCESSING",
    newVersion: !source.archivedAt && status !== "PROCESSING",
    edit: !source.archivedAt,
    remove: !source.approvedVersionId && status !== "PROCESSING",
  };
}

export const formatBytes = (bytes: number | null | undefined) =>
  bytes == null
    ? "—"
    : bytes >= 1_048_576
      ? `${(bytes / 1_048_576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const adminKnowledgeKey = ["admin-knowledge"] as const;

export type KnowledgeListQuery = {
  page: number;
  q?: string;
  status?: KnowledgeStatusCode;
  sourceType?: KnowledgeSourceTypeCode;
  language?: "rw" | "en";
  cropId?: string;
  topicId?: string;
};

export function knowledgeListQueryOptions(query: KnowledgeListQuery, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminKnowledgeKey, "list", query] as const,
    queryFn: () =>
      adminGet<Paginated<KnowledgeSource>>("knowledge/sources", { ...query, limit: 10 }),
    enabled,
    retry: false,
  });
}

/** One count per status, for the filter badges. */
export function knowledgeCountQueryOptions(status: KnowledgeStatusCode, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminKnowledgeKey, "count", status] as const,
    queryFn: () =>
      adminGet<Paginated<KnowledgeSource>>("knowledge/sources", { status, page: 1, limit: 1 }),
    enabled,
    retry: false,
    staleTime: 15_000,
    select: (result) => result.meta.total,
  });
}

export function knowledgeSourceQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminKnowledgeKey, "detail", id] as const,
    queryFn: () => adminGet<KnowledgeSource>(`knowledge/sources/${id}`),
    enabled,
    retry: false,
  });
}

export function knowledgeProcessingQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminKnowledgeKey, "processing", id] as const,
    queryFn: () => adminGet<KnowledgeProcessingStatus>(`knowledge/sources/${id}/processing-status`),
    enabled,
    retry: false,
  });
}

export function knowledgeHistoryQueryOptions(id: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...adminKnowledgeKey, "history", id] as const,
    queryFn: () => adminGet<KnowledgeHistory>(`knowledge/sources/${id}/history`),
    enabled,
    retry: false,
  });
}

export function knowledgeTopicsQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: ["knowledge-topics"] as const,
    queryFn: async () => {
      const result = await adminGet<KnowledgeTag[] | Paginated<KnowledgeTag>>("knowledge/topics");
      return Array.isArray(result) ? result : result.data;
    },
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
}
