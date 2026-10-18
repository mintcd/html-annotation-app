# Application requirements

Status: Current baseline. Date: 2026-10-18.

## Purpose and scope

Provide a personal web-page library and annotation workspace. The dashboard
connects saved pages, highlights, comments, page notes, and highlight meanings.
Detailed contracts are specified in [annotations](annotations.md),
[page loading](page-loading.md), and [sync and auth](sync-and-auth.md).

## Behavioral requirements

| ID | Requirement | Observable acceptance criterion |
| --- | --- | --- |
| P01 | Expose account and replica readiness. | The dashboard shows session opening, signed-out login/signup, or the signed-in library according to resolved session state; a replica read failure is surfaced rather than presented as an empty successful library. |
| P02 | Reuse the application's canonical page identity. | Opening a URL normalizes it before lookup, strips the configured tracking parameters, and reuses an existing page row when found. Website lookup uses the source origin; the stored website ID selects the route. |
| P03 | Wait for server-visible route metadata. | Before dashboard navigation, the website is found or created locally; creation requests sync. `/api/websites` is checked for matching ID and origin, with a five-second polling deadline checked between attempts. A failed check reports that the site was saved locally but is unavailable to the server. |
| P04 | Present the retained page library. | Each saved page can show its title/URL, website metadata, annotation count, highlights, and selected page note. Pages sort by descending stored update timestamp. Older URL-keyed annotations/notes remain readable alongside page-ID-keyed rows. |
| P05 | Search across saved work. | Case-insensitive search finds a page by page title, website title, URL, highlighted text, annotation comment, or selected page-note content; clearing the query restores the library. |
| P06 | Preserve user page titles. | Users can save a trimmed page title. Frame title discovery fills an empty title or accepts the same title, but does not overwrite a different nonempty saved title. |
| P07 | Edit comments and page notes. | A highlight comment can be updated or cleared. Saving a nonempty page note updates the selected note or creates one; saving whitespace-only content deletes the selected note. When multiple notes exist, the most recent stored timestamp selects the displayed note. |
| P08 | Manage highlight meanings. | An empty loaded palette is seeded with Reference, Confirmed, Concern, and Follow-up colors. Users can save a valid three- or six-digit hex color and nonempty trimmed meaning; colors normalize to lowercase `#rrggbb`. Dashboard deletion refuses to remove its final palette entry. |
| P09 | Confirm destructive library actions. | Page and individual highlight deletion present confirmation before mutations. Successful page deletion removes its associated known annotations, page notes, and page row, then attempts to remove the corresponding scoped frame bundle. |
| P10 | Keep cache cleanup separate from data deletion. | Failure to remove a frame bundle after successful page-row deletion is logged without reporting the persisted deletion as failed or requiring the user to repeat it. |
| P11 | Surface operation failures. | Invalid URL input, failed saves, failed deletes, and failure to prepare a page route produce visible feedback. A page-row read/creation failure in the annotator client displays an opening error instead of remaining in a successful workspace. |
| P12 | Offer an in-page workspace. | A resolved saved page mounts the same-origin iframe with annotation overlays, selection/focused-highlight controls, a notes/highlights panel, and loading/fallback feedback. Reading mode and dark mode operate on the prepared frame document. |

## Verification and implementation

| Requirements | Implementation | Existing automated evidence / remaining check |
| --- | --- | --- |
| P01, P04-P05, P07-P11 | [Dashboard](../../components/Dashboard.tsx), [data helpers](../../core/persistence/syncData.ts), [palette seeding](../../core/persistence/useHighlightColors.ts) | [Sync queries](../../tests/syncQueries.test.ts) and [field patches](../../tests/syncFieldPatches.test.ts) cover parts of the data path; dashboard interaction, confirmation, and failure feedback need browser checks. |
| P02-P03 | [URL helpers](../../core/utils/url.ts), [data helpers](../../core/persistence/syncData.ts), [page route](../../app/[site]/[[...path]]/page.tsx) | [URL tests](../../tests/url.test.ts) cover normalization/navigation; verify a newly created site's server-visibility wait with working D1 bindings. |
| P06 | [Title rules](../../core/annotation/session/title.ts), [annotation session](../../core/annotation/session/useAnnotationSession.ts) | [Page title tests](../../tests/pageTitle.test.ts); browser check for delayed title discovery and manual editing. |
| P11-P12 | [Client bridge](../../components/SitePageClient.tsx), [annotator](../../components/Annotator.tsx), [frame runtime](../../core/frame/runtime/index.ts) | [Dark-mode tests](../../tests/darkModeProxy.test.ts) cover color helpers; workspace, mode changes, and load/error presentation need browser checks. |

## Limits

Canonical lookup is reuse behavior, not a cross-device uniqueness constraint on
page URLs. Website slugs derive from host/port and do not encode every origin
distinction. The route-availability polling deadline does not abort an outstanding
fetch or JSON read, so it is not a strict wall-clock navigation timeout.
Page deletion issues separate mutations; it is not an atomic
cascade, and partial failure can leave some rows deleted. It does not remove the
website row, site cookies, or pasted HTML stored in R2.

The application displays one selected page note but the schema permits multiple
notes. Shared libraries, collaboration roles, exports, and arbitrary first-visit
offline navigation are outside this baseline.
