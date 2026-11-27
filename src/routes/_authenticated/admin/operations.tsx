import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDateTime, PageHead, Pill, Tabs } from "@/components/admin/shell";
import { ConfirmButton, Stat } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage, adminGet, type Paginated } from "@/lib/admin/api";
import type { Permission } from "@/lib/api/types";

type Tab = "status" | "channels" | "notifications" | "activity";
const TABS: { value: Tab; label: string; permission: Permission }[] = [
  { value: "status", label: "Platform status", permission: "reports:read" },
  { value: "channels", label: "USSD & IVR", permission: "ussd:configuration:read" },
  { value: "notifications", label: "Notifications", permission: "notification-deliveries:read" },
  { value: "activity", label: "Activity log", permission: "reports:read" },
];

export const Route = createFileRoute("/_authenticated/admin/operations")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    TABS.some((item) => item.value === search["tab"]) ? { tab: search["tab"] as Tab } : {},
  component: Operations,
});

/** Operational status read from the backend: health, queues, telephony, notifications, audit. */
function Operations() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/operations" });
  const { permissions, loading } = useAuth();
  const visible = TABS.filter((item) => permissions.includes(item.permission));
  const tab = visible.find((item) => item.value === search.tab)?.value ?? visible[0]?.value;
  const head = (
    <PageHead
      title="System Operations"
      text="Live platform health, background work, phone channels, notification delivery and the administrative activity log."
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
        <p className="fac-empty">You do not have permission to view system operations.</p>
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
      {tab === "status" && <Status />}
      {tab === "channels" && <Channels />}
      {tab === "notifications" && <Notifications />}
      {tab === "activity" && <Activity />}
    </>
  );
}

// ---------------------------------------------------------------- status

type Health = {
  status: string;
  timestamp: string;
  checks: Record<string, { status: string; error?: string }>;
};
type SystemReport = {
  queueSnapshots: {
    note: string;
    knowledgeProcessingJobs: { key: string; count: number }[];
    aiRequestsInFlight: number;
    notificationDeliveriesInFlight: number;
  };
  failures: { aiRequests: number; notificationDeliveries: number; knowledgeProcessingJobs: number };
};

function Status() {
  const health = useQuery({
    queryKey: ["admin-ops", "health"],
    queryFn: () => adminGet<Health>("health"),
    retry: false,
    refetchInterval: 30_000,
  });
  const system = useQuery({
    queryKey: ["admin-ops", "system"],
    queryFn: () => adminGet<SystemReport>("admin/reports/system"),
    retry: false,
    refetchInterval: 30_000,
  });
  const checks = health.data?.checks ?? {};
  const services = [
    {
      name: "API",
      ok: health.isSuccess,
      note: health.isError
        ? "The backend did not answer the readiness check."
        : `Checked ${health.data ? formatDateTime(health.data.timestamp) : "…"}`,
    },
    ...Object.entries(checks).map(([name, check]) => ({
      name:
        name === "database"
          ? "Database (PostgreSQL)"
          : name === "redis"
            ? "Queue store (Redis)"
            : name,
      ok: check.status === "up" || check.status === "ok",
      note:
        check.error ??
        (check.status === "up" || check.status === "ok" ? "Connected" : check.status),
    })),
  ];
  const data = system.data;
  return (
    <section className="space-y-4">
      <div className="staff-table">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {health.isLoading ? (
              <tr>
                <td colSpan={3}>Checking…</td>
              </tr>
            ) : (
              services.map((service) => (
                <tr key={service.name}>
                  <td>
                    <b>{service.name}</b>
                  </td>
                  <td>
                    <Pill tone={service.ok ? "ok" : "bad"}>
                      {service.ok ? "Operational" : "Unavailable"}
                    </Pill>
                  </td>
                  <td>{service.note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {system.isError ? (
        <p className="fac-empty" role="alert">
          {adminErrorMessage(system.error, "Background work figures could not be loaded.")}
        </p>
      ) : !data ? (
        <p className="fac-empty">Loading background work…</p>
      ) : (
        <>
          <h2 className="text-xl">Background work</h2>
          <div className="admin-stats">
            <Stat label="AI requests in progress" value={data.queueSnapshots.aiRequestsInFlight} />
            <Stat
              label="Notifications in progress"
              value={data.queueSnapshots.notificationDeliveriesInFlight}
            />
            {data.queueSnapshots.knowledgeProcessingJobs.map((row) => (
              <Stat
                key={row.key}
                label={`Knowledge jobs: ${row.key.toLowerCase()}`}
                value={row.count}
              />
            ))}
          </div>
          <h2 className="text-xl">Failures</h2>
          <div className="admin-stats">
            <Stat label="Failed AI requests" value={data.failures.aiRequests} />
            <Stat label="Failed notifications" value={data.failures.notificationDeliveries} />
            <Stat label="Failed knowledge jobs" value={data.failures.knowledgeProcessingJobs} />
          </div>
          <p className="text-sm text-muted-foreground">{data.queueSnapshots.note}</p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- telephony

type ChannelConfig = {
  channel: string;
  isEnabled: boolean;
  serviceCode: string | null;
  accessNumber: string | null;
  sessionTtlSeconds: number;
  maxScreenChars: number;
  menuVersion: string;
  updatedAt: string;
};
type Analytics = Record<string, unknown>;
type Session = {
  id: string;
  phoneNumber: string;
  status: "ACTIVE" | "ENDED" | "EXPIRED";
  menuCode?: string;
  startedAt: string;
  lastActivityAt: string;
  endedAt: string | null;
  endReason: string | null;
  requestCount?: number;
  isTestData: boolean;
};

function Channels() {
  return (
    <section className="space-y-8">
      <p className="fac-note">
        No telecom operator is connected yet, so these channels only take test traffic. Use the{" "}
        <Link className="font-bold" to="/phone">
          basic-phone testing portal
        </Link>{" "}
        to try the menus.
      </p>
      <ChannelSection channel="ussd" title="USSD" />
      <ChannelSection channel="ivr" title="IVR (voice calls)" />
    </section>
  );
}

function ChannelSection({ channel, title }: { channel: "ussd" | "ivr"; title: string }) {
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const canManage = permissions.includes(`${channel}:configuration:manage` as Permission);
  const canTerminate = permissions.includes(`${channel}:sessions:manage` as Permission);
  const config = useQuery({
    queryKey: ["admin-ops", channel, "config"],
    queryFn: () => adminGet<ChannelConfig>(`admin/${channel}/configuration`),
    retry: false,
  });
  const analytics = useQuery({
    queryKey: ["admin-ops", channel, "analytics"],
    queryFn: () => adminGet<Analytics>(`admin/${channel}/analytics`),
    retry: false,
  });
  const [page, setPage] = useState(1);
  const sessions = useQuery({
    queryKey: ["admin-ops", channel, "sessions", page],
    queryFn: () => adminGet<Paginated<Session>>(`admin/${channel}/sessions`, { page, limit: 10 }),
    retry: false,
    placeholderData: keepPreviousData,
  });
  const [form, setForm] = useState<{
    isEnabled: boolean;
    code: string;
    ttl: number;
    chars: number;
    menuVersion: string;
  } | null>(null);
  useEffect(() => {
    if (config.data) {
      setForm({
        isEnabled: config.data.isEnabled,
        code: (channel === "ussd" ? config.data.serviceCode : config.data.accessNumber) ?? "",
        ttl: config.data.sessionTtlSeconds,
        chars: config.data.maxScreenChars,
        menuVersion: config.data.menuVersion,
      });
    }
  }, [config.data, channel]);
  const save = useMutation({
    mutationFn: () => {
      if (!form) return Promise.resolve(null);
      const code = form.code.trim();
      return adminApi("PATCH", `admin/${channel}/configuration`, {
        body: {
          isEnabled: form.isEnabled,
          sessionTtlSeconds: form.ttl,
          menuVersion: form.menuVersion.trim(),
          ...(channel === "ussd"
            ? { maxScreenChars: form.chars, ...(code ? { serviceCode: code } : {}) }
            : code
              ? { accessNumber: code }
              : {}),
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-ops", channel] });
      toast.success(`${title} settings saved.`);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The settings could not be saved.")),
  });
  const terminate = useMutation({
    mutationFn: (id: string) =>
      adminApi("POST", `admin/${channel}/sessions/${id}/terminate`, { body: {} }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-ops", channel] });
      toast.success("Session ended.");
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The session could not be ended.")),
  });

  return (
    <article className="space-y-3">
      <h2 className="text-xl">{title}</h2>
      {analytics.data && (
        <div className="admin-stats">
          {(
            [
              ["totalSessions", "Sessions"],
              ["activeSessions", "Active now"],
              ["endedSessions", "Ended"],
              ["expiredSessions", "Expired"],
              ["testSessions", "Test sessions"],
              ["audioUnavailableCallbacks", "Calls without audio"],
            ] as const
          )
            .filter(([key]) => typeof analytics.data[key] === "number")
            .map(([key, label]) => (
              <Stat key={key} label={label} value={analytics.data[key] as number} />
            ))}
        </div>
      )}
      {config.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {adminErrorMessage(config.error, "Settings could not be loaded.")}
        </p>
      ) : !form ? (
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      ) : (
        <form
          className="admin-panel admin-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!Number.isInteger(form.ttl) || form.ttl < 30) {
              toast.error("Session timeout must be at least 30 seconds.");
              return;
            }
            save.mutate();
          }}
        >
          <fieldset disabled={!canManage || save.isPending} className="contents">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
              />
              {title} enabled
            </label>
            <div className="fac-row">
              <label>
                {channel === "ussd" ? "Service code" : "Access number"}
                <input
                  value={form.code}
                  placeholder={channel === "ussd" ? "*123#" : "+2507…"}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                />
              </label>
              <label>
                Session timeout (seconds)
                <input
                  type="number"
                  min={30}
                  value={Number.isNaN(form.ttl) ? "" : form.ttl}
                  onChange={(event) => setForm({ ...form, ttl: event.target.valueAsNumber })}
                />
              </label>
              {channel === "ussd" && (
                <label>
                  Characters per screen
                  <input
                    type="number"
                    min={40}
                    max={500}
                    value={Number.isNaN(form.chars) ? "" : form.chars}
                    onChange={(event) => setForm({ ...form, chars: event.target.valueAsNumber })}
                  />
                </label>
              )}
              <label>
                Menu version
                <input
                  value={form.menuVersion}
                  onChange={(event) => setForm({ ...form, menuVersion: event.target.value })}
                />
              </label>
            </div>
          </fieldset>
          {canManage && (
            <div className="admin-actions">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
                Save {title} settings
              </Button>
            </div>
          )}
          {config.data && (
            <small className="text-muted-foreground">
              Last changed {formatDateTime(config.data.updatedAt)}
            </small>
          )}
        </form>
      )}
      {sessions.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {adminErrorMessage(sessions.error, "Sessions could not be loaded.")}
        </p>
      ) : sessions.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sessions…</p>
      ) : !sessions.data?.data.length ? (
        <p className="fac-empty">No {title} sessions yet.</p>
      ) : (
        <>
          <div className="staff-table">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Started</th>
                  <th>Last activity</th>
                  <th>Status</th>
                  <th>Requests</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.data.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.phoneNumber}
                      {row.isTestData && (
                        <small className="block text-muted-foreground">Test</small>
                      )}
                    </td>
                    <td>{formatDateTime(row.startedAt)}</td>
                    <td>{formatDateTime(row.lastActivityAt)}</td>
                    <td>
                      <Pill tone={row.status === "ACTIVE" ? "ok" : "muted"}>
                        {row.status.toLowerCase()}
                      </Pill>
                      {row.endReason && (
                        <small className="block text-muted-foreground">
                          {row.endReason.toLowerCase()}
                        </small>
                      )}
                    </td>
                    <td>{row.requestCount ?? "—"}</td>
                    <td className="col-actions">
                      {canTerminate && row.status === "ACTIVE" && (
                        <ConfirmButton
                          label="End"
                          title="End this session?"
                          text="The caller is disconnected from the menu."
                          onConfirm={() => terminate.mutate(row.id)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sessions.data.meta.totalPages > 1 && (
            <div className="admin-actions items-center">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {sessions.data.meta.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= sessions.data.meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  );
}

// ---------------------------------------------------------------- notifications

type ChannelSetting = {
  channel: string;
  isEnabled: boolean;
  isAvailable: boolean;
  providerRequired: boolean;
  providerRegistered: boolean;
  providerId: string | null;
  isTestProvider: boolean;
};
type Delivery = {
  id: string;
  channel: string;
  status: string;
  reasonCode: string | null;
  note: string;
  templateCode: string | null;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  isTestData: boolean;
};
const DELIVERY_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "SKIPPED",
] as const;

function Notifications() {
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const canReadChannels = permissions.includes("notification-settings:read");
  const canManageChannels = permissions.includes("notification-settings:manage");
  const channels = useQuery({
    queryKey: ["admin-ops", "notification-channels"],
    queryFn: () => adminGet<ChannelSetting[]>("admin/notifications/channels"),
    retry: false,
    enabled: canReadChannels,
  });
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const deliveries = useQuery({
    queryKey: ["admin-ops", "deliveries", status, page],
    queryFn: () =>
      adminGet<Paginated<Delivery>>("admin/notifications/deliveries", {
        page,
        limit: 15,
        ...(status !== "all" ? { status } : {}),
      }),
    retry: false,
    placeholderData: keepPreviousData,
  });
  const toggle = useMutation({
    mutationFn: (row: ChannelSetting) =>
      adminApi("PATCH", `admin/notifications/channels/${row.channel}`, {
        body: { isEnabled: !row.isEnabled },
      }),
    onSuccess: async (_r, row) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-ops", "notification-channels"] });
      toast.success(`${row.channel} ${row.isEnabled ? "switched off" : "switched on"}.`);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The channel could not be changed.")),
  });
  return (
    <section className="space-y-4">
      {canReadChannels && (
        <>
          <h2 className="text-xl">Channels</h2>
          {channels.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {adminErrorMessage(channels.error, "Channels could not be loaded.")}
            </p>
          ) : !channels.data ? (
            <p className="text-sm text-muted-foreground">Loading channels…</p>
          ) : (
            <div className="staff-table">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Switched on</th>
                    <th>Provider</th>
                    <th>Can deliver</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.data.map((row) => (
                    <tr key={row.channel}>
                      <td>
                        <b>{row.channel.replace("_", "-")}</b>
                      </td>
                      <td>{row.isEnabled ? "Yes" : "No"}</td>
                      <td>
                        {!row.providerRequired
                          ? "Built in"
                          : row.providerRegistered
                            ? `${row.providerId ?? "Connected"}${row.isTestProvider ? " (test)" : ""}`
                            : "Not connected"}
                      </td>
                      <td>
                        <Pill tone={row.isAvailable ? "ok" : "muted"}>
                          {row.isAvailable ? "Yes" : "No"}
                        </Pill>
                      </td>
                      <td className="col-actions">
                        {canManageChannels && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={toggle.isPending}
                            onClick={() => toggle.mutate(row)}
                          >
                            {row.isEnabled ? "Switch off" : "Switch on"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <div className="admin-filters">
        <h2 className="text-xl">Recent deliveries</h2>
        <select
          aria-label="Delivery status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          {DELIVERY_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item.toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      {deliveries.isError ? (
        <p className="fac-empty" role="alert">
          {adminErrorMessage(deliveries.error, "Deliveries could not be loaded.")}
        </p>
      ) : deliveries.isLoading ? (
        <p className="fac-empty">Loading deliveries…</p>
      ) : !deliveries.data?.data.length ? (
        <p className="fac-empty">No notification deliveries yet.</p>
      ) : (
        <>
          <div className="staff-table">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Channel</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.data.data.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>{row.channel}</td>
                    <td>{row.templateCode ?? "—"}</td>
                    <td>
                      <Pill
                        tone={
                          row.status === "DELIVERED" || row.status === "SENT"
                            ? "ok"
                            : row.status === "FAILED"
                              ? "bad"
                              : row.status === "SKIPPED"
                                ? "muted"
                                : "warn"
                        }
                      >
                        {row.status.toLowerCase()}
                      </Pill>
                    </td>
                    <td>{row.attempts}</td>
                    <td>
                      {row.reasonCode ? `${row.reasonCode} · ` : ""}
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {deliveries.data.meta.totalPages > 1 && (
            <div className="admin-actions items-center">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {deliveries.data.meta.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= deliveries.data.meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- activity

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; fullName: string } | null;
  createdAt: string;
};

function Activity() {
  const [action, setAction] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(action.trim()), 400);
    return () => clearTimeout(timer);
  }, [action]);
  const logs = useQuery({
    queryKey: ["admin-ops", "audit", debounced, page],
    queryFn: () =>
      adminGet<Paginated<AuditRow>>("admin/audit-logs", {
        page,
        limit: 20,
        ...(debounced ? { action: debounced } : {}),
      }),
    retry: false,
    placeholderData: keepPreviousData,
  });
  return (
    <section>
      <div className="admin-filters">
        <input
          aria-label="Filter by action"
          placeholder="Exact action, e.g. course.publish"
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
        />
      </div>
      {logs.isError ? (
        <p className="fac-empty" role="alert">
          {adminErrorMessage(logs.error, "The activity log could not be loaded.")}
        </p>
      ) : logs.isLoading ? (
        <p className="fac-empty">Loading activity…</p>
      ) : !logs.data?.data.length ? (
        <p className="fac-empty">
          {debounced ? "No entries for this action." : "No recorded activity yet."}
        </p>
      ) : (
        <>
          <div className="staff-table">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.data.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>{row.actor?.fullName ?? "System"}</td>
                    <td>{row.action}</td>
                    <td>
                      {row.entityType}
                      {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}
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
              Page {page} of {Math.max(1, logs.data.meta.totalPages)} · {logs.data.meta.total} entr
              {logs.data.meta.total === 1 ? "y" : "ies"}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= logs.data.meta.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
