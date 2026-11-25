import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { isFarmerRole, roleLabels, type UserValues } from "@/lib/admin/people";
import { enabledLanguages } from "@/lib/admin/platform";
import { useAdmin } from "@/lib/admin/store";
import type { AccountStatus, PlatformLanguage, PortalRole } from "@/lib/admin/types";
import { crops, provinces } from "@/lib/mock/crops";
import { useLearningState } from "@/lib/mock/store";
import type { CropSlug } from "@/lib/mock/types";

type Props = { initial: UserValues; roles: PortalRole[]; submitLabel: string; onSubmit: (values: UserValues) => string | null; onCancel: () => void };

const roleNotes: Record<PortalRole, string> = {
  ADMIN: "Full control of the platform. Signs in on the web with an email.",
  FACILITATOR: "Manages farmer groups, courses and teaching materials. Signs in on the web with an email.",
  SMARTPHONE_FARMER: "Learns in the web app. Personal email and phone number are required.",
  BASIC_PHONE_FARMER: "Learning portal for basic-phone testing. Personal email and phone number are required.",
};

export function UserForm({ initial, roles, submitLabel, onSubmit, onCancel }: Props) {
  const admin = useAdmin();
  const learning = useLearningState();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const set = <K extends keyof UserValues>(key: K, value: UserValues[K]) => { setValues((current) => ({ ...current, [key]: value })); setError(""); };
  const farmer = isFarmerRole(values.role);
  const basic = values.role === "BASIC_PHONE_FARMER";
  const staff = !farmer;
  const languages = enabledLanguages(admin).filter((row) => !basic || row.code !== "fr");

  function toggleCrop(crop: CropSlug, on: boolean) {
    set("cropInterest", on ? [...values.cropInterest, crop] : values.cropInterest.filter((item) => item !== crop));
  }

  return <form className="admin-form" noValidate onSubmit={(event) => { event.preventDefault(); setError(onSubmit(values) ?? ""); }}>
    <div className="fac-row">
      <label>User type<select value={values.role} disabled={roles.length < 2} onChange={(event) => { const role = event.target.value as PortalRole; setValues((current) => ({ ...current, role, email: role === "BASIC_PHONE_FARMER" ? "" : current.email, language: role === "BASIC_PHONE_FARMER" && current.language === "fr" ? "rw" : current.language })); setError(""); }}>
        {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
      </select></label>
      <label>Account status<select value={values.status} onChange={(event) => set("status", event.target.value as AccountStatus)}>
        <option value="active">Active</option><option value="pending">Pending approval</option><option value="suspended">Suspended</option><option value="deactivated">Inactive</option>
      </select></label>
    </div>
    <p className="fac-note">{roleNotes[values.role]}</p>
    <label>Full name<input value={values.name} onChange={(event) => set("name", event.target.value)} autoComplete="name" /></label>
    <div className="fac-row">
      <label>Phone number<input value={values.phone} onChange={(event) => set("phone", event.target.value)} placeholder="07XXXXXXXX" inputMode="tel" /></label>
      <label>Email<input type="email" required value={values.email} onChange={(event) => set("email", event.target.value)} placeholder="name@menyamuhinzi.rw" /></label>
      <label>Preferred language<select value={values.language} onChange={(event) => set("language", event.target.value as PlatformLanguage)}>{languages.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>
    </div>
    <div className="fac-row">
      <label>Province<select value={values.province} onChange={(event) => setValues((current) => ({ ...current, province: event.target.value, district: provinces[event.target.value]?.[0] ?? "" }))}>{Object.keys(provinces).map((province) => <option key={province}>{province}</option>)}</select></label>
      <label>District<select value={values.district} onChange={(event) => set("district", event.target.value)}>{(provinces[values.province] ?? []).map((district) => <option key={district}>{district}</option>)}</select></label>
    </div>
    <div className="fac-row">
      <label>Sector{staff ? " (optional)" : ""}<input value={values.sector} onChange={(event) => set("sector", event.target.value)} /></label>
      <label>Cell{staff ? " (optional)" : ""}<input value={values.cell} onChange={(event) => set("cell", event.target.value)} /></label>
      <label>Village{staff ? " (optional)" : ""}<input value={values.village} onChange={(event) => set("village", event.target.value)} /></label>
    </div>
    {farmer && <>
      <label>Facilitator who follows this farmer<select value={values.facilitatorId} onChange={(event) => set("facilitatorId", event.target.value)}>{learning.facilitators.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.district}</option>)}</select></label>
      <fieldset className="fac-formats"><legend>Crops of interest</legend>{crops.map((crop) => <label key={crop.slug}><input type="checkbox" checked={values.cropInterest.includes(crop.slug)} onChange={(event) => toggleCrop(crop.slug, event.target.checked)} />{crop.name_en} ({crop.name_rw})</label>)}</fieldset>
    </>}
    {values.role === "FACILITATOR" && <label>Qualification<input value={values.qualification} onChange={(event) => set("qualification", event.target.value)} placeholder="For example: BSc Agronomy" /></label>}
    {error && <p className="fac-field-error" role="alert">{error}</p>}
    <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">{submitLabel}</Button></DialogFooter>
  </form>;
}
