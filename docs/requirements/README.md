# Requirements

Status: Current baseline. Date: 2026-10-18.

Annotation Studio lets an account retain a library of web pages, highlight text,
and write notes, with durable local edits and later synchronization. These
requirements describe application behavior rather than the sync engine's
internal protocol contract.

| Area | Requirements | Related decisions |
| --- | --- | --- |
| Saved-page library and workspace | [P01-P12](application.md) | [ADR-0001](../adr/0001-same-origin-frame-proxy.md), [ADR-0005](../adr/0005-schema-driven-local-first-sync.md) |
| Annotation identity and editing | [A01-A13](annotations.md) | [ADR-0002](../adr/0002-quote-based-annotation-anchors.md) |
| Source pages and assets | [F01-F10, F19](page-loading.md) | [ADR-0001](../adr/0001-same-origin-frame-proxy.md) |
| Stored page-source fallback | [F03, F11-F13](page-loading.md) | [ADR-0003](../adr/0003-pasted-html-fallback.md) |
| Offline frame bundles | [F02, F14-F19](page-loading.md) | [ADR-0004](../adr/0004-frame-cache-partitioning.md) |
| Local data and delivery | [S01-S09, S18-S20](sync-and-auth.md) | [ADR-0005](../adr/0005-schema-driven-local-first-sync.md) |
| Account recovery and lifecycle | [S10-S17, S21](sync-and-auth.md) | [ADR-0006](../adr/0006-verified-account-offline-recovery.md) |
| Previous-integration cutover | [S22-S25](sync-and-auth.md) | [ADR-0007](../adr/0007-canonical-log-upgrade.md) |

Requirement IDs are stable within their area. Existing behavior and known limits
are the baseline; identify new desired behavior as proposed until implemented
and verified. A source reference establishes where a behavior lives; it does
not replace an acceptance check.

Offline scope includes retained local records and successfully cached page
resources after an online setup. It does not promise first-visit offline use,
complete copies of arbitrary websites, or browser-granted background execution.
The current auth system and legacy migration limits are documented in
[sync and auth](sync-and-auth.md).
