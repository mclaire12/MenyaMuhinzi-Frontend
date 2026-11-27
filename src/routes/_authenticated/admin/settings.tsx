import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDateTime, PageHead, useAdminActor } from "@/components/admin/shell";
import { ConfirmButton } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import {
  platformSettingsKey,
  platformSettingsQueryOptions,
  type PlatformSettings,
} from "@/lib/admin/backend-settings";
import { resetAdmin, updateAdmin, useAdmin } from "@/lib/admin/store";
import { isRwandanMobile } from "@/lib/basic-phone/farmers";
import { resetLearningState } from "@/lib/mock/store";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: SettingsPage });

const notificationLabels: Record<keyof PlatformSettings["adminNotifications"], string> = {
  accountRequests: "New account requests",
  aiFailures: "AI requests that fail",
  coursePublished: "Courses published or unpublished",
  weeklySummary: "Weekly platform summary",
};

type Section = Partial<
  Pick<
    PlatformSettings,
    "platform" | "defaultLanguage" | "defaultPublicationScope" | "adminNotifications"
  >
>;

/** Platform settings saved in the backend (GET/PATCH /settings). */
function SettingsPage() {
  const queryClient = useQueryClient();
  const { permissions, loading } = useAuth();
  const canRead = permissions.includes("platform-settings:read");
  const canManage = permissions.includes("platform-settings:manage");
  const settings = useQuery(platformSettingsQueryOptions(canRead && !loading));
  const save = useMutation({
    mutationFn: (section: Section) =>
      adminApi<PlatformSettings>("PATCH", "settings", { body: section }),
    onSuccess: (data) => queryClient.setQueryData(platformSettingsKey, data),
  });
  const saveSection = (section: Section, done: string) =>
    save.mutateAsync(section).then(
      () => {
        toast.success(done);
        return null;
      },
      (error: unknown) => adminErrorMessage(error, "The settings could not be saved."),
    );

  const data = settings.data;
  return (
    <>
      <PageHead
        title="Settings"
        text="Platform information, defaults and notification preferences, saved on the server. Credentials and API keys are never entered here; they belong in the server's secret store."
      >
        {data?.updatedAt && (
          <span className="text-sm text-muted-foreground">
            Last changed {formatDateTime(data.updatedAt)}
            {data.updatedBy ? ` by ${data.updatedBy}` : ""}
          </span>
        )}
      </PageHead>
      <div className="grid items-start gap-3 md:grid-cols-2">
        <AccountSecurity />
        {loading ? (
          <p className="fac-empty">Loading settings…</p>
        ) : !canRead ? (
          <p className="fac-empty">You do not have permission to view platform settings.</p>
        ) : settings.isError ? (
          <div className="fac-empty" role="alert">
            <p>
              {adminErrorMessage(settings.error, "Settings could not be loaded from the server.")}
            </p>
            <Button className="mt-3" variant="outline" onClick={() => void settings.refetch()}>
              Try again
            </Button>
          </div>
        ) : !data ? (
          <p className="fac-empty">Loading settings…</p>
        ) : (
          <>
            <General
              settings={data}
              canManage={canManage}
              busy={save.isPending}
              onSave={saveSection}
            />
            <Defaults
              settings={data}
              canManage={canManage}
              busy={save.isPending}
              onSave={saveSection}
            />
            <Notifications
              settings={data}
              canManage={canManage}
              busy={save.isPending}
              onSave={saveSection}
            />
          </>
        )}
        <FacilitatorDemoPermissions />
        <DemoData />
      </div>
    </>
  );
}

type SectionProps = {
  settings: PlatformSettings;
  canManage: boolean;
  busy: boolean;
  onSave: (section: Section, done: string) => Promise<string | null>;
};

function AccountSecurity() {
  return (
    <section className="admin-panel space-y-3">
      <h2 className="text-lg">Your account</h2>
      <p className="text-sm text-muted-foreground">
        Platform settings below do not change your personal sign-in password.
      </p>
      <Button asChild variant="outline">
        <Link to="/account/password">Change password</Link>
      </Button>
    </section>
  );
}

function General({ settings, canManage, busy, onSave }: SectionProps) {
  const [values, setValues] = useState(settings.platform);
  const [error, setError] = useState("");
  useEffect(() => setValues(settings.platform), [settings.platform]);
  const set = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
  };
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (values.name.trim().length < 3)
      return setError("Enter the platform name (at least 3 characters).");
    if (
      values.supportEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.supportEmail.trim())
    )
      return setError("Enter a valid support email.");
    if (values.supportPhone.trim() && !isRwandanMobile(values.supportPhone))
      return setError("Enter a Rwandan mobile number, for example 0788000000.");
    const failure = await onSave(
      {
        platform: {
          name: values.name.trim(),
          tagline: values.tagline.trim(),
          supportEmail: values.supportEmail.trim(),
          supportPhone: values.supportPhone.replace(/\s+/g, ""),
        },
      },
      "Platform information saved.",
    );
    if (failure) setError(failure);
  }
  return (
    <form className="admin-panel admin-form" noValidate onSubmit={save}>
      <h2 className="font-bold">Platform information</h2>
      <fieldset disabled={!canManage || busy} className="contents">
        <label>
          Platform name
          <input
            value={values.name}
            maxLength={100}
            onChange={(event) => set("name", event.target.value)}
          />
        </label>
        <label>
          Tagline
          <input
            value={values.tagline}
            maxLength={200}
            onChange={(event) => set("tagline", event.target.value)}
          />
        </label>
        <div className="fac-row">
          <label>
            Support email
            <input
              type="email"
              value={values.supportEmail}
              onChange={(event) => set("supportEmail", event.target.value)}
            />
          </label>
          <label>
            Support phone
            <input
              value={values.supportPhone}
              placeholder="07XXXXXXXX"
              onChange={(event) => set("supportPhone", event.target.value)}
            />
          </label>
        </div>
      </fieldset>
      {error && (
        <p className="fac-field-error" role="alert">
          {error}
        </p>
      )}
      {canManage && (
        <div className="admin-actions">
          <Button type="submit" disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" aria-hidden />}
            Save
          </Button>
        </div>
      )}
    </form>
  );
}

function Defaults({ settings, canManage, busy, onSave }: SectionProps) {
  async function change(section: Section, done: string) {
    const failure = await onSave(section, done);
    if (failure) toast.error(failure);
  }
  return (
    <article className="admin-panel admin-form">
      <h2 className="font-bold">Defaults</h2>
      <fieldset className="space-y-2" disabled={!canManage || busy}>
        <legend className="mb-1 text-sm font-bold">
          Default language for new content and accounts
        </legend>
        <p className="text-sm text-muted-foreground">Farmer copy is Kinyarwanda first.</p>
        {(["rw", "en"] as const).map((code) => (
          <label key={code} className="flex items-center gap-2">
            <input
              type="radio"
              name="default-language"
              checked={settings.defaultLanguage === code}
              onChange={() =>
                void change(
                  { defaultLanguage: code },
                  `${code === "rw" ? "Kinyarwanda" : "English"} is now the default language.`,
                )
              }
            />
            {code === "rw" ? "Kinyarwanda" : "English"}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2" disabled={!canManage || busy}>
        <legend className="mb-1 text-sm font-bold">
          Default audience when publishing a course
        </legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="scope"
            checked={settings.defaultPublicationScope === "PLATFORM"}
            onChange={() =>
              void change({ defaultPublicationScope: "PLATFORM" }, "Default audience saved.")
            }
          />
          Entire platform
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="scope"
            checked={settings.defaultPublicationScope === "TARGETED"}
            onChange={() =>
              void change({ defaultPublicationScope: "TARGETED" }, "Default audience saved.")
            }
          />
          Selected groups
        </label>
      </fieldset>
      <p className="text-sm text-muted-foreground">
        Administrators can always review, publish and unpublish any course.
      </p>
    </article>
  );
}

function Notifications({ settings, canManage, busy, onSave }: SectionProps) {
  const current = settings.adminNotifications;
  async function toggle(key: keyof typeof current, value: boolean) {
    const failure = await onSave(
      { adminNotifications: { ...current, [key]: value } },
      "Notification preference saved.",
    );
    if (failure) toast.error(failure);
  }
  return (
    <article className="admin-panel admin-form">
      <h2 className="font-bold">Administrator notifications</h2>
      <p className="text-sm text-muted-foreground">
        Preferences are saved on the server. Email and SMS alerts for administrators are not
        switched on yet.
      </p>
      <fieldset disabled={!canManage || busy} className="space-y-2">
        {(Object.keys(notificationLabels) as (keyof typeof current)[]).map((key) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={current[key]}
              onChange={(event) => void toggle(key, event.target.checked)}
            />
            {notificationLabels[key]}
          </label>
        ))}
      </fieldset>
    </article>
  );
}

/** The Facilitator Portal still runs on demo data; these switches only affect that demo. */
function FacilitatorDemoPermissions() {
  const data = useAdmin();
  const { name } = useAdminActor();
  const facilitator = data.permissions.FACILITATOR;
  function permit(action: "approve" | "publish", on: boolean) {
    updateAdmin(
      name,
      "permission",
      "FACILITATOR",
      `${action}: ${on ? "allowed" : "not allowed"}`,
      (state) => ({
        ...state,
        permissions: {
          ...state.permissions,
          FACILITATOR: { ...state.permissions.FACILITATOR, [action]: on },
        },
      }),
    );
    toast.success("Saved for the Facilitator Portal demo.");
  }
  return (
    <article className="admin-panel admin-form">
      <h2 className="font-bold">Facilitator Portal (demo)</h2>
      <p className="text-sm text-muted-foreground">
        The Facilitator Portal is not connected to the server yet. These switches only change its
        demo data in this browser. On the server, only administrators publish courses.
      </p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!facilitator.approve}
          onChange={(event) => permit("approve", event.target.checked)}
        />
        Facilitators may approve courses as agricultural experts
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!facilitator.publish}
          onChange={(event) => permit("publish", event.target.checked)}
        />
        Facilitators may publish approved courses to the entire platform
      </label>
    </article>
  );
}

function DemoData() {
  return (
    <article className="admin-panel">
      <h2 className="mb-2 font-bold">Demo data</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Portals that are not connected to the server yet (facilitator and farmer learning screens)
        keep demo data in this browser. Restoring it does not touch any server data.
      </p>
      <ConfirmButton
        size="default"
        variant="destructive"
        label="Restore demo data"
        title="Restore the demo data?"
        text="Demo changes made in this browser are lost. Server data is not affected. You stay signed in."
        onConfirm={() => {
          resetAdmin();
          resetLearningState();
          toast.success("Demo data restored.");
        }}
      />
    </article>
  );
}
