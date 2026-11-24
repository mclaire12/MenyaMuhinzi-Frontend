import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHead, useFacilitator } from "@/components/facilitator/shell";
import { ConfirmButton, Panel } from "@/components/facilitator/ui";
import { Button } from "@/components/ui/button";
import { provinces } from "@/lib/mock/crops";
import { resetLearningState } from "@/lib/mock/store";
import { setMockConfig, updateFacilitatorProfile } from "@/lib/mock/services/facilitators";
import type { ContentLanguage, NotificationPreferences } from "@/lib/mock/types";

export const Route = createFileRoute("/_authenticated/facilitator/settings")({ component: SettingsPage });

const notificationLabels: Record<keyof NotificationPreferences, string> = {
  reviewDecisions: "Confirm when my teaching materials are published to a group",
  farmerQuestions: "Alert me when group members stop learning",
  weeklySummary: "Weekly group learning summary",
  smsAlerts: "SMS alerts (not connected yet)",
};

const districts = Object.values(provinces).flat();

function SettingsPage() {
  const { facilitator, state } = useFacilitator();
  const [values, setValues] = useState({ name: facilitator.name, phone: facilitator.phone, email: facilitator.email, district: facilitator.district });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  function save() {
    const next: typeof errors = {};
    if (values.name.trim().length < 3) next.name = "Enter your full name.";
    if (!/^07\d{8}$/.test(values.phone.trim())) next.phone = "Phone must look like 07XXXXXXXX.";
    if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;
    updateFacilitatorProfile(facilitator.id, { name: values.name.trim(), phone: values.phone.trim(), email: values.email.trim(), district: values.district });
    toast.success("Settings saved.");
  }
  const set = (key: keyof typeof values, value: string) => { setValues({ ...values, [key]: value }); setErrors({ ...errors, [key]: undefined }); };
  return <>
    <PageHead title="Settings" text="Your contact details, language and notifications. Sign-in uses your existing account." />
    <div className="fac-grid">
      <form className="admin-panel admin-form" noValidate onSubmit={(event) => { event.preventDefault(); save(); }}>
        <h2 className="text-lg">Personal information</h2>
        <label>Full name<input value={values.name} onChange={(event) => set("name", event.target.value)} />{errors.name && <span className="fac-field-error">{errors.name}</span>}</label>
        <div className="fac-row">
          <label>Phone number<input inputMode="tel" value={values.phone} onChange={(event) => set("phone", event.target.value)} />{errors.phone && <span className="fac-field-error">{errors.phone}</span>}</label>
          <label>Email address<input type="email" value={values.email} onChange={(event) => set("email", event.target.value)} />{errors.email && <span className="fac-field-error">{errors.email}</span>}</label>
        </div>
        <label>Location (district)<select value={values.district} onChange={(event) => set("district", event.target.value)}>{(districts.includes(values.district) ? districts : [values.district, ...districts]).map((name) => <option key={name}>{name}</option>)}</select></label>
        <div><Button type="submit">Save settings</Button></div>
      </form>
      <div className="space-y-3">
        <Panel title="Preferred language">
          <select aria-label="Preferred language" className="rounded-md border px-2 py-1" value={facilitator.language === "en" ? "en" : "rw"} onChange={(event) => { updateFacilitatorProfile(facilitator.id, { language: event.target.value as ContentLanguage }); toast.success("Language preference saved."); }}><option value="rw">Kinyarwanda</option><option value="en">English</option></select>
          <p className="mt-2 text-xs text-muted-foreground">Used as the default language for new teaching materials.</p>
        </Panel>
        <Panel title="Notifications">
          <ul className="space-y-2 text-sm">{(Object.keys(notificationLabels) as (keyof NotificationPreferences)[]).map((key) => <li key={key}><label className="flex items-center gap-2"><input type="checkbox" checked={facilitator.notifications[key]} onChange={(event) => { updateFacilitatorProfile(facilitator.id, { notifications: { ...facilitator.notifications, [key]: event.target.checked } }); toast.success("Notification preference saved."); }} />{notificationLabels[key]}</label></li>)}</ul>
        </Panel>
        <Panel title="Account security">
          <p className="text-sm text-muted-foreground">Change your sign-in password. You will sign in again after a successful change.</p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/account/password">Change password</Link>
          </Button>
        </Panel>
        <Panel title="Demo tools">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.config.failNextLoad} onChange={(event) => setMockConfig({ failNextLoad: event.target.checked })} />Make the next page load or generation fail (to see the error state)</label>
          <div className="mt-3"><ConfirmButton label="Restore demo data" title="Restore the shared demo data?" text="Groups, teaching materials, farmers and progress go back to the original demo records for every portal in this browser." onConfirm={() => { resetLearningState(); toast.success("Demo data restored."); }} /></div>
        </Panel>
      </div>
    </div>
  </>;
}
