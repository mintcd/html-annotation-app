# Synchronization and account requirements

Status: Current baseline. Date: 2026-10-18.

## Purpose and scope

Let a signed-in user persist edits in the browser, continue working offline,
and synchronize that account's records with a D1 authority. Local persistence
and server confirmation are separate outcomes. These requirements describe the
current integration of `@mintcd/sync-engine` 2.x and
`@mintcd/sync-engine-vinext`; they do not redefine the engine protocol.

## Behavioral requirements

| ID | Requirement | Observable acceptance criterion |
| --- | --- | --- |
| S01 | Declare the synchronized model explicitly. | `sync-engine.config.ts` defines `annotations`, `highlight_colors`, `page_notes`, `pages`, `site_cookies` and `websites`, their scalar fields, tuple primary keys and supported indexes. The application ID is `html_annotation` and the current contract is `html-annotation/2`. |
| S02 | Generate shared wiring from local configuration. | `npm run sync` produces the shared model, page/server runtime modules, endpoint and initial SQL; `npm run sync:check` reports drift without writing. Generation reads the logical definition and Wrangler configuration without inspecting remote tables, applying SQL or changing bindings. |
| S03 | Preserve generated and application ownership. | Generated files carry ownership markers and are regenerated. Application code owns `sync/client.ts`, `sync/server.ts`, `public/sw.js` and reviewed migrations; generation does not replace those decisions. |
| S04 | Persist a mutation locally before treating it as saved. | Awaiting a typed mutation completes durable local intent persistence without requiring connectivity. Local reads include the optimistic change; later synchronization determines server acceptance or rejection. |
| S05 | Update only the fields a user changed. | Two offline clients changing an annotation's comment and color retain both changes after synchronization. Same-field conflicts follow authority order; duplicate inserts and updates to missing records are rejected by the normal CRUD policy. |
| S06 | Use typed, bounded collection queries. | Primary-key lookups use tuples. Filters use a declared primary key or index, unsupported predicates fail explicitly, and query results expose bounded pages with cursors. |
| S07 | Follow pagination when a complete result is required. | `collectSyncRows()` requests pages of 256 rows and follows every cursor. Browser lists and confirmed server materialization do not truncate a collection at the first page. |
| S08 | Expose local and worker progress to the UI. | `useSyncRows()` reloads asynchronously when the engine revision changes. `useSyncStatus()` includes opening, replica and worker state, errors and pending work, counting accepted operations still awaiting canonical confirmation. |
| S09 | Make server-dependent navigation wait for visibility. | Helpers support `background`, `await` and `none` flush modes. Dashboard navigation checks confirmed website availability with `ensureWebsiteAvailableForRoute()` and retains a newly created local row if that check fails. The five-second polling deadline is checked between attempts; an outstanding fetch/JSON read has no abort deadline. |
| S10 | Derive a replica account from the existing session system. | A normalized user ID maps to `user:{normalizedUserId}`. The signed-out `anonymous` UI identity opens no synchronized replica. Login/signup use the existing D1 users and `html_annotation_user_id` cookie. |
| S11 | Distinguish verified bootstrap from offline recovery. | A successful `/api/auth/session` response may initialize a replica and update the remembered identity. Offline detection or a fetch `TypeError` may reopen an existing cached identity without initialization. An unsuccessful HTTP response reports an error rather than becoming a verified sign-out. |
| S12 | Cache identity only as a local recovery selector. | The remembered authenticated user is stored in local storage; the stream is recomputed from the user ID when read. A verified signed-out response removes the cache, and storage failures do not fail an otherwise successful login. The cache grants no server access. |
| S13 | Recover existing durable state without silently replacing identity. | Sessions require IndexedDB and Web Locks. Recovery requires the existing replica and client identity; missing or evicted storage reports failure. Explicit sign-in can reenable the same retained account's replica and pending work. |
| S14 | Serialize account lifecycle changes in the application runtime. | Open, close, React effect cleanup, verified logout and verified account switches share one queue. The current client closes before its registry slot is disabled or another account opens; stale cleanup cannot close the replacement client. |
| S15 | Stop exposing the previous account during a transition. | A changed session hides the prior engine and invalidates imperative runtime access before asynchronous cleanup finishes. Saves check the runtime generation. Ordinary offline recovery does not invoke logout, and logout retains local data by default. |
| S16 | Authorize every sync exchange before opening its authority. | The sync route requires a cookie identity, an `Origin` exactly matching the request origin, no `Sec-Fetch-Site: cross-site`, and a requested stream equal to the cookie-derived stream. Missing/malformed identity returns 401; denied origin or stream returns 403. A public identity header cannot authorize sync. |
| S17 | Keep authorization failure separate from domain rejection. | The transport sends same-origin cookies. A failed authorization exchange leaves durable pending local work intact and grants no access to another stream; it does not become an accepted CRUD operation. |
| S18 | Serve confirmed records from the current user's D1 materialization. | Authenticated server reads use the D1 adapter and per-stream `se_html_annotation_*` collections. Frame, proxy and metadata routes can read confirmed records without replaying the full canonical log on each request; new writes do not project into legacy global application tables. |
| S19 | Compose sync into the existing service worker. | `public/sw.js` bundles the sync host alongside the application's Workbox and frame-cache handlers. Sync messages and Background Sync attach work with `waitUntil()`, share the enabled replica registry with the page, and drain storage work before releasing the lease. |
| S20 | Keep synchronization usable when worker execution is unavailable. | The application client enables coordination with its existing worker and falls back to foreground synchronization when that worker is unavailable. Background execution remains best effort; registration, updates and frame caching remain application-owned. |
| S21 | Keep session verification out of runtime caches. | `/api/auth/session` responses use `Cache-Control: no-store`, the worker does not cache that route, and activation deletes the retired `api-session-v1` cache. Offline identity recovery uses the explicit local selector. |
| S22 | Make D1 schema rollout explicit. | An operator applies `migrations/0001_sync_html_annotation.sql` to the reviewed target before serving this integration. Generation and deployment do not apply that SQL automatically; changes to existing schemas require a separate migration plan. |
| S23 | Upgrade only retained stream-owned canonical history. | Before sync or authenticated server reads proceed, the importer replays that stream's retained `putRow` and `deleteRow` log into new canonical commits. Replacements and deletions remain pullable by a fresh client; unscoped legacy application tables are not imported. |
| S24 | Make interrupted imports retryable and bounded. | Import identities derive from old sequence numbers, progress is durable, batches contain at most eight operations and a request processes at most 25. Retrying accepted operations does not duplicate history or overwrite subsequent edits. An incomplete import raises a pending error, translated by `/api/sync` into retryable HTTP 503; other server readers remain gated with route-specific error handling. Gapped or invalid history fails. |
| S25 | Require a controlled cutover from old writers. | Outstanding v1 browser edits are synchronized under the old version and old writers are stopped before rollout. The importer can resume from an enlarged source head while incomplete and returns 503 if growth is detected at completion of a pass; it does not monitor writes after a completed marker. |

## Baseline limits

The current auth system uses a user-ID cookie and SHA-256 password comparison.
Here, a **verified session** means a successful session-endpoint response rather
than a signed server session. The sync boundary's origin and stream checks do
not add cryptographic protection to the cookie or replace password handling.
They do not describe every other application route's identity handling.

The lifecycle queue and runtime generation checks cover the application's
runtime, while the package coordinates participating page/worker sessions
through its registry and leases. They are not a promise that every browser
context has completed a global account transition before another action occurs.

Local durability depends on browser storage surviving. The v1 browser outbox is
not upgraded automatically and its database remains untouched. Reopen the old
version to recover edits that never reached its canonical log before switching.
The importer assumes retained, contiguous history decodable by the current
schema; it does not adopt arbitrary SQL tables or provide automatic schema
evolution. Follow the [sync upgrade procedure](../operations/sync-upgrade.md).

## Decisions and evidence

- [ADR-0005: Schema-driven local-first sync](../adr/0005-schema-driven-local-first-sync.md) records S01-S09 and S18-S20.
- [ADR-0006: Verified account and offline recovery](../adr/0006-verified-account-offline-recovery.md) records S10-S17 and S21.
- [ADR-0007: Canonical-log upgrade](../adr/0007-canonical-log-upgrade.md) records S22-S25.
- [Sync configuration](../../sync-engine.config.ts), [app helpers](../../core/persistence/syncData.ts) and [server state queries](../../core/persistence/syncStateQueries.ts) define the model and read/write integration.
- [Field patch tests](../../tests/syncFieldPatches.test.ts), [query tests](../../tests/syncQueries.test.ts), [lifecycle tests](../../tests/syncClientLifecycle.test.ts), [session cache tests](../../tests/syncSessionCache.test.ts), [auth tests](../../tests/syncServerAuth.test.ts), [worker tests](../../tests/syncWorker.test.ts) and [import tests](../../tests/syncLegacyImport.test.ts) exercise the observable behavior.
