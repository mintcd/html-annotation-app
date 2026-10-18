# ADR-0004: Partition browser frame caches by scoped page URL

Status: Accepted (retrospective record of the current implementation).

Date: 2026-10-18

Requirements: [F02, F14-F19](../requirements/page-loading.md).

## Context

The same source path can return different documents for different queries or
users. A browser can keep cached frames while the app switches users. Source
fragments identify positions within a document and should not create additional
frame bundles. Refresh must avoid replacing a previously usable page with the
HTTP 200 document used to signal a fetch error.

## Decision

Add a stable scope derived from the normalized user ID to the frame URL as
`__annotation_cache_scope`. Normalize the full frame URL to an absolute URL with
its fragment removed, retaining all query parameters, then derive the versioned
`annotation-frame-v2-{stableFrameId}` cache name from that value. The scope is a
cache partitioning input, not an authorization token or cryptographic boundary.
The server removes it before fetching source HTML or looking up pasted HTML.

Use a browser cache client and an application-owned service worker. The
frame-cache handler normally reads cache-first. It associates eligible resources
with their requesting frame client, then stores responses under their request
keys within the selected frame cache. Exclude range requests, partial responses,
`Vary: *`, unsuccessful non-opaque responses, and error-marked frame documents.
Cache access failures can fall back to network, and worker cache write failures
do not block a live response.

Explicit refresh fetches the document with `cache: reload` and an annotation
refresh header, checks the HTTP result and frame-error header, then stores a
valid document. Ask the worker for a 60-second refresh window and reload the
iframe. The worker fetches subsequently observed assets network-first while that
window is active, bypassing HTTP cache and using saved responses if network
refresh fails. The window has an in-memory marker and, where available, a
Cache Storage control marker so a worker restart can recover it.

Delete a selected frame cache and its refresh marker by normalized frame URL.
Activation removes older cache versions and the legacy frame cache. Keep pasted
HTML in R2 separate from this browser lifecycle, using the persistent user/page
identity in [ADR-0003](0003-pasted-html-fallback.md).

## Alternatives

**One shared frame cache keyed only by path:** conflates source query variants
and user scopes.

**Separate caches for every fragment:** duplicates one document and its observed
assets when a user follows section links.

**Always fetch network-first:** makes repeat viewing depend more heavily on
upstream availability and does not express the current explicit refresh action.

**Capture a complete asset manifest and replace it atomically:** could establish
a fuller saved snapshot, but needs dependency discovery and a completion model
that the implemented observed-request cache does not have.

## Consequences

Covered user and query variants select separate local frame caches, while
fragment navigation reuses the document. A handled refresh failure preserves the
previously stored document, and successful document refresh does not imply that
every asset was refreshed or is available offline. Each asset can retain its own
older version when fetching fails.

The worker also contains shared Workbox shell, static-asset, and image caches.
The frame naming scheme does not partition those caches or guarantee that every
resource passes through the frame handler. Only eligible requests observed while
the relevant worker and frame client are available can contribute to a frame
bundle. Dynamic APIs, form requests, media ranges, and resources never requested
are outside that bundle policy. Storage quota and browser eviction can remove
saved responses.

Implementation: [cache client](../../core/frame/cache.ts),
[scope helper](../../core/frame/cacheScope.ts),
[service worker](../../public/sw.js), and
[annotation session](../../core/annotation/session/useAnnotationSession.ts).
Examples: [cache tests](../../tests/frameCache.test.ts) and
[fragment tests](../../tests/frameFragment.test.ts).
