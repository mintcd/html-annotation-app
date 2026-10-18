# ADR-0007: Canonical-log upgrade

Status: Accepted (retrospective record of the current implementation).

Date: 2026-10-18.

Requirements: [S22-S25](../requirements/sync-and-auth.md).

## Context

The previous integration retains per-stream canonical `putRow`/`deleteRow`
history alongside global application tables. The new model uses generated
per-stream D1 collections and canonical history. Copying current rows directly
would not give fresh replicas the canonical entries needed to pull those rows,
and the old global tables do not identify an owning stream.

Imports may exceed a request budget or be interrupted after a canonical commit
but before progress is recorded. Retrying must preserve accepted operations
without duplicating history or replaying replacements over later user edits.
The browser's v1 outbox also contains a different integration's local state.

## Decision

Apply the new initial D1 migration explicitly before serving the new integration.
Generation and deployment do not apply it. Keep old canonical history available
and complete the controlled cutover described in
[the upgrade procedure](../operations/sync-upgrade.md): synchronize outstanding
edits under the old version, then stop old writers.

Before an authorized sync request or authenticated server read proceeds, use
[syncLegacyImport.ts](../../core/persistence/syncLegacyImport.ts) to import that
stream's retained canonical log through normal authority commits. Decode old
rows against the current model. An import-only policy maps old `putRow`
operations to canonical puts, preserving both inserts and replacements, and
maps old deletes to canonical deletes. The normal CRUD policy retains its
duplicate-insert checks.

Assign deterministic import identities (`legacy-import`, `legacy:{sequence}`
and the old sequence as client sequence). Persist per-stream progress separately
from the canonical commits; retained authority decisions make retries after a
lost progress update safe. Request batches contain at most eight operations and
each request handles at most 25 operations. Incomplete imports raise a pending
error and gate normal sync/server reads until completion. The sync transport
maps this to structured HTTP 503; other read routes can propagate or replace
the error, so their response shape/status is route-specific. Validate
contiguous source sequences and fail on unsupported or corrupt operations.

Refresh the source head while an import is incomplete. If growth is detected
when reaching the captured head, save incomplete progress and return 503 so a
later retry can continue once old writers stop. Fail if the source head
regresses. A completed marker returns immediately without rereading the source
head; writes to the retired integration after that point are outside this
cutover.

Do not import unscoped legacy application tables. Do not mutate or automatically
upgrade the v1 browser database/outbox. Edits absent from the old canonical log
must be recovered with the old application before switching versions.

## Alternatives

- Importing global rows would require guessing account ownership and would lose
  per-stream isolation.
- Seeding only current confirmed rows would omit pullable canonical history for
  fresh clients and would not preserve replacements and deletions as history.
- Applying old puts through ordinary insert policy would reject replacements
  that were valid in the old canonical log.
- One unbounded import request would make completion depend on a request lasting
  long enough for the entire history.
- Destructively replacing old browser storage would remove the source needed to
  recover edits that never reached the authority.
- Continuously reconciling both integrations would require a separate protocol
  and writer-coordination design. This implementation uses a controlled cutover.

## Consequences

Fresh replicas can pull imported history, imports remain account-scoped, and
interrupted or overlapping requests can retry deterministic operations. A
failed import may leave an accepted prefix; the gate keeps normal work waiting
until the remaining history is successfully imported.

Operators must preserve old history, stop old writers and verify the result.
The importer is not a monitor for late writes after completion. Missing source
tables or a stream without a recorded head are treated as empty history, so a
successful empty import alone does not prove old data was present in the chosen
database. Gapped history and schema-incompatible operations need repair or a
separate migration plan.

This decision covers canonical-log adoption for the current contract. It does
not provide automatic browser outbox migration, arbitrary existing-table
adoption or future schema evolution.
