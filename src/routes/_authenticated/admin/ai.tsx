import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AssistantsPanel,
  ModelsPanel,
  PromptsPanel,
  SafetyPanel,
  UsagePanel,
} from "@/components/admin/ai-panels";
import { PageHead, Tabs } from "@/components/admin/shell";
import { useAuth } from "@/hooks/use-auth";
import type { Permission } from "@/lib/api/types";

type Tab = "assistants" | "prompts" | "models" | "safety" | "usage";
const TABS: { value: Tab; label: string; permission: Permission }[] = [
  { value: "assistants", label: "Assistants", permission: "ai-assistants:read" },
  { value: "prompts", label: "Prompts", permission: "ai-prompts:read" },
  { value: "models", label: "Model registry", permission: "ai-models:read" },
  { value: "safety", label: "Safety policies", permission: "ai-safety:read" },
  { value: "usage", label: "Usage & requests", permission: "ai-usage:read" },
];

export const Route = createFileRoute("/_authenticated/admin/ai")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    TABS.some((item) => item.value === search["tab"]) ? { tab: search["tab"] as Tab } : {},
  component: AiPage,
});

/** AI configuration read and saved through /admin/ai/*. */
function AiPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/ai" });
  const { permissions, loading } = useAuth();
  const visible = TABS.filter((item) => permissions.includes(item.permission));
  const tab = visible.find((item) => item.value === search.tab)?.value ?? visible[0]?.value;
  const head = (
    <PageHead
      title="AI Management"
      text="Assistants, prompts, models and safety rules used by the farmer assistant, with usage read from the platform."
    />
  );
  if (loading)
    return (
      <>
        {head}
        <p className="fac-empty">Loading…</p>
      </>
    );
  if (!tab)
    return (
      <>
        {head}
        <p className="fac-empty">You do not have permission to manage AI.</p>
      </>
    );
  return (
    <>
      {head}
      <Tabs
        value={tab}
        onChange={(value) => void navigate({ search: { tab: value } })}
        options={visible.map(({ value, label }) => ({ value, label }))}
      />
      {tab === "assistants" && <AssistantsPanel />}
      {tab === "prompts" && <PromptsPanel />}
      {tab === "models" && <ModelsPanel />}
      {tab === "safety" && <SafetyPanel />}
      {tab === "usage" && <UsagePanel />}
    </>
  );
}
