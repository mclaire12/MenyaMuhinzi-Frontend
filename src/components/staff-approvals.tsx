import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function StaffApprovals() {
  return (
    <section className="mt-10 border-t pt-8">
      <h2 className="mb-3 text-3xl">Kwemeza abakozi</h2>
      <p className="text-sm text-muted-foreground">Kwemeza konti no guha uruhare bikorwa mu rubuga rw’umuyobozi.</p>
      <Button asChild className="mt-4"><Link to="/admin/users" search={{ tab: "approvals" }}>Fungura People · Approvals</Link></Button>
    </section>
  );
}