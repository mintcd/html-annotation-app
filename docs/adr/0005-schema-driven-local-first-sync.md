# ADR-0005: Schema-driven local-first sync

Status: Accepted (retrospective record of the current implementation).

Date: 2026-10-18.

Requirements: [S01-S09 and S18-S20](../requirements/sync-and-auth.md).

## Context

Annotations, notes, pages, websites, highlight colors and site cookies need
typed local reads and durable offline writes. Browser state must converge with
the D1 authority without replacing unrelated fields written by another client.
Server-rendered routes need confirmed records even though a browser save can
complete before the server sees it.

The application already owns a Workbox service worker, frame caches and update
registration. Replacing those with a separately generated offline shell would
duplicate ownership. Wrangler describes the infrastructure binding but cannot
infer the complete logical model or account policy.

## Decision

Use the schema-driven CRUD model from `@mintcd/sync-engine` through
`@mintcd/sync-engine-vinext`. Declare the six collections, scalar fields, keys
and indexes in [sync-engine.config.ts](../../sync-engine.config.ts), using
`html_annotation` as the stable application ID and `html-annotation/2` as the
current contract. Generate the shared model and browser/server wiring before
Vinext route discovery. Keep authentication, client customization, the service
worker and reviewed migrations application-owned.

Use the typed asynchronous collection API for local reads and mutations.
Primary keys are tuples. Queries operate over local visible records, including
optimistic changes, and use declared indexes with bounded pages. Application
helpers follow cursors whenever they need a complete result. A mutation's
completion means durable local intent persistence; canonical acceptance or
rejection is observed later.

Use field-patch updates against the current confirmed record through the normal
CRUD policy. Independent changed fields survive synchronization; competing
writes to one field follow authority order. Preserve duplicate-insert and
missing-update rejection rather than turning every mutation into an upsert.

Read server-side confirmed state through the D1 record adapter's per-stream
materialization, including cursor traversal. New application writes enter the
`se_html_annotation_*` collections and history, without updating legacy global
tables. When navigation needs a just-created website, check confirmed route
visibility explicitly after the local save.

Bundle the composable sync host into [public/sw.js](../../public/sw.js) alongside
Workbox. The application [client wrapper](../../sync/client.ts) enables worker
coordination even though generated runtime configuration does not enable the
package's offline-shell build. Page and worker use the same enabled registry
slot and replica; worker handlers extend event lifetime with `waitUntil()` and
drain writes before releasing their lease. Worker unavailability selects
foreground synchronization.

## Alternatives

- Waiting for D1 on every save would make connectivity a condition for editing
  and would lose the distinction between a local save and later confirmation.
- Whole-record replacement for ordinary updates would let an offline comment
  overwrite an independently changed color. Field patches express the changed
  part of the record.
- Inferring the model from remote tables during generation would couple builds
  to remote access and leave logical indexes, authorization and merge semantics
  unresolved.
- A separate generated worker would create competing ownership of registration,
  shell caching and frame-cache behavior. The composable host fits the existing
  worker instead.
- Replaying canonical history on every server read would repeat work already
  represented by confirmed collection tables.

## Consequences

The browser, service worker and server share one generated model. UI helpers
remain asynchronous and must await local persistence; code that needs remote
visibility must wait for that separately. UI status combines replica and worker
observations, including accepted work still awaiting confirmation.

Generation is local and reviewable; it neither applies migrations nor adopts
existing data. Schema evolution, contract compatibility and D1 rollout remain
explicit work. See [development workflows](../development.md) and
[ADR-0007](0007-canonical-log-upgrade.md).

Background execution is best effort. The integration does not promise a worker
will run after every write or replace the application's registration and cache
lifecycle. The account and authorization boundary is recorded in
[ADR-0006](0006-verified-account-offline-recovery.md).
