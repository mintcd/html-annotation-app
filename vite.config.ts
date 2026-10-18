import { defineConfig } from "vite";
import vinext, { type NextConfig } from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from 'vite-plugin-pwa';
import { syncEngineVinext } from "@mintcd/sync-engine-vinext/vite";

export const nextConfig = {
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  strictMode: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      }
    ];
  },
} satisfies NextConfig;

export default defineConfig({
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "SOURCEMAP_ERROR") return;
        warn(warning);
      },
    },
  },
  plugins: [
    syncEngineVinext(),
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
    VitePWA({
      // Bundle the sync host together with Workbox and frame caching.
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      outDir: 'dist/client',
      // Registration is handled manually in ServiceWorkerRegister.tsx so we
      // can control the update lifecycle (skip-waiting + controlled reload).
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        // Defines which compiled assets to precache
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'HTML Annotation App',
        short_name: 'Annotator',
        description: 'Offline-capable HTML annotation tool - annotate and highlight any web page',
        theme_color: '#000000',
        background_color: '#0f0f13',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon'
          },
          {
            src: '/icon-192x192.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512x512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable',
          }
        ]
      }
    }).map(plugin => ({
      ...plugin,
      // Vinext builds RSC and SSR separately. Only browser assets belong in
      // the precache, and the bundled worker must replace the public source.
      applyToEnvironment: environment => environment.name === 'client',
    }))
  ],
});
