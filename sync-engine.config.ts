import { defineSyncConfig } from "@mintcd/sync-engine-vinext/config";

export default defineSyncConfig({
  version: 1,
  appId: "html_annotation",
  contractVersion: "html-annotation/2",
  wrangler: { config: "wrangler.jsonc", binding: "DB" },
  collections: {
    annotations: {
      fields: {
        id: { type: "string" },
        page_id: { type: "string" },
        exact: { type: "string" },
        html: { type: "string", nullable: true },
        created_at: { type: "string" },
        updated_at: { type: "string" },
        color: { type: "string" },
        comment: { type: "string", nullable: true },
        prefix: { type: "string" },
        suffix: { type: "string" },
      },
      primaryKey: ["id"],
      indexes: { byPage: ["page_id"] },
    },
    highlight_colors: {
      fields: {
        color: { type: "string" },
        semantics: { type: "string" },
      },
      primaryKey: ["color"],
    },
    page_notes: {
      fields: {
        id: { type: "string" },
        page_id: { type: "string" },
        content: { type: "string" },
        format: { type: "string" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
      primaryKey: ["id"],
      indexes: { byPage: ["page_id"] },
    },
    pages: {
      fields: {
        id: { type: "string" },
        url: { type: "string" },
        title: { type: "string" },
        number_of_scripts: { type: "number", nullable: true },
        created_at: { type: "string" },
        updated_at: { type: "string" },
        number_of_annotations: { type: "number", nullable: true },
      },
      primaryKey: ["id"],
      indexes: { byUrl: ["url"] },
    },
    site_cookies: {
      fields: {
        site_id: { type: "string" },
        cookie: { type: "string" },
        updated_at: { type: "string" },
      },
      primaryKey: ["site_id"],
    },
    websites: {
      fields: {
        id: { type: "string" },
        origin: { type: "string" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
        title: { type: "string", nullable: true },
      },
      primaryKey: ["id"],
      indexes: { byOrigin: ["origin"] },
    },
  },
});
