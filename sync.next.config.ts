import { defineNextSyncConfig } from "@mintcd/sync-engine/next";

export default defineNextSyncConfig({
  d1: {
    configPath: "./wrangler.jsonc",
    binding: "DB",
    remote: true,
  },
  schema: {
    include: ["annotations", "highlight_colors", "pages", "site_cookies", "page_notes", "websites"],
  },
  client: {
    databaseName: "html-annotation-sync",
  },
  server: {
    module: "./app/sync/server.ts",
    exportName: "syncServer",
  },
  routes: {
    appDir: "./app",
    basePath: "/api/sync",
  },
  output: {
    config: "./app/sync/sync.generated.ts",
    serviceWorker: "./public/sw.sync.js",
  },
  serviceWorker: {
    url: "/sw.js",
    syncTag: "html-annotation-sync",
  },
});
