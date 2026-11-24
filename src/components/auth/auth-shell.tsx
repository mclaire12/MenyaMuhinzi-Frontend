import type { ReactNode } from "react";
import hero from "@/assets/welcome-garden.webp";
import { Logo } from "@/components/logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-photo">
        <figure className="auth-figure">
          <img
            src={hero}
            alt="Ubusitani bw'imboga: karoti, inyanya n'ibindi bihingwa"
            width={1024}
            height={585}
          />
          <figcaption className="auth-photo-caption">
            <Logo className="size-9 shrink-0" />
            <div>
              <h2>Iga. Hinga. Usarure neza.</h2>
              <p>Ubumenyi bushya, iminota 10 ku munsi.</p>
            </div>
          </figcaption>
        </figure>
      </aside>
      <div className="auth-form-area">
        <div className="auth-form-inner">
          <p className="eyebrow mb-4">MURAKAZA NEZA KURI MENYAMUHINZI</p>
          <h1 className="mb-2 text-4xl font-semibold">{title}</h1>
          <p className="mb-6 text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}