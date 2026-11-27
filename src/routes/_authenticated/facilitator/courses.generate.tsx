import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CourseGenerationForm } from "@/components/course-generation/course-generation-form";
import { PageHead } from "@/components/facilitator/shell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/facilitator/courses/generate")({
  component: GenerateFacilitatorCourse,
});

/**
 * Exactly the same course-generation form as administrators. The facilitator chooses one or
 * more of their groups later, when publishing the finished course.
 */
function GenerateFacilitatorCourse() {
  const navigate = useNavigate();
  const { permissions, loading } = useAuth();
  const canGenerate = permissions.includes("course-generations:create");

  return (
    <>
      <Link
        to="/facilitator/courses"
        className="inline-flex items-center gap-1 text-sm font-bold text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to courses
      </Link>
      <PageHead
        title="Create a course with AI"
        text="Design the chapters and sub-chapters. The AI writes the content; when it is ready you publish the course to one or more of your groups."
      />
      {loading ? (
        <p className="fac-empty">Loading…</p>
      ) : !canGenerate ? (
        <p className="fac-empty">You do not have permission to create courses.</p>
      ) : (
        <CourseGenerationForm
          onCreated={(generation) =>
            void navigate({
              to: "/facilitator/courses/$courseId",
              params: { courseId: generation.course.id },
            })
          }
        />
      )}
    </>
  );
}
