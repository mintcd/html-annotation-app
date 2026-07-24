import { defineConfig } from "vite";
import vinext, { type NextConfig } from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from 'vite-plugin-pwa';

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
      },
      {
        source: "/sw.sync.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
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
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
    VitePWA({
      // Use injectManifest to keep your custom Cloudflare D1/IndexedDB sync logic
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        // Defines which compiled assets to precache
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      // VitePWA can also generate the manifest for you, replacing the manual step 1
      manifest: {
        name: 'HTML Annotation App',
        short_name: 'Annotator',
        description: 'Offline-capable HTML annotation tool',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon'
          },
          {
            src: '/icon-192.png',
            type: 'image/png',
            sizes: '192x192'
          },
          {
            src: '/icon-512.png',
            type: 'image/png',
            sizes: '512x512'
          }
        ]
      }
    })
  ],
});
