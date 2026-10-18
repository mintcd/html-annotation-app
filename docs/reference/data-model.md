# Data Model

The logical synced schema is authored in
[sync-engine.config.ts](../../sync-engine.config.ts). It generates the shared
[sync/model.generated.ts](../../sync/model.generated.ts); do not edit generated
sources manually. Each synced collection maps to a per-stream
`se_html_annotation_<collection>` D1 table. `users` remains a separate auth table.

## Tables

### `websites`

Maps a route-safe site ID to an origin.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text | Primary key. Slug derived from hostname and optional port. |
| `origin` | text | Canonical source origin, such as `https://example.com`. |
| `title` | text nullable | Site title fetched from metadata or entered later. |
| `created_at` | text | ISO timestamp. |
| `updated_at` | text | ISO timestamp. |

### `pages`

Stores annotated pages.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text | Primary key. Generated UUID. |
| `url` | text | Normalized full page URL. |
| `title` | text | Page title. May start empty and later be adopted from iframe title. |
| `number_of_scripts` | integer nullable | Legacy/count field. |
| `number_of_annotations` | integer nullable | Legacy/count field. |
| `created_at` | text | ISO timestamp. |
| `updated_at` | text | ISO timestamp. |

### `annotations`

Stores highlights.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text | Primary key. Generated UUID. |
| `page_id` | text | Usually `pages.id`; some fallback code also tolerates old rows keyed by URL. |
| `exact` | text | Selected text quote. |
| `prefix` | text | Text before the quote, used to disambiguate repeated text. |
| `suffix` | text | Text after the quote, used to disambiguate repeated text. |
| `html` | text nullable | Sanitized selected HTML excerpt. |
| `color` | text | Highlight color. |
| `comment` | text nullable | Optional note on the highlight. |
| `created_at` | text | ISO timestamp. |
| `updated_at` | text | ISO timestamp. |

Runtime code normalizes each row into an `Annotation` object with a `position`
field of type `TextAnchor`.

### `page_notes`

Stores one or more notes for a page. Runtime code reads the newest note for a
page.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text | Primary key. Generated UUID. |
| `page_id` | text | Page ID. Compatibility code also tolerates old URL-keyed notes. |
| `content` | text | Plain text page note. |
| `format` | text | Currently `plain_text`. |
| `created_at` | text | ISO timestamp. |
| `updated_at` | text | ISO timestamp. |

### `highlight_colors`

Stores user-visible highlight color meanings.

| Column | Type | Notes |
| --- | --- | --- |
| `color` | text | Primary key. Normalized `#rrggbb`. |
| `semantics` | text | Meaning label, such as `Reference` or `Concern`. |

If no colors exist, `useHighlightColors()` seeds the initial set:

- `#87ceeb`: Reference
- `#90ee90`: Confirmed
- `#ff6b6b`: Concern
- `#d3d3d3`: Follow-up

### `site_cookies`

Stores an optional Cookie header for a website.

| Column | Type | Notes |
| --- | --- | --- |
| `site_id` | text | Primary key. Matches `websites.id`. |
| `cookie` | text | Cookie header forwarded by the frame route. |
| `updated_at` | text | ISO timestamp. |

### `users`

Auth table used by `/api/auth/*`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text | SHA-256 of normalized username. |
| `username` | text | Unique normalized username. |
| `password_hash` | text | SHA-256 of trimmed password. |

## App-Level Types

Global app types are declared in [@types/database.d.ts](../../@types/database.d.ts):

- `Website`
- `Page`
- `PageNote`
- `HighlightColor`
- `TextAnchor`
- `Annotation`

Sync row aliases are inferred from the generated model in
[sync/types.ts](../../sync/types.ts).

## Important Helpers

Use these instead of manipulating sync tables directly:

- `ensurePage()`
- `getOrCreateWebsite()`
- `ensureWebsiteAvailableForRoute()`
- `createAnnotationRow()`
- `updateAnnotationRow()`
- `deleteAnnotationRow()`
- `upsertPageNoteRow()`
- `upsertHighlightColorRow()`

They live in [core/persistence/syncData.ts](../../core/persistence/syncData.ts).

## Migrations

Fresh databases also require [0008_users.sql](../../migrations/0008_users.sql)
for authentication; the sync migration does not create the `users` table.

`migrations/0001_sync_html_annotation.sql` creates the current per-stream sync
tables, including annotation quote anchors and page notes. Apply it explicitly
before serving the new integration. Older unprefixed application tables remain
legacy storage. Existing data moves through the per-stream canonical-log import;
the old browser outbox has no automatic conversion. Follow the
[upgrade procedure](../operations/sync-upgrade.md)
before deploying over an existing installation. Schema evolution requires a
separate reviewed migration and coordinated model/replica changes.
