# Upgrade the previous sync integration

This procedure moves a retained per-user canonical log into the current
`html_annotation` / `html-annotation/2` integration. Its acceptance criteria are
[S22-S25](../requirements/sync-and-auth.md); the design and limits are recorded in
[ADR-0007](../adr/0007-canonical-log-upgrade.md).

## Prepare the cutover

1. Synchronize outstanding edits using the old application version. The new
   application does not read or upgrade the v1 browser outbox. Its old IndexedDB
   database remains untouched; recover unsubmitted edits with the old version
   before switching.
2. Stop old writers, including old application instances and open clients that
   can still submit to the previous integration. Keep them stopped throughout
   migration and verification.
3. Retain the old D1 canonical stream tables and log. The importer needs
   contiguous `html_annotation_sync_log_entries` through the head recorded in
   `html_annotation_sync_streams`, with operations valid under the current
   logical schema. Preserve a recovery copy through the normal database backup
   process before changing the target.
4. Review `wrangler.jsonc`, the intended environment/database and
   [migrations/0001_sync_html_annotation.sql](../../migrations/0001_sync_html_annotation.sql).
   The configured D1 binding is `DB`, with database name `annotations`. Choose
   local or remote deliberately; do not infer the target from the filename or
   from a successful generation run.

## Apply the schema explicitly

After reviewing the intended remote target, apply the initial sync migration:

```sh
npx wrangler d1 execute annotations --remote --file migrations/0001_sync_html_annotation.sql
```

For an intentionally local database, use:

```sh
npx wrangler d1 execute annotations --local --file migrations/0001_sync_html_annotation.sql
```

These are alternative target selections. Generation (`npm run sync`),
`npm run sync:check` and deployment do not apply this SQL. The migration must be
present before the new endpoint or confirmed-record server reads use the new
tables. Keep any other authentication/application schema requirements in the
normal deployment workflow. Do not delete or rewrite applied migration files
to force regeneration; plan later schema changes as separate reviewed work.

## Serve the new integration and allow import to finish

1. Serve the new application after the new D1 schema is present. The importer
   runs on demand before an authorized stream's sync exchange or authenticated
   confirmed-state read. There is no separate automatic bulk migration of every
   account at deployment time.
2. Allow retries when a stream returns HTTP 503 with
   `legacy-import-pending`. Each request processes at most 25 old operations in
   batches of at most eight, retaining durable progress. `/api/sync` translates
   pending import into structured 503. Other server-read routes remain gated
   but can propagate or replace that error, including a generic route error or
   HTTP 500. An interrupted request may have committed an
   accepted prefix; deterministic identities prevent duplicate canonical work
   when retried.
3. If the importer reports a changing source head, ensure old writers are
   stopped, then retry. An incomplete import can continue from an enlarged head.
   If history regresses, contains gaps or contains invalid operations, resolve
   the source or plan a separate recovery before proceeding; ordinary retries
   cannot repair that source history.
4. Verify each migrated account's expected records using confirmed server
   reads and a fresh browser replica. Check that old replacements have their
   latest value, deleted rows stay deleted, and records remain in the correct
   account. A fresh replica must receive imported canonical history rather than
   relying on an already populated old browser.
5. Keep old history until migration and verification are complete. Keep the
   previous write path retired after cutover.

## Recovery boundaries

The import source is each stream's retained old canonical log. Global legacy
tables such as `websites` have no owning stream and are left untouched; the
importer never guesses their ownership. A missing old streams table or missing
head for an account is treated as an empty source, so verify that the expected
legacy source exists in the selected target.

Once a stream has a completed import marker, the importer returns without
checking for further old writes. It cannot detect or incorporate all late writes
to the retired integration. Do not resume the old writers after successful
completion or assume switching application versions keeps the two histories in
sync.

Imported canonical history and local pending edits are different recovery
sources. The importer cannot recover unsent v1 browser edits, automatically
adopt arbitrary existing tables or migrate future schema versions. Retain the
relevant source and use a deliberate recovery plan if those cases apply.
