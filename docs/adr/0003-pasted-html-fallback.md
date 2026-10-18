# ADR-0003: Store pasted source as a user-scoped static fallback

Status: Accepted (retrospective record of the current implementation).

Date: 2026-10-18

Requirements: [F03, F06, F10-F13](../requirements/page-loading.md).

## Context

Some source sites reject server fetches even when the user can view the page in
a browser. The annotator still needs an app-origin document to match text and
display highlights. A user-supplied page source can recover that document, but
the source URL and its directory semantics must survive storage and rendering.
Different users and query variants may supply different copies of a page.

## Decision

Offer a dialog that accepts copied page source and posts the site, page path,
source query, and HTML to `/api/webpages`. Require the current session to be
recognized as signed in, verify that its server-side website row exists, and
validate nonempty HTML and storage-key components before writing to R2.

Use this storage identity:

```text
users/{normalizedUserId}/webpages/{site}/{pagePath}/{querySegment}
```

The root path is `__root__`. An empty normalized query uses `query-none`; other
queries use a stable hash of the normalized query string. Keep the internal
browser cache-scope parameter out of the source query. Reads use the same key as
writes, so the same normalized user and page variant share the saved source
across devices. Different browser caches remain local.

Prefer nonempty stored HTML over an upstream document fetch. Render it with a
source `<base>` and `annotation-source-base` metadata, allowing relative assets
to load directly from the source site in the user's browser. Prefer an authored
valid HTTP(S) base; otherwise recover a same-document trailing slash from
canonical/Open Graph metadata when available, then use the requested source URL.

Before serving stored markup, clear executable script bodies, remove their
sources, and mark their type as disabled. Remove inline `on*` handlers and refresh
meta elements. Give nested iframes an empty sandbox and remove their `srcdoc`.
Remove frame-blocking meta elements and add the frame reading styles.

## Alternatives

**Only retry automatic fetching:** cannot recover pages blocked by upstream bot
protection or missing server-side access.

**Store one copy per site and path:** mixes users and source query variants that
can represent different documents or personalized content.

**Execute the pasted page unchanged:** retains more source behavior but also
retains stored executable markup. The current fallback deliberately serves a
less active copy.

**Archive every resource with the HTML:** could support a fuller offline copy,
but requires resource discovery and capture beyond the implemented HTML object.

## Consequences

Users can recover text and layout without the server fetching the source HTML.
Relative links keep source directory semantics, including fragment links on
pages whose canonical URL adds a trailing slash. Saving again replaces the
source at that user's page key; the R2 object is independent of browser frame
cache deletion and must be loaded through the normal refresh flow.

The fallback stores HTML only. Assets may still be unavailable or blocked, and
interactive functionality relying on executable scripts is removed. The
transform is selective; it is not a complete HTML sanitizer or an isolated-origin
boundary. The current API does not impose an explicit HTML upload-size limit.

Implementation: [dialog](../../components/PasteHtmlDialog.tsx),
[save API](../../app/api/webpages/route.ts),
[storage keys](../../core/frame/pastedHtml.ts),
[source bases](../../core/frame/sourceBase.ts), and
[frame handler](../../app/frame/[site]/[[...path]]/route.ts).
Examples: [storage-key tests](../../tests/pastedHtml.test.ts) and
[source-base tests](../../tests/sourceBase.test.ts).
