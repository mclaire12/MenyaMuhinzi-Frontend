import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHead, useAdminActor } from "@/components/admin/shell";
import { ConfirmButton } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import { saveAiLimits, savePlatform, setDefaultLanguage, setLanguageEnabled } from "@/lib/admin/platform";
import { resetAdmin, updateAdmin, useAdmin } from "@/lib/admin/store";
import type { PlatformSettings } from "@/lib/admin/types";
import { isRwandanMobile } from "@/lib/basic-phone/farmers";
import { resetLearningState } from "@/lib/mock/store";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: SettingsPage });

const notificationLabels: Record<keyof PlatformSettings["notifications"], string> = {
  accountRequests: "New account requests",
  aiFailures: "AI requests that fail",
  coursePublished: "Courses published or unpublished",
  weeklySummary: "Weekly platform summary",
};

function SettingsPage() {
  return <>
    <PageHead title="Settings" text="Platform information, languages, publication defaults and permissions. Credentials and API keys are never entered here; they belong in the server's secret store." />
    <div className="grid items-start gap-3 md:grid-cols-2">
      <AccountSecurity />
      <General />
      <Languages />
      <Publication />
      <Notifications />
      <AiLimits />
      <DemoData />
    </div>
  </>;
}

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

function General() {
  const data = useAdmin();
  const { name } = useAdminActor();
  const [values, setValues] = useState({ name: data.platform.name, tagline: data.platform.tagline, supportEmail: data.platform.supportEmail, supportPhone: data.platform.supportPhone });
  const [error, setError] = useState("");
  const set = (key: keyof typeof values, value: string) => { setValues((current) => ({ ...current, [key]: value })); setError(""); };
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (values.name.trim().length < 3) { setError("Enter the platform name."); return; }
    if (values.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.supportEmail.trim())) { setError("Enter a valid support email."); return; }
    if (values.supportPhone && !isRwandanMobile(values.supportPhone)) { setError("Enter a Rwandan mobile number, for example 0788000000."); return; }
    savePlatform(name, { name: values.name.trim(), tagline: values.tagline.trim(), supportEmail: values.supportEmail.trim(), supportPhone: values.supportPhone.trim() });
    toast.success("Platform information saved.");
  }
  return <form className="admin-panel admin-form" noValidate onSubmit={save}>
    <h2 className="font-bold">Platform information</h2>
    <label>Platform name<input value={values.name} onChange={(event) => set("name", event.target.value)} /></label>
    <label>Tagline<input value={values.tagline} onChange={(event) => set("tagline", event.target.value)} /></label>
    <div className="fac-row"><label>Support email<input type="email" value={values.supportEmail} onChange={(event) => set("supportEmail", event.target.value)} /></label><label>Support phone<input value={values.supportPhone} onChange={(event) => set("supportPhone", event.target.value)} /></label></div>
    {error && <p className="fac-field-error" role="alert">{error}</p>}
    <div className="admin-actions"><Button type="submit">Save</Button></div>
  </form>;
}

function Languages() {
  const data = useAdmin();
  const { name } = useAdminActor();
  return <article className="admin-panel">
    <h2 className="mb-2 font-bold">Languages</h2>
    <p className="mb-3 text-sm text-muted-foreground">Farmer copy is Kinyarwanda first. Enabled languages appear in account forms and chatbot settings.</p>
    <div className="staff-table"><table className="w-full text-sm">
      <thead><tr><th>Language</th><th>Interface coverage</th><th>Enabled</th><th>Default</th></tr></thead>
      <tbody>{data.languages.map((row) => <tr key={row.code}>
        <td><b>{row.name}</b></td>
        <td>{row.coverage}%</td>
        <td><input type="checkbox" aria-label={`Enable ${row.name}`} checked={row.enabled !== false} disabled={row.code === "rw" || row.default} onChange={(event) => { const error = setLanguageEnabled(name, row.code, event.target.checked); if (error) toast.error(error); else toast.success(`${row.name} ${event.target.checked ? "enabled" : "disabled"}.`); }} /></td>
        <td><input type="radio" name="default-language" aria-label={`Make ${row.name} the default`} checked={row.default} onChange={() => { setDefaultLanguage(name, row.code); toast.success(`${row.name} is now the default language.`); }} /></td>
      </tr>)}</tbody>
    </table></div>
  </article>;
}

function Publication() {
  const data = useAdmin();
  const { name } = useAdminActor();
  const facilitator = data.permissions.FACILITATOR;
  function permit(action: "approve" | "publish", on: boolean) {
    updateAdmin(name, "permission", "FACILITATOR", `${action}: ${on ? "allowed" : "not allowed"}`, (state) => ({ ...state, permissions: { ...state.permissions, FACILITATOR: { ...state.permissions.FACILITATOR, [action]: on } } }));
    toast.success("Permission saved. The Facilitator Portal uses it straight away.");
  }
  return <article className="admin-panel admin-form">
    <h2 className="font-bold">Publication</h2>
    <fieldset className="space-y-2"><legend className="mb-1 text-sm font-bold">Default audience when publishing</legend>
      <label className="flex items-center gap-2"><input type="radio" name="scope" checked={data.platform.defaultScope === "platform"} onChange={() => { savePlatform(name, { defaultScope: "platform" }); toast.success("Default audience saved."); }} />Entire platform</label>
      <label className="flex items-center gap-2"><input type="radio" name="scope" checked={data.platform.defaultScope === "groups"} onChange={() => { savePlatform(name, { defaultScope: "groups" }); toast.success("Default audience saved."); }} />Selected groups</label>
    </fieldset>
    <fieldset className="space-y-2"><legend className="mb-1 text-sm font-bold">Facilitator permissions</legend>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!facilitator.approve} onChange={(event) => permit("approve", event.target.checked)} />Facilitators may approve courses as agricultural experts</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!facilitator.publish} onChange={(event) => permit("publish", event.target.checked)} />Facilitators may publish approved courses to the entire platform</label>
    </fieldset>
    <p className="text-sm text-muted-foreground">Administrators can always review, publish and unpublish any course.</p>
  </article>;
}

function Notifications() {
  const data = useAdmin();
  const { name } = useAdminActor();
  const settings = data.platform.notifications;
  return <article className="admin-panel admin-form">
    <h2 className="font-bold">Administrator notifications</h2>
    <p className="text-sm text-muted-foreground">Preferences are saved, but this demo does not send email or SMS.</p>
    {(Object.keys(notificationLabels) as (keyof PlatformSettings["notifications"])[]).map((key) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={settings[key]} onChange={(event) => { savePlatform(name, { notifications: { ...settings, [key]: event.target.checked } }); toast.success("Notification preference saved."); }} />{notificationLabels[key]}</label>)}
  </article>;
}

function AiLimits() {
  const data = useAdmin();
  const { name } = useAdminActor();
  const [values, setValues] = useState({ timeoutSec: data.ai.timeoutSec, retries: data.ai.retries, dailyLimit: data.ai.dailyLimit });
  const [error, setError] = useState("");
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!(values.timeoutSec >= 5 && values.timeoutSec <= 120)) { setError("Timeout must be 5 to 120 seconds."); return; }
    if (!(values.retries >= 0 && values.retries <= 5)) { setError("Retries must be 0 to 5."); return; }
    if (!(values.dailyLimit >= 1 && values.dailyLimit <= 1000)) { setError("The daily limit must be 1 to 1,000 questions."); return; }
    saveAiLimits(name, values);
    toast.success("AI request limits saved.");
  }
  return <form className="admin-panel admin-form" noValidate onSubmit={save}>
    <h2 className="font-bold">AI request limits</h2>
    <div className="fac-row">
      <label>Timeout (seconds)<input type="number" value={values.timeoutSec} onChange={(event) => { setValues({ ...values, timeoutSec: event.target.valueAsNumber }); setError(""); }} /></label>
      <label>Retries<input type="number" value={values.retries} onChange={(event) => { setValues({ ...values, retries: event.target.valueAsNumber }); setError(""); }} /></label>
      <label>Questions per farmer per day<input type="number" value={values.dailyLimit} onChange={(event) => { setValues({ ...values, dailyLimit: event.target.valueAsNumber }); setError(""); }} /></label>
    </div>
    {error && <p className="fac-field-error" role="alert">{error}</p>}
    <div className="admin-actions"><Button type="submit">Save limits</Button></div>
  </form>;
}

function DemoData() {
  return <article className="admin-panel">
    <h2 className="mb-2 font-bold">Demo data</h2>
    <p className="mb-3 text-sm text-muted-foreground">Everything in this demo is stored in this browser. Restoring puts back the original users, courses, groups, chatbots and progress.</p>
    <ConfirmButton size="default" variant="destructive" label="Restore demo data" title="Restore all demo data?" text="All changes made in this browser are lost, for every portal. You stay signed in." onConfirm={() => { resetAdmin(); resetLearningState(); toast.success("Demo data restored."); }} />
  </article>;
}
