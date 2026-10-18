# Development

Start with the [architecture](architecture.md), [requirements](requirements/README.md),
and [ADRs](adr/README.md). This guide covers local setup, checks, and the main
change workflows; the [project map](reference/project-map.md) locates the code.

## Local setup

Use Node.js 24 and npm. Vinext's tooling requires Node.js 22.12 or newer; using
24 also supports the repository's direct TypeScript test execution. Initialize
the Git submodules for the design system, hooks, and text editor:

```sh
git submodule update --init --recursive
npm ci
npm run sync
```

The authored [sync configuration](../sync-engine.config.ts) generates the shared
model, typed clients, D1 composition, and `app/api/sync/route.ts`. Generation
reads local schema/Wrangler configuration; it does not discover remote schema
or apply SQL. The initial migration is created once and then application-owned.

The D1 and R2 bindings in [wrangler.jsonc](../wrangler.jsonc) have `remote: true`.
Local development requires Cloudflare access to the configured account and
resources; a dev-server URL does not imply isolated local data. Without binding
access, the shell may load while auth, sync, and pasted HTML fail.

Before using a fresh D1 database, review the target and explicitly apply both
[the sync migration](../migrations/0001_sync_html_annotation.sql) and
[the users migration](../migrations/0008_users.sql). The sync migration creates
the `se_html_annotation_*` tables; auth requires the separate `users` table.
Before replacing an existing integration, first follow the
[sync upgrade procedure](operations/sync-upgrade.md), including old-writer
quiescence and recovery of outstanding old-version edits. Builds/deployments
do not apply this SQL automatically.

```sh
npm run dev
```

Open `http://localhost:5001`, create or sign into a test account, and open a
public HTTPS page from the dashboard. Select text, create a highlight, and add
a comment from the panel. If the source blocks loading, the panel offers Paste
HTML; this requires R2 access and stores a copy for the current account.

Verify reload restores the highlight and note. Once the service worker controls
the app and the frame has loaded successfully, exercise offline editing on the
retained page and reconnect to deliver pending changes. This checks the current
cached workflow; it does not establish full offline coverage of unseen pages
or native background execution with all tabs closed.

## Checks

```sh
npm run sync:check
npm test
npm run typecheck
npm run lint
npm run build
```

`sync:check` checks generated-source drift without writing. `npm test` uses
Node's test runner on `tests/*.test.ts`; `typecheck` runs `tsc --noEmit`, and
`lint` runs the configured Vinext lint command. `prebuild` regenerates sync
sources before the build, so inspect generated changes. Refresh binding
declarations with `npm run cf:typegen` after changing Wrangler bindings.

| Area | Existing checks |
| --- | --- |
| Anchors and excerpts | `textAnchor.test.ts`, `sanitizeHtml.test.ts` |
| Source URL and frame behavior | `url.test.ts`, `urlRewrite.test.ts`, `sourceBase.test.ts`, `frameFragment.test.ts`, `externalLinkInterceptor.test.ts` |
| Fetches, pasted copies, caches | `outboundFetch.test.ts`, `outboundRedirect.test.ts`, `pastedHtml.test.ts`, `frameCache.test.ts` |
| Titles and colors | `pageTitle.test.ts`, `darkModeProxy.test.ts` |
| Sync data/query behavior | `syncQueries.test.ts`, `syncFieldPatches.test.ts` |
| Session and worker lifecycle | `syncSessionCache.test.ts`, `syncServerAuth.test.ts`, `syncClientLifecycle.test.ts`, `syncWorker.test.ts` |
| Existing-data cutover | `syncLegacyImport.test.ts` |

Test presence is not proof that a requirement passes. In particular, simulated
worker tests do not establish native Background Sync scheduling, and pure DOM
helper tests do not establish touch resizing or frame compatibility.
`outboundFetch.test.ts` is currently commented out. The
requirements pages separate automated evidence from remaining browser checks.

## Changing annotations

Read [A01-A13](requirements/annotations.md) and
[ADR-0002](adr/0002-quote-based-annotation-anchors.md).

The creation path starts in [SelectionToolbar](../components/SelectionToolbar.tsx):
detect a non-collapsed selection, clone its range, sanitize its HTML excerpt,
create a text anchor, persist through the data context, and wrap the range with
highlight spans. Create the anchor before wrapping because wrapping mutates
text nodes. Durable rows store quote/context fields; numeric offsets are runtime
hints reconstructed against a text index.

[FocusedAnnotationToolbar](../components/FocusedAnnotationToolbar.tsx) handles
comments, color, deletion, and entering coarse-pointer resize mode.
[AnnotationResizeHandles](../components/AnnotationResizeHandles.tsx) handles
custom desktop handles and native selection handles. A resize creates the new
anchor, removes old wrappers, resolves the new range, saves a sanitized excerpt,
rewraps it, and persists the change. On persistence failure it attempts a visual
rollback.

[Highlight application](../core/annotation/session/highlights.ts) matches a batch
against one text index and wraps in reverse document order to reduce range
invalidation. Update anchor/sanitizer tests when changing those contracts; use
a browser for creation, overlapping highlights, pointer/touch resizing, mode
changes, delayed content, and rollback.

## Changing synced data

Read [sync requirements](requirements/sync-and-auth.md),
[ADR-0005](adr/0005-schema-driven-local-first-sync.md), and the
[data model](reference/data-model.md).

1. Edit fields, keys, and indexes in `sync-engine.config.ts`. Keep `appId` stable;
   changing it creates a new namespace.
2. Plan coordinated D1/model/browser-replica evolution. Applied initial migration
   files are not rewritten; schema evolution requires a separate reviewed
   migration and a compatible model/layout change.
3. Run `npm run sync` and review the generated result. Apply reviewed SQL
   explicitly to the intended database through the deployment workflow.
4. Update inferred aliases in `sync/types.ts` where needed, UI domain types in
   `@types/database.d.ts`, and application helpers in
   [syncData.ts](../core/persistence/syncData.ts).
5. Use typed `insert`, field-patch `update`, and tuple-key `delete`; await local
   persistence. Declare indexes for supported query intervals and follow cursors
   when reading all matching rows.
6. Run the relevant query/patch/migration tests and the checks above.

The helper flush modes are `background` (schedule delivery), `await` (wait for a
sync run), and `none` (persist locally without an immediate explicit flush).
Use server-visibility checks when a later server route needs newly written
metadata; a local receipt alone does not establish that D1 can read it.

## Ownership and troubleshooting

Regenerate `sync/*.generated.ts` and `app/api/sync/route.ts`; do not edit them by
hand. `sync/server.ts`, `sync/client.ts`, `public/sw.js`, and migration files are
application-owned. Component submodule changes follow their own repository
documentation.

For a session stuck opening, inspect `/api/auth/session` and local storage
availability. For failed login/signup, check D1 access and the `users` table.
An "Unknown site" response usually means route metadata has not reached the
current account's confirmed server state. For frame/assets/cache issues use
[page-loading troubleshooting](operations/page-loading.md). For HTTP 503 during
old-history import, a route error while import is pending, or missing migrated rows, use the
[sync upgrade procedure](operations/sync-upgrade.md).

Deployment and built-app commands are listed in [commands](reference/commands.md).
