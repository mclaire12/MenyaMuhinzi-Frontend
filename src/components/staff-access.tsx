import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function StaffAccess() {
  return (
    <section className="mt-8 border-t pt-6 text-left">
      <h2 className="text-2xl">Saba uburenganzira bw’abakozi</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Muri iri gerageza, umuyobozi yemeza konti mu rubuga rw’ubuyobozi. Koresha konti y’igerageza y’umufasha cyangwa wiyandikishe hanyuma utegereze ibyemezo.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to="/auth">Injira konti y’igerageza</Link></Button>
        <Button asChild variant="link" className="px-0"><Link to="/admin/users" search={{ tab: "approvals" }}>Reba ibyemezo (umuyobozi)</Link></Button>
      </div>
    </section>
  );
}