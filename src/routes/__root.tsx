import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { ThemeProvider, useTheme } from "@/components/theme";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FarmerDock } from "@/components/farmer/dock";
import { SiteHeader } from "@/components/site-header";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { subscribe as subscribeLearning } from "@/lib/mock/store";
import { subscribeAdmin } from "@/lib/admin/store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Ipaji ntibonetse</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ipaji ushaka ntibonetse. Subira ku ntangiriro.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Subira ahabanza
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Ntibyakunze gufungura iyi paji
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ongera ugerageze cyangwa usubire ku ntangiriro.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ongera ugerageze
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Subira ahabanza
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MenyaMuhinzi" },
      { name: "description", content: "Amasomo y'ubuhinzi bw'inyanya, amashu na karoti mu Kinyarwanda." },
      { property: "og:title", content: "MenyaMuhinzi" },
      { property: "og:description", content: "Amasomo y'ubuhinzi bw'imboga mu Kinyarwanda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="rw" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem("mm-theme")==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}}catch(e){}})();` }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const basicPhoneOpenPaths = ["/", "/auth", "/phone"];

function BasicPhoneGate({ children }: { children: ReactNode }) {
  const { roles } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (!roles.includes("basic_phone_farmer") || basicPhoneOpenPaths.includes(pathname)) return <>{children}</>;
  return (
    <div className="page-width py-16">
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold">Iyi konti ikoresha telefoni isanzwe</h1>
        <p className="mt-3 text-muted-foreground">Umuhinzi ukoresha telefoni isanzwe yiga akoresheje USSD na IVR gusa. Nta paji z'urubuga agira. Koresha telefoni y'igerageza kugira ngo ukore nka we.</p>
        <Button asChild className="mt-6"><Link to="/phone">Fungura telefoni y'igerageza</Link></Button>
      </div>
    </div>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => subscribeLearning(() => {
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["my-learning"] });
  }), [queryClient]);
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["courses"] }); };
    window.addEventListener("mm-demo-auth", refresh);
    const stop = subscribeAdmin(refresh);
    return () => { window.removeEventListener("mm-demo-auth", refresh); stop(); };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <AuthProvider>
        <ThemeProvider>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-4">Jya ku bikubiyemo</a>
          <SiteHeader />
          <main id="main-content">
            <BasicPhoneGate><Outlet /></BasicPhoneGate>
          </main>
          <FarmerDock />
          <ThemedToaster />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
