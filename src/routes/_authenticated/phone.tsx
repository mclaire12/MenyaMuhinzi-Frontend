import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { clearPhoneSimulator, PhoneSimulator } from "@/components/basic-phone/phone-simulator";
import { useAuth } from "@/hooks/use-auth";
import { useAdmin } from "@/lib/admin/store";
import { failNext } from "@/lib/basic-phone/answers";
import { browserVoiceAvailable } from "@/lib/basic-phone/audio";
import { basicPhoneFarmers, ensureBasicPhoneTestingProfile, identifyCaller, normalizePhone } from "@/lib/basic-phone/farmers";
import { courseStanding, enrolledCourses } from "@/lib/basic-phone/progress";
import { clock, USSD_CODE } from "@/lib/basic-phone/ussd";
import { courseLessons } from "@/lib/mock/builders";
import { useLearningState } from "@/lib/mock/store";

export const Route = createFileRoute("/_authenticated/phone")({
  validateSearch: (search: Record<string, unknown>): { phone?: string } => (typeof search["phone"] === "string" ? { phone: search["phone"] } : {}),
  head: () => ({ meta: [{ title: "Telefoni y'igerageza (USSD/IVR) — MenyaMuhinzi" }] }),
  component: PhoneTestPage,
});

const UNREGISTERED = "0789999999";

function PhoneTestPage() {
  const { roles, user } = useAuth();
  const search = Route.useSearch();
  const admin = useAdmin();
  const learning = useLearningState();
  const isAdmin = roles.includes("admin");
  const isTester = roles.includes("basic_phone_farmer");
  const farmers = useMemo(() => basicPhoneFarmers(admin, learning), [admin, learning]);
  // A signed-in basic-phone farmer tests with their own registered phone number.
  const ownPhone = useMemo(() => (isTester && user ? ensureBasicPhoneTestingProfile(user) : ""), [isTester, user]);
  const [selected, setSelected] = useState(() => (isAdmin ? search.phone ?? farmers.find((item) => item.account.status === "active")?.account.phone ?? "" : ownPhone));
  const [scenario, setScenario] = useState<"farmer" | "missing" | "unregistered" | "custom">("farmer");
  const [custom, setCustom] = useState("");
  const [speed, setSpeed] = useState(10);
  const [voice, setVoice] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  if (!isAdmin && !isTester) {
    return (
      <div className="page-width py-16">
        <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-2xl font-semibold">Telefoni y'igerageza</h1>
          <p className="mt-3 text-muted-foreground">Iki gikoresho cy'igerageza cya USSD na IVR kigenewe abayobozi n'abagerageza gusa.</p>
          <Button asChild className="mt-6"><Link to="/dashboard">Subira</Link></Button>
        </div>
      </div>
    );
  }

  const phone = scenario === "missing" ? null : scenario === "unregistered" ? UNREGISTERED : scenario === "custom" ? normalizePhone(custom) || null : selected || null;
  const identification = identifyCaller(admin, learning, phone);
  const learnerId = identification.kind === "ok" ? identification.caller.learnerId : null;
  const restart = () => { clearPhoneSimulator(); setResetKey((value) => value + 1); };

  return (
    <div className="page-width phone-page">
      <header className="phone-page-head">
        <p className="eyebrow">IGIKORESHO CY'IGERAGEZA · SI URUBUGA RW'UMUHINZI</p>
        <h1>Telefoni isanzwe: USSD na IVR</h1>
        <p className="text-muted-foreground">Umuhinzi ukoresha telefoni isanzwe ntagira urubuga. Iyi telefoni yigana uko akanda {USSD_CODE} (kode y'igerageza, ntabwo yemejwe n'ikigo cy'itumanaho) kandi agahamagarwa na MenyaMuhinzi kugira ngo yumve isomo. Ibyo akoze bibikwa mu makuru amwe abona umufashamyumvire n'umuyobozi.</p>
      </header>

      <div className="phone-layout">
        <PhoneSimulator key={`${phone ?? "none"}-${resetKey}`} phone={phone} speed={speed} voice={voice} />

        <aside className="phone-side">
          <section className="tool-card">
            <h3>Umuhinzi ugerageza</h3>
            {isAdmin ? (
              <label className="tool-field"><span>Umuhinzi wa telefoni isanzwe</span>
                <select value={selected} onChange={(event) => { setSelected(event.target.value); setScenario("farmer"); }}>
                  {farmers.map(({ account }) => <option key={account.id} value={account.phone}>{account.name} · {account.phone} · {account.status}</option>)}
                </select>
              </label>
            ) : (
              <p className="sim-note">{user?.fullName} · {ownPhone}</p>
            )}
            <fieldset className="tool-field">
              <legend>Uko umuhamagaro uza</legend>
              <label><input type="radio" checked={scenario === "farmer"} onChange={() => setScenario("farmer")} /> Nimero y'umuhinzi</label>
              <label><input type="radio" checked={scenario === "missing"} onChange={() => setScenario("missing")} /> Nta nimero (caller ID ntiboneka)</label>
              <label><input type="radio" checked={scenario === "unregistered"} onChange={() => setScenario("unregistered")} /> Nimero itanditse ({UNREGISTERED})</label>
              {isAdmin && <label><input type="radio" checked={scenario === "custom"} onChange={() => setScenario("custom")} /> Indi nimero</label>}
              {isAdmin && scenario === "custom" && <input className="tool-input" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="07XXXXXXXX" aria-label="Indi nimero" />}
            </fieldset>
            <p className="sim-note">Kumenya uhamagara: <b>{identification.kind === "ok" ? `${identification.caller.name} (yemewe)` : identification.kind}</b></p>
          </section>

          <section className="tool-card">
            <h3>Igenamiterere ry'igerageza</h3>
            <label className="tool-field"><span>Umuvuduko w'ijwi ry'isomo</span>
              <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                {[1, 5, 10, 30].map((value) => <option key={value} value={value}>{value}× {value === 1 ? "(nk'ukuri)" : "(igerageza ryihuse)"}</option>)}
              </select>
            </label>
            <label className="check-row"><input type="checkbox" checked={voice} onChange={(event) => setVoice(event.target.checked)} disabled={!browserVoiceAvailable()} /> Soma mu ijwi rya mudasobwa (si TTS nyayo)</label>
            <div className="tool-row">
              <Button type="button" variant="outline" size="sm" onClick={() => failNext("transcription")}>Gutahura ijwi binanirwe</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => failNext("answer")}>Igisubizo kinanirwe</Button>
              <Button type="button" variant="outline" size="sm" onClick={restart}>Ongera utangize telefoni</Button>
            </div>
          </section>

          <SavedProgress learnerId={learnerId} />
        </aside>
      </div>
    </div>
  );
}

function SavedProgress({ learnerId }: { learnerId: string | null }) {
  const learning = useLearningState();
  if (!learnerId) return <section className="tool-card"><h3>Aho ageze</h3><p className="sim-note">Hitamo umuhinzi wanditse kandi ukora.</p></section>;
  const courses = enrolledCourses(learning, learnerId);
  const lessons = new Map(learning.courses.flatMap((course) => courseLessons(course).map((lesson) => [lesson.id, lesson.title] as const)));
  const records = learning.progress.filter((item) => item.learnerId === learnerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const attempts = learning.attempts.filter((item) => item.learnerId === learnerId).slice(0, 3);
  const questions = learning.aiQuestions.filter((item) => item.learnerId === learnerId).slice(0, 3);
  return (
    <section className="tool-card">
      <h3>Aho ageze (amakuru abitswe)</h3>
      {!courses.length && <p className="sim-note">Nta somo ryatangiye. Itangira iyo yumvise isomo rya mbere.</p>}
      <ul className="tool-list">
        {courses.map((course) => { const standing = courseStanding(learning, learnerId, course); return <li key={course.id}><b>{course.title}</b> · {standing.done}/{standing.total} {standing.lastScore !== null ? `· ${standing.lastScore}%` : ""}</li>; })}
      </ul>
      {records.length > 0 && <>
        <h4>Amasomo aheruka</h4>
        <ul className="tool-list">
          {records.map((item) => <li key={item.lessonId}>{lessons.get(item.lessonId) ?? item.lessonId} · {item.status === "completed" ? "yarangiye" : `${clock(item.positionSec ?? 0)}/${clock(item.durationSec ?? 0)}`} · {item.channel.toUpperCase()}</li>)}
        </ul>
      </>}
      {attempts.length > 0 && <><h4>Isuzumabumenyi</h4><ul className="tool-list">{attempts.map((item) => <li key={item.id}>{learning.courses.find((course) => course.id === item.courseId)?.title} · {item.score}%</li>)}</ul></>}
      {questions.length > 0 && <><h4>Ibibazo yabajije</h4><ul className="tool-list">{questions.map((item) => <li key={item.id}>{item.question} · {item.channel.toUpperCase()} · {item.status === "answered" ? "cyasubijwe" : "ku mufashamyumvire"}</li>)}</ul></>}
    </section>
  );
}
