import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CheckCircle2, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course-card";
import { CourseLoading, LearningFeedback, LearningStat, SectionHeading } from "@/components/learning-ui";
import { allLessons, coursesQuery, courseProgress, myLearningQuery } from "@/lib/learning";
import { useAuth } from "@/hooks/use-auth";
import { farmerByAccount, farmerNotices } from "@/lib/mock/services/farmer";
import { useLearningState } from "@/lib/mock/store";
import harvest from "@/assets/harvest-illustration.jpg";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Ibyanjye — MenyaMuhinzi" }, { name: "description", content: "Aho ugeze wiga n'amasomo yawe y'ubuhinzi." }, { property: "og:title", content: "Ibyanjye — MenyaMuhinzi" }, { property: "og:description", content: "Komereza aho wari ugeze mu masomo y'ubuhinzi." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Dashboard,
});
const channelLabel: Record<string, string> = { web: "Telefoni igezweho", ussd: "USSD", ivr: "Guhamagara" };
function Dashboard() {
  const { user, roles } = useAuth();
  const learning = useLearningState();
  const farmer = user ? farmerByAccount(learning, user.id) : null;
  const unread = user ? farmerNotices(learning, user.id).filter((item) => !item.read).length : 0;
  const uid = user?.id;
  const coursesState = useQuery(coursesQuery);
  const { data: courses } = coursesState;
  const mineState = useQuery(myLearningQuery(uid));
  const { data: mine } = mineState;
  const completed = new Set(mine?.progress.filter(p => p.status === "completed").map(p => p.lesson_id));
  const enrolledIds = new Set(mine?.enrollments.map(e => e.course_id));
  const enrolled = courses?.filter(c => enrolledIds.has(c.id)) ?? [];
  const interest = new Set<string>(farmer?.cropInterest ?? []);
  const others = [...(courses?.filter(c => !enrolledIds.has(c.id)) ?? [])].sort((a, b) => Number(interest.has(b.vegetables?.slug ?? "")) - Number(interest.has(a.vegetables?.slug ?? "")));
  const courseRows = enrolled.map(c => ({ c, p: courseProgress(c, completed) }));
  const inProgress = courseRows.filter(x => x.p.done > 0 && x.p.done < x.p.total);
  const finished = courseRows.filter(x => x.p.total > 0 && x.p.done === x.p.total);
  const overall = courseRows.reduce((sum, x) => sum + x.p.total, 0);
  const overallDone = courseRows.reduce((sum, x) => sum + x.p.done, 0);
  const assigned = (mine?.enrollments ?? []).filter(e => e.source === "assignment").flatMap(e => { const c = courses?.find(x => x.id === e.course_id); return c ? [{ c, e }] : []; });
  const current = enrolled.map(c => ({ c, p: courseProgress(c, completed) })).find(x => x.p.next);
  const lessonIndex = new Map(courses?.flatMap(c => allLessons(c).map(l => [l.id, { l, c }] as const)));
  const recent = [...(mine?.progress ?? [])].filter(p => p.status === "completed").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")).slice(0, 5);
  const loading = coursesState.isLoading || mineState.isLoading;
  const error = coursesState.isError || mineState.isError;
  return <div className="page-width pb-14"><BackLink />
    <div className="page-heading"><div><p className="eyebrow mb-3">MURAKAZA NEZA</p><h1>Muraho{farmer?.name || user?.name ? `, ${farmer?.name || user?.name}` : ""}!</h1><p className="mt-3 text-muted-foreground">{farmer ? `${farmer.district} · ${farmer.phone}` : "Hitamo isomo, usome, urebe cyangwa wumve."}</p>{user && <Button asChild variant="link" className="px-0"><Link to="/notices">Amamenyesha{unread ? ` (${unread})` : ""}</Link></Button>}</div><Logo className="size-12" /></div>
    {loading ? <CourseLoading /> : error ? <LearningFeedback error retry={() => { coursesState.refetch(); mineState.refetch(); }} /> : <>
      <div className="dashboard-bento">
        {current?.p.next ? <section className="continue-panel"><p className="eyebrow mb-5">KOMEZA KWIGA · {current.c.title}</p><h2 className="text-3xl">{current.p.next.title}</h2><p className="mt-3 text-sm leading-relaxed opacity-90">{current.p.next.summary} · Iminota {current.p.next.duration_minutes}</p><Button asChild size="xl" variant="secondary" className="mt-7"><Link to="/lessons/$lessonId" params={{ lessonId: current.p.next.id }}>Fungura isomo<ArrowRight aria-hidden /></Link></Button></section> : <section className="welcome-panel"><div className="min-w-0 flex-1"><p className="eyebrow mb-3">{enrolled.length ? "WAKOZE NEZA!" : "INTAMBWE YA MBERE"}</p><h2 className="text-2xl">{enrolled.length ? "Warangije amasomo yawe" : "Tangira isomo rya mbere"}</h2><p className="mt-3 text-sm text-muted-foreground">Hitamo imboga ushaka kwiga guhinga.</p><Button asChild variant="link" className="mt-4 px-0"><Link to="/courses">Reba amasomo<ArrowRight aria-hidden /></Link></Button></div><img src={harvest} alt="Inyanya, amashu na karoti" width={1024} height={1024} className="w-28 shrink-0 sm:w-36" /></section>}
        <div className="dashboard-stats"><LearningStat label="Wiyandikishije" value={enrolled.length} icon={BookOpen} /><LearningStat label="Ari gukomeza" value={inProgress.length} icon={BookOpen} /><LearningStat label="Yarangiye" value={finished.length} icon={CheckCircle2} /><LearningStat label="Aho ugeze" value={overall ? `${Math.round((overallDone / overall) * 100)}%` : "0%"} icon={CheckCircle2} /></div>
      </div>
      {assigned.length > 0 && <section className="mb-12"><SectionHeading title="Amasomo wahawe" eyebrow="BYATANZWE N'UMUFASHAMYUMVIRE" /><ul className="assigned-list">{assigned.map(({ c, e }) => <li key={c.id}><Link to="/courses/$slug" params={{ slug: c.slug }}><b>{c.title}</b><span>{e.assigned_by ? `Wahawe na ${e.assigned_by}` : "Wahawe iri somo"}{e.due_at ? ` · Rirangire bitarenze ${new Date(e.due_at).toLocaleDateString("rw-RW")}` : ""}</span></Link><span className="text-sm font-bold text-primary">{courseProgress(c, completed).pct}%</span></li>)}</ul></section>}
      {enrolled.length > 0 && <section className="mb-12"><SectionHeading title="Amasomo yanjye" eyebrow="KOMEREZA AHO WARI UGEZE" /><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{enrolled.map(c => <CourseCard key={c.id} course={c} enrolled pct={courseProgress(c, completed).pct} />)}</div></section>}
      {others.length > 0 && <section className="mb-12"><SectionHeading title="Amasomo akwiriye" eyebrow="IGA IBISHYA" /><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{others.map(c => <CourseCard key={c.id} course={c} />)}</div></section>}
      <section><SectionHeading title="Ibyo naherukaga kwiga" />{recent.length === 0 ? <LearningFeedback title="Urugendo rwawe rutangiye" text="Amasomo urangije azagaragara hano." /> : <ul className="lesson-list">{recent.map(p => { const x = lessonIndex.get(p.lesson_id); return <li key={p.lesson_id} className="flex flex-wrap items-center gap-3 py-5"><CheckCircle2 className="size-5 text-primary" aria-hidden /><span className="min-w-0 flex-1"><b className="block text-sm">{x?.l.title}</b><span className="text-xs text-muted-foreground">{x?.c.title}</span></span><span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3.5" aria-hidden />{channelLabel[p.channel]}</span></li>; })}</ul>}</section>
      {!roles.includes("farmer") && <Button asChild variant="link" className="mt-8 px-0"><Link to="/studio">Saba uburenganzira bw’abakozi</Link></Button>}
    </>}
  </div>;
}
