import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LearningFeedback } from "@/components/learning-ui";
import { useAuth } from "@/hooks/use-auth";
import { crops } from "@/lib/mock/crops";
import { farmerByAccount, farmerNotices, saveFarmerSettings, settingsFor, updateFarmerProfile, type FarmerProfileValues } from "@/lib/mock/services/farmer";
import { useMockResource } from "@/lib/mock/store";
import type { ContentLanguage, CropSlug } from "@/lib/mock/types";

export const Route = createFileRoute("/_authenticated/me")({ component: MePage });

function MePage() {
  const { user } = useAuth();
  const resource = useMockResource((state) => {
    const farmer = user ? farmerByAccount(state, user.id) : null;
    const settings = farmer ? settingsFor(state, farmer.id) : null;
    const unread = user ? farmerNotices(state, user.id).filter((item) => !item.read).length : 0;
    return { farmer, settings, unread };
  });
  const farmer = resource.data.farmer;
  const [form, setForm] = useState<FarmerProfileValues | null>(null);
  const [language, setLanguage] = useState<ContentLanguage>("rw");
  const [notifyNew, setNotifyNew] = useState(true);
  const [notifyAssigned, setNotifyAssigned] = useState(true);
  const [notifyReminder, setNotifyReminder] = useState(true);
  const [notifyResults, setNotifyResults] = useState(true);
  useEffect(() => {
    if (!farmer || !resource.data.settings || form) return;
    setForm({ name: farmer.name, phone: farmer.phone, province: farmer.province, district: farmer.district, sector: farmer.sector, cell: farmer.cell, village: farmer.village, cropInterest: farmer.cropInterest });
    setLanguage(resource.data.settings.language);
    setNotifyNew(resource.data.settings.notifyNew);
    setNotifyAssigned(resource.data.settings.notifyAssigned);
    setNotifyReminder(resource.data.settings.notifyReminder);
    setNotifyResults(resource.data.settings.notifyResults);
  }, [farmer, resource.data.settings, form]);
  if (resource.status === "loading") return <div className="page-width py-10" role="status">Birimo gufunguka…</div>;
  if (resource.status === "error") return <div className="page-width py-10"><LearningFeedback error retry={resource.retry} /></div>;
  if (!farmer || !form || !user) return <LearningFeedback title="Nta mwirondoro" text="Injira nka muhinzi wa telefoni igezweho." />;
  function set<K extends keyof FarmerProfileValues>(key: K, value: FarmerProfileValues[K]) { setForm((current) => current ? { ...current, [key]: value } : current); }
  function toggleCrop(crop: CropSlug) {
    setForm((current) => current ? { ...current, cropInterest: current.cropInterest.includes(crop) ? current.cropInterest.filter((item) => item !== crop) : [...current.cropInterest, crop] } : current);
  }
  function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!form || !user) return;
    if (!/^07\d{8}$/.test(form.phone)) { toast.error("Telefoni igomba kuba 07 na imibare 8."); return; }
    if (!form.name.trim()) { toast.error("Andika izina ryawe."); return; }
    const error = updateFarmerProfile(user.id, form);
    toast[error ? "error" : "success"](error ?? "Umwirondoro wabitswe.");
  }
  function savePrefs(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    saveFarmerSettings(user.id, { language, notifyNew, notifyAssigned, notifyReminder, notifyResults });
    toast.success("Ibyo ukunda byabitswe.");
  }
  return <div className="page-width farmer-page">
    <p className="eyebrow mb-2">JYEWE</p>
    <h1 className="text-3xl">{farmer.name}</h1>
    <p className="mt-2 text-muted-foreground">{farmer.phone} · {farmer.district} · {farmer.channel === "smartphone" ? "Telefoni igezweho" : "Telefoni y'ibanze"}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button asChild variant="outline"><Link to="/notices">Amamenyesha{resource.data.unread ? ` (${resource.data.unread})` : ""}</Link></Button>
      <Button asChild variant="outline"><Link to="/account/password">Hindura ijambo ry'ibanga</Link></Button>
    </div>
    <form className="farmer-form" onSubmit={saveProfile}>
      <h2 className="text-2xl">Umwirondoro</h2>
      <label className="farmer-field">Izina<input value={form.name} onChange={(event) => set("name", event.target.value)} /></label>
      <label className="farmer-field">Telefoni<input value={form.phone} inputMode="numeric" onChange={(event) => set("phone", event.target.value)} /></label>
      <label className="farmer-field">Intara<input value={form.province} onChange={(event) => set("province", event.target.value)} /></label>
      <label className="farmer-field">Akarere<input value={form.district} onChange={(event) => set("district", event.target.value)} /></label>
      <label className="farmer-field">Umurenge<input value={form.sector} onChange={(event) => set("sector", event.target.value)} /></label>
      <label className="farmer-field">Akagari<input value={form.cell} onChange={(event) => set("cell", event.target.value)} /></label>
      <label className="farmer-field">Umudugudu<input value={form.village} onChange={(event) => set("village", event.target.value)} /></label>
      <fieldset className="farmer-chips"><legend>Imboga nkunda</legend>{crops.map((crop) => <button key={crop.slug} type="button" className={form.cropInterest.includes(crop.slug) ? "is-on" : ""} onClick={() => toggleCrop(crop.slug)}>{crop.name_rw}</button>)}</fieldset>
      <Button size="xl" type="submit">Bika umwirondoro</Button>
    </form>
    <form className="farmer-form" onSubmit={savePrefs}>
      <h2 className="text-2xl">Ibyo ukunda</h2>
      <label className="farmer-field">Ururimi<select value={language} onChange={(event) => setLanguage(event.target.value as ContentLanguage)}><option value="rw">Kinyarwanda</option><option value="en">English</option><option value="fr">Français</option></select></label>
      <label className="check-row"><input type="checkbox" checked={notifyNew} onChange={(event) => setNotifyNew(event.target.checked)} />Menyesha amasomo mashya</label>
      <label className="check-row"><input type="checkbox" checked={notifyAssigned} onChange={(event) => setNotifyAssigned(event.target.checked)} />Menyesha amasomo nahawe</label>
      <label className="check-row"><input type="checkbox" checked={notifyReminder} onChange={(event) => setNotifyReminder(event.target.checked)} />Wibutse kwiga</label>
      <label className="check-row"><input type="checkbox" checked={notifyResults} onChange={(event) => setNotifyResults(event.target.checked)} />Menyesha amanota</label>
      <Button size="xl" type="submit">Bika ibyo ukunda</Button>
    </form>
  </div>;
}
