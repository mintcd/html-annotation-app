# Page loading requirements

Status: Current baseline. Date: 2026-10-23.

## Purpose and scope

Load source pages into a same-origin document so the annotator can inspect text,
create ranges, inject highlights, intercept links, and change the reading
presentation. Support user-pasted source when automatic fetching fails, and
retain eligible frame responses locally for later reuse.

These requirements describe the current implementation, including the working
tree. They do not promise that every website can be reproduced, that a saved
frame contains every dependency, or that source scripts execute in an isolated
origin. The decisions are recorded in [ADR-0001](../adr/0001-same-origin-frame-proxy.md),
[ADR-0003](../adr/0003-pasted-html-fallback.md), and
[ADR-0004](../adr/0004-frame-cache-partitioning.md).

## Route and fetch requirements

| ID | Requirement | Observable acceptance criterion |
| --- | --- | --- |
| F01 | Resolve an annotator route from the current session's server-side website state. | `/{site}/{path}` resolves a stored `websites` origin, validates the site, path segments, and HTTP(S) origin, and displays an error for an unknown or invalid site. A browser-only website row must reach the server before that route can resolve it. |
| F02 | Keep the source page identity separate from browser cache scope. | The route produces the original page URL and a `/frame/{site}/...` URL carrying `__annotation_cache_scope`; the frame route removes that parameter before constructing the upstream URL and pasted HTML key. |
| F03 | Prefer saved source HTML for the current page. | A nonempty R2 object at the current user/site/path/query key is rendered without fetching upstream HTML; absence falls back to the source URL. |
| F04 | Make fetched HTML readable by the parent annotator. | `/frame/{site}/...` returns rewritten HTML from the app origin with `X-Frame-Options: SAMEORIGIN` and `Cache-Control: no-store`; the parent can access the iframe document. Fetched source scripts remain executable. |
| F05 | Preserve source URL resolution while proxying supported resource references. | Fetched HTML resolves URLs using the final response URL and any authored `<base>`. When that base belongs to the stored site origin, the document base becomes `/proxy/{site}/{complete-source-path}?source-query`; otherwise it remains external. Supported relative resource references stay unchanged when the browser resolves them to the intended target. Root-relative, absolute, and escaping references are rewritten as needed, proxying only the stored site origin. Anchors and form actions become absolute source URLs, including fragments. |
| F06 | Retain source base information for parent link handling. | The frame contains an `annotation-source-base` meta value preserving the original source base. Fetched frames use a proxy document base when its origin is representable by the site route; stored frames retain a source document base. Relative links such as `./#section` retain source directory semantics. Canonical and Open Graph URLs can restore trailing slashes only for pasted source, not fetched HTML. |
| F07 | Serve proxy assets with bounded response reads. | `/proxy/{site}/...` resolves the current session's website origin, fetches the asset, reads at most 10 MiB, and returns the body with content type, cache, CORS, and `nosniff` headers. CSS dependencies, including imports with qualifiers, resolve against the final stylesheet URL and are proxied only for the stored site origin; other origins remain external. JavaScript text passes through unchanged. |
| F08 | Recover some runtime-generated resource requests. | Middleware maps eligible GET, HEAD, or OPTIONS resource requests to `/proxy/{site}/...` only when the referer comes from the app origin and its path starts with the exact `/frame/{site}` or `/proxy/{site}` route. Fetch destination takes precedence over the Accept header. Legacy `/{site}/...` asset prefixes remain supported; no site is inferred from cookies. App internals, APIs, and explicit frame/proxy resources bypass fallback. Iframe navigations from `/{site}/...` or `/proxy/{site}/...` map to `/frame/{site}/...` without losing trailing slashes or query parameters; `?frame` does not activate routing. |
| F09 | Reject unsupported outbound URL forms and bound HTML reads. | Outbound validation rejects non-HTTP(S) URLs, embedded credentials, and recognized local, private, reserved, or infrastructure literal hosts. The frame HTML reader rejects bodies over 5 MiB, and the asset reader rejects bodies over 10 MiB. |
| F10 | Signal handled frame fetch failures to the annotator. | An unknown frame site, non-success upstream response, or caught fetch/read error produces an HTTP 200 document containing `meta[name="frame-error"]`, `X-Annotation-Frame-Error: 1`, and `Cache-Control: no-store`. The parent recognizes the marker and offers the pasted HTML action. |

The current outbound helper uses the runtime's automatic redirect handling and
validates the response's final URL after the fetch. It does not validate each
redirect before following it, resolve DNS to check destination addresses, enforce
the supplied redirect count, attach its abort signal, or enforce the requested
content-type allowlist. The response readers enforce size limits. Declared
timeout, redirect, and content-type options therefore do not establish those
additional guarantees in this baseline.

Frame rewriting removes frame-blocking CSP/X-Frame-Options meta elements, resource
hints, and a configured set of third-party script hosts. It does not provide a
general compatibility or sanitization layer. Asset bodies are buffered within
their read limit; they are not streamed through unchanged as they arrive.
Proxied stylesheet links lose their source integrity hashes because dependency
rewriting changes the CSS bytes. Direct external stylesheets and scripts retain
their integrity attributes.

The proxy base preserves native relative resource resolution, but cannot attach
a site prefix to runtime root-relative URLs. Those requests need a qualifying
referer for middleware fallback; requests without one cannot identify the source
site. The base does not rewrite `window.location` or arbitrary URL strings in
JavaScript. Frame routes and browser cache identities remain unchanged. Existing
saved pages retain their old HTML until the user selects **Refresh saved page**
after deployment; rewriting changes do not clear caches or change cache versions.

## Pasted source requirements

| ID | Requirement | Observable acceptance criterion |
| --- | --- | --- |
| F11 | Save pasted HTML only for a recognized signed-in session and website. | `POST /api/webpages` rejects an anonymous session, malformed fields, empty HTML, unsafe storage components, and an unknown website; a valid request stores trimmed HTML in R2 and returns a non-cacheable success response. |
| F12 | Scope persistent pasted source by user and page variant. | R2 keys use `users/{normalizedUserId}/webpages/{site}/{pagePath}/{querySegment}`. Root pages use `__root__`; no query uses `query-none`; other normalized query strings use a stable query hash. Different query values have different keys in the covered examples. |
| F13 | Render pasted source with executable markup disabled by the current transform. | Stored HTML has executable script bodies cleared and script sources removed, inline `on*` attributes and refresh meta elements removed, nested iframes sandboxed, and nested `srcdoc` removed. Source-relative assets load directly from the source base in the browser rather than being rewritten through `/proxy`. |

Stored-source base selection honors a valid authored HTTP(S) `<base>`. Otherwise
it can recover a trailing slash from a canonical or Open Graph URL for the same
document path, then falls back to the requested source URL. The transform is not
a complete HTML sanitizer or an isolated-origin execution boundary. R2 stores the
source HTML, not a complete copy of its assets. The same normalized user and page
key select the same saved source across that user's devices; Cache Storage is
local to each browser.

## Browser cache and navigation requirements

| ID | Requirement | Observable acceptance criterion |
| --- | --- | --- |
| F14 | Identify a frame bundle by its normalized scoped URL. | Cache names are versioned stable hashes of the absolute frame URL with its fragment removed. Query values remain part of the URL, including the normalized-user-derived cache scope. Covered users and query variants select separate frame cache names; fragment variants select the same name. |
| F15 | Reuse eligible responses associated with a frame. | The frame-cache handler uses cache-first reads normally. Eligible GET document and resource responses can be stored in that frame's cache; resources are associated through the requesting frame client. Range requests, partial responses, `Vary: *`, and frame error documents are excluded. |
| F16 | Keep a good cached document when a refresh returns a handled frame error. | Explicit refresh fetches with `X-Annotation-Frame-Refresh: 1` and rejects a non-success or error-marked response before replacing the document or reloading the iframe. The worker also excludes error-marked documents from storage. |
| F17 | Refresh subsequently requested assets for a limited window. | After storing a refreshed document, the client asks the worker for a 60-second asset refresh window and reloads the iframe. The worker uses network-first reads with HTTP-cache reload for observed assets in that window and can fall back to an existing cached response. No asset manifest or complete-bundle transaction is required. |
| F18 | Support deleting the selected browser frame bundle. | `deleteFrameBundle()` removes the normalized frame cache through the worker, including its refresh marker, or deletes the cache directly if no worker is ready. This operation does not delete the R2 source object or other browser cache families. |
| F19 | Treat matching source fragments as navigation within the current document. | The parent can scroll to a decoded ID or named target from its URL fragment. Opening an intercepted source link with matching origin, query, and path apart from trailing slashes updates the parent fragment and scrolls the current frame without creating another page. |

Frame-cache setup reports failure when no responsive worker is available. A live
frame request can still fall back to the network when cache access fails, and
worker cache writes tolerate quota or unsupported-response failures. The app
also has shared Workbox caches for shell, static assets, and images; the
per-frame naming scheme does not describe or partition every cache in the
application. Retained responses can improve offline use but do not establish that
all source content, dynamic requests, forms, media ranges, or future assets are
available offline.

## Implementation and verification evidence

- Route and transformation: [annotator route](../../app/[site]/[[...path]]/page.tsx),
  [frame route](../../app/frame/[site]/[[...path]]/route.ts),
  [asset route](../../app/proxy/[site]/[[...path]]/route.ts), and
  [middleware](../../proxy.ts).
- Source handling: [URL rewriting](../../core/frame/urlRewrite.ts),
  [HTML rewriting](../../core/frame/rewriteHtml.ts),
  [CSS dependencies](../../core/frame/proxyCss.ts),
  [request routing](../../core/frame/routing.ts),
  [source bases](../../core/frame/sourceBase.ts),
  [pasted storage keys](../../core/frame/pastedHtml.ts),
  [pasted source API](../../app/api/webpages/route.ts), and
  [outbound fetch](../../core/net/outboundFetch.ts).
- Browser behavior: [cache client](../../core/frame/cache.ts),
  [cache scope](../../core/frame/cacheScope.ts),
  [service worker](../../public/sw.js), and
  [fragment navigation](../../core/frame/fragments.ts).
- Focused examples: [cache identity](../../tests/frameCache.test.ts),
  [storage keys](../../tests/pastedHtml.test.ts),
  [URL rewriting](../../tests/urlRewrite.test.ts),
  [frame HTML rewriting](../../tests/frameHtmlRewrite.test.ts),
  [frame routing](../../tests/frameRouting.test.ts),
  [proxy CSS](../../tests/proxyCss.test.ts),
  [source bases](../../tests/sourceBase.test.ts),
  [redirect source base](../../tests/outboundRedirect.test.ts), and
  [fragments](../../tests/frameFragment.test.ts). These tests are not proof of a
  complete offline bundle or an isolated execution boundary. The broader
  [outbound fetch test file](../../tests/outboundFetch.test.ts) is currently
  commented out.
