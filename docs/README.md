# Documentation

The documentation follows the requirements and ADR structure used in sync-engine.
Requirements state observable behavior; architecture describes the parts and
their ownership; ADRs record consequential choices and their tradeoffs.

This baseline describes the current working-tree implementation as reviewed on
2026-10-18, including the schema-driven sync integration. Acceptance criteria
define what a change must preserve; they do not imply every criterion has an
automated test. Requirements pages identify source evidence, existing tests,
and checks that still require a browser or deployed bindings.

## Recommended Reading Order

1. [Architecture](architecture.md): browser, frame, synchronization, and server boundaries.
2. [Requirements](requirements/README.md): product, annotations, page loading, and sync/account behavior.
3. [ADRs](adr/README.md): rationale, alternatives, and consequences of the current design.
4. [Development](development.md): setup, verification, and common change workflows.

## Requirements

| Document | Scope | IDs |
| --- | --- | --- |
| [Application](requirements/application.md) | Saved pages, search, notes, titles, and palette | P01-P12 |
| [Annotations](requirements/annotations.md) | Text anchors, matching, highlights, excerpts, and editing | A01-A13 |
| [Page loading](requirements/page-loading.md) | Frame/proxy behavior, pasted HTML, and frame caches | F01-F19 |
| [Sync and auth](requirements/sync-and-auth.md) | Persistence, delivery, accounts, authority access, and upgrade | S01-S25 |

## Operations And Reference

- [Page-loading troubleshooting](operations/page-loading.md)
- [Sync upgrade procedure](operations/sync-upgrade.md)
- [Project map](reference/project-map.md)
- [Data model](reference/data-model.md)
- [Routes and runtime](reference/routes-and-runtime.md)
- [Commands](reference/commands.md)

The component submodules maintain their own documentation:
[design system](../components/design-system/README.md) and
[text editor](../components/text-editor/README.md).

## Maintaining The Baseline

Give each requirement a stable ID and an observable acceptance criterion. Update
the requirement when behavior changes, and point to implementation and
verification evidence. Keep repair procedures in the development or operations
guides.

The initial [ADRs](adr/README.md) are retrospective records of choices visible in
the code; their recording date does not claim when those choices were originally
made. Add a Proposed ADR for a new choice and mark it Accepted when agreed.
Supersede a changed decision with a new numbered record, link both records, and
update the architecture and requirements. Preserve the historical rationale.
