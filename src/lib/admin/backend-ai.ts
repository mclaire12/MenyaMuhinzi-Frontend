import { queryOptions } from "@tanstack/react-query";
import { adminGet, adminGetAll, type Paginated } from "@/lib/admin/api";
import type { CropSummary } from "@/lib/admin/backend-groups";

/** AI configuration from the backend (/admin/ai/*). */

export type AiRecordStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type AiCapability =
  "TEXT_GENERATION" | "EMBEDDINGS" | "CLASSIFICATION" | "TRANSLATION" | "SUMMARIZATION";
export type AiPromptCategory =
  | "SYSTEM"
  | "AGRICULTURAL_ASSISTANCE"
  | "CROP_GUIDANCE"
  | "LEARNING_SUPPORT"
  | "ASSESSMENT_SUPPORT"
  | "SAFETY"
  | "GENERAL";
export type AiSafetyCategory =
  | "AGRICULTURAL_ADVICE"
  | "PEST_CONTROL"
  | "DISEASE_MANAGEMENT"
  | "CHEMICAL_USAGE"
  | "GENERAL_SAFETY"
  | "HUMAN_ESCALATION";
export type AiRequestStatus =
  "CREATED" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type Lang = "rw" | "en";

export interface AiAssistant {
  id: string;
  code: string;
  name: string;
  assistantType: string;
  purpose: string;
  description: string | null;
  supportedLanguages: Lang[];
  defaultLanguage: Lang;
  knowledgeAccess: boolean;
  requireSourceReferences: boolean;
  crops: CropSummary[];
  allowedRoles: string[];
  maxKnowledgeChunks: number;
  status: AiRecordStatus;
  currentVersion: number;
  archivedAt: string | null;
  prompts: {
    templateId: string;
    code: string;
    name: string;
    status: AiRecordStatus;
    pinnedVersionId: string | null;
    position: number;
  }[];
  activeModelConfigurationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiModel {
  id: string;
  provider: string;
  modelName: string;
  modelVersion: string;
  displayName: string;
  capabilities: AiCapability[];
  supportedLanguages: Lang[];
  contextWindowTokens: number | null;
  maxOutputTokens: number | null;
  status: AiRecordStatus;
  currentVersion: number;
  providerRegistered: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelConfiguration {
  id: string;
  assistantId: string;
  version: number;
  primaryModel: Pick<
    AiModel,
    | "id"
    | "provider"
    | "modelName"
    | "modelVersion"
    | "displayName"
    | "status"
    | "providerRegistered"
  >;
  fallbackModel: AiModelConfiguration["primaryModel"] | null;
  requiredCapabilities: AiCapability[];
  status: "ACTIVE" | "INACTIVE";
  effectiveFrom: string | null;
  deactivatedAt: string | null;
  changeNote: string | null;
  createdAt: string;
}

export interface AiPromptVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  content: string;
  variables: string[];
  changeNote: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface AiPrompt {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: AiPromptCategory;
  language: Lang;
  purpose: string | null;
  status: AiRecordStatus;
  defaultVersionId: string | null;
  latestVersionNumber: number;
  defaultVersion: AiPromptVersion | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiSafetyPolicy {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: AiSafetyCategory;
  status: AiRecordStatus;
  latestVersionNumber: number;
  currentVersion: {
    id: string;
    versionNumber: number;
    instructions: string;
    restrictions: string[];
    triggerKeywords: string[];
    requiresEscalation: boolean;
    escalationGuidance: string | null;
    createdAt: string;
  } | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiUsageSummary {
  records: number;
  recorded: number;
  notAvailable: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costs: { currency: string; amount: string }[];
  byAssistant: { key: string; records: number; totalTokens: number | null }[];
  byProvider: { key: string; records: number; totalTokens: number | null }[];
}

export interface AiRequestRow {
  id: string;
  conversationId: string;
  assistantId: string;
  userId: string;
  status: AiRequestStatus;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  durationMs: number | null;
  references: unknown[];
  usage: { totalTokens: number | null; provider: string | null } | null;
  createdAt: string;
  completedAt: string | null;
}

export const aiStatusLabels: Record<AiRecordStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};
export const aiStatusTone = (status: AiRecordStatus) =>
  status === "ACTIVE"
    ? "ok"
    : status === "DRAFT"
      ? "info"
      : status === "INACTIVE"
        ? "warn"
        : "muted";

export const capabilityLabels: Record<AiCapability, string> = {
  TEXT_GENERATION: "Text generation",
  EMBEDDINGS: "Embeddings",
  CLASSIFICATION: "Classification",
  TRANSLATION: "Translation",
  SUMMARIZATION: "Summarisation",
};

export const promptCategoryLabels: Record<AiPromptCategory, string> = {
  SYSTEM: "System",
  AGRICULTURAL_ASSISTANCE: "Agricultural assistance",
  CROP_GUIDANCE: "Crop guidance",
  LEARNING_SUPPORT: "Learning support",
  ASSESSMENT_SUPPORT: "Assessment support",
  SAFETY: "Safety",
  GENERAL: "General",
};

export const safetyCategoryLabels: Record<AiSafetyCategory, string> = {
  AGRICULTURAL_ADVICE: "Agricultural advice",
  PEST_CONTROL: "Pest control",
  DISEASE_MANAGEMENT: "Disease management",
  CHEMICAL_USAGE: "Chemical usage",
  GENERAL_SAFETY: "General safety",
  HUMAN_ESCALATION: "Human escalation",
};

export const requestStatusLabels: Record<AiRequestStatus, string> = {
  CREATED: "Created",
  QUEUED: "Queued",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const ASSISTANT_TYPES = [
  { value: "GENERAL_AGRICULTURE", label: "General agriculture" },
  { value: "CROP_SPECIFIC", label: "Crop specific" },
  { value: "FARMER_LEARNING", label: "Farmer learning" },
  { value: "FACILITATOR_SUPPORT", label: "Facilitator support" },
] as const;

export const AI_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,59}$/;

/** Lifecycle actions the backend offers for assistants, models, prompts and policies. */
export function lifecycleActions(
  status: AiRecordStatus,
): ("activate" | "deactivate" | "archive")[] {
  if (status === "ARCHIVED") return [];
  if (status === "ACTIVE") return ["deactivate", "archive"];
  return ["activate", "archive"];
}

export const aiKey = ["admin-ai"] as const;

const list = <T>(
  name: string,
  path: string,
  query: Record<string, string | number | undefined>,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: [...aiKey, name, query] as const,
    queryFn: () => adminGet<Paginated<T>>(path, { ...query, limit: 20 }),
    enabled,
    retry: false,
  });

export const aiAssistantsQueryOptions = (
  query: { page: number; status?: AiRecordStatus; q?: string },
  enabled: boolean,
) => list<AiAssistant>("assistants", "admin/ai/assistants", query, enabled);
export const aiModelsQueryOptions = (
  query: { page: number; status?: AiRecordStatus },
  enabled: boolean,
) => list<AiModel>("models", "admin/ai/models", query, enabled);
export const aiPromptsQueryOptions = (
  query: { page: number; status?: AiRecordStatus; q?: string },
  enabled: boolean,
) => list<AiPrompt>("prompts", "admin/ai/prompts", query, enabled);
export const aiSafetyQueryOptions = (
  query: { page: number; status?: AiRecordStatus },
  enabled: boolean,
) => list<AiSafetyPolicy>("safety", "admin/ai/safety-policies", query, enabled);
export const aiRequestsQueryOptions = (
  query: { page: number; status?: AiRequestStatus },
  enabled: boolean,
) => list<AiRequestRow>("requests", "admin/ai/requests", query, enabled);

export const aiAllModelsQueryOptions = (enabled: boolean) =>
  queryOptions({
    queryKey: [...aiKey, "models", "all"] as const,
    queryFn: () => adminGetAll<AiModel>("admin/ai/models"),
    enabled,
    retry: false,
  });

export const aiAllPromptsQueryOptions = (enabled: boolean) =>
  queryOptions({
    queryKey: [...aiKey, "prompts", "all"] as const,
    queryFn: () => adminGetAll<AiPrompt>("admin/ai/prompts"),
    enabled,
    retry: false,
  });

export const aiAllAssistantsQueryOptions = (enabled: boolean) =>
  queryOptions({
    queryKey: [...aiKey, "assistants", "all"] as const,
    queryFn: () => adminGetAll<AiAssistant>("admin/ai/assistants"),
    enabled,
    retry: false,
  });

export const aiModelConfigurationsQueryOptions = (assistantId: string, enabled: boolean) =>
  queryOptions({
    queryKey: [...aiKey, "configurations", assistantId] as const,
    queryFn: () =>
      adminGetAll<AiModelConfiguration>("admin/ai/model-configurations", { assistantId }),
    enabled,
    retry: false,
  });

export const aiPromptVersionsQueryOptions = (promptId: string, enabled: boolean) =>
  queryOptions({
    queryKey: [...aiKey, "prompt-versions", promptId] as const,
    queryFn: async () => {
      const result = await adminGet<AiPromptVersion[] | Paginated<AiPromptVersion>>(
        `admin/ai/prompts/${promptId}/versions`,
      );
      return Array.isArray(result) ? result : result.data;
    },
    enabled,
    retry: false,
  });

export const aiUsageSummaryQueryOptions = (from: string, enabled: boolean) =>
  queryOptions({
    queryKey: [...aiKey, "usage-summary", from] as const,
    queryFn: () => adminGet<AiUsageSummary>("admin/ai/usage/summary", { from }),
    enabled,
    retry: false,
    staleTime: 30_000,
  });

export const formatNumber = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString();
