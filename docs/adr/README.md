# Architecture decision records

The initial records document the implemented design retrospectively on
2026-10-18. "Accepted" records that the current implementation uses the decision;
it does not imply the design was newly approved or fully verified on that date.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-same-origin-frame-proxy.md) | Serve source pages through a same-origin frame and asset proxy | Accepted (retrospective) |
| [0002](0002-quote-based-annotation-anchors.md) | Persist quote/context anchors and reconstruct DOM highlights | Accepted (retrospective) |
| [0003](0003-pasted-html-fallback.md) | Store user-pasted HTML as an R2 loading fallback | Accepted (retrospective) |
| [0004](0004-frame-cache-partitioning.md) | Partition frame bundles by scoped URL | Accepted (retrospective) |
| [0005](0005-schema-driven-local-first-sync.md) | Generate shared sync wiring from an explicit schema | Accepted (retrospective) |
| [0006](0006-verified-account-offline-recovery.md) | Retain verified account identity for offline replica recovery | Accepted (retrospective) |
| [0007](0007-canonical-log-upgrade.md) | Import retained per-stream canonical history at cutover | Accepted (retrospective) |

Requirements describe the current contract in [the requirements index](../requirements/README.md).
Each ADR links affected requirements and records context, decision, alternatives,
and consequences. Operational commands belong in [development](../development.md)
or [operations](../operations/sync-upgrade.md).

Add a new numbered Proposed record for a new consequential decision. When an
accepted choice changes, link a superseding ADR and update the current
architecture/requirements rather than rewriting the old rationale.
