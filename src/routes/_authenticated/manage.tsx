import { createFileRoute, redirect } from "@tanstack/react-router";
import { readDemoUser } from "@/lib/demo-auth";

export const Route = createFileRoute("/_authenticated/manage")({
  beforeLoad: () => {
    const demo = readDemoUser();
    if (demo?.role === "admin") throw redirect({ to: "/admin/courses" });
    if (demo?.role === "facilitator") throw redirect({ to: "/facilitator/courses" });
    throw redirect({ to: "/studio" });
  },
  component: () => null,
});