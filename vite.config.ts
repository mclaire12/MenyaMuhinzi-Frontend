// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only; Cloudflare is the default off-platform preset), VITE_* env injection,
//     @ path alias, React/TanStack dedupe, error logger plugins, and sandbox detection.
// On Vercel, `VERCEL=1` (set automatically) or `NITRO_PRESET=vercel` selects Nitro's `vercel`
// preset and emits Build Output API artefacts under `.vercel/output/`.
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const nitroPreset = process.env["VERCEL"] ? "vercel" : process.env["NITRO_PRESET"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 3000,
      strictPort: true,
    },
  },
  ...(nitroPreset ? { nitro: { preset: nitroPreset } } : {}),
});
