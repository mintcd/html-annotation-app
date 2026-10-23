# Debug A Page That Will Not Load

Use this guide when the annotator opens but the iframe shows an error or asks
for pasted HTML.

The intended behavior and current limits are defined in the
[page-loading requirements](../requirements/page-loading.md) and
[frame/proxy decision](../adr/0001-same-origin-frame-proxy.md).

## 1. Identify Which Stage Failed

There are three stages:

1. Route resolution: `/{site}/{path}` becomes an original page URL.
2. Frame fetch: `/frame/{site}/{path}` fetches or loads HTML.
3. Asset fetch: rewritten assets load through `/proxy/{site}/{path}`.

Check the browser network panel for the first failing request.

## 2. Route Resolution Failures

Relevant files:

- [app/[site]/[[...path]]/page.tsx](../../app/[site]/[[...path]]/page.tsx)
- [core/persistence/syncServerState.ts](../../core/persistence/syncServerState.ts)

Common symptoms:

- "Unknown site"
- "The requested site is invalid"
- "The stored site origin is invalid"

The server route reads the current user's sync stream from D1. If the website
row exists only in the browser replica and has not reached D1 yet, the server
cannot resolve it.

## 3. Frame Fetch Failures

Relevant file:

- [app/frame/[site]/[[...path]]/route.ts](../../app/frame/[site]/[[...path]]/route.ts)

The frame route returns an HTTP 200 fallback document with:

```html
<meta name="frame-error" content="...">
```

`useAnnotationSession()` detects that and shows the pasted HTML fallback.

Likely causes:

- The source site blocks server-side fetches.
- The source response is not usable HTML (the current fetch helper does not enforce its declared content-type allowlist).
- The source page requires cookies not stored in `site_cookies`.
- The source host is blocked by outbound fetch validation.
- The response is too large.

## 4. Asset Fetch Failures

Relevant files:

- [app/proxy/[site]/[[...path]]/route.ts](../../app/proxy/[site]/[[...path]]/route.ts)
- [proxy.ts](../../proxy.ts)
- [core/frame/rewriteHtml.ts](../../core/frame/rewriteHtml.ts)
- [core/frame/proxyCss.ts](../../core/frame/proxyCss.ts)
- [core/frame/routing.ts](../../core/frame/routing.ts)
- [core/frame/urlRewrite.ts](../../core/frame/urlRewrite.ts)

For fetched HTML whose source base belongs to the stored site origin, the frame
installs `<base href="https://app-origin/proxy/{site}/{complete-source-path}?source-query">`.
Relative resources normally resolve through that proxy path without changing
their markup. The HTML transform rewrites root-relative, absolute, and escaping
references where needed. An authored base on another origin stays external;
resources on other origins also remain external. Anchors and form actions use
absolute source URLs, including fragments. The `annotation-source-base` metadata
retains the original base for parent link handling.

If images or CSS are missing, inspect the document's base and the browser's
resolved request URL. A relative `src` or stylesheet `href` is expected when it
resolves to the correct `/proxy/{site}/...` URL. CSS dependencies, including
imports with qualifiers, are rewritten against the stylesheet's final URL after
redirects. JavaScript response text passes through unchanged.
Proxied stylesheet links omit source integrity hashes because the CSS bytes
change; direct external stylesheet and script integrity attributes are retained.

Middleware catches some runtime root-relative resource requests when their
referer comes from the app origin and its path begins with the exact
`/frame/{site}` or `/proxy/{site}` route. It retains legacy `/{site}/...` asset
handling for previously saved HTML, but never infers the site from a cookie.
App APIs, framework resources, and explicit proxy assets bypass fallback.
Iframe navigations against the proxy base
use the frame handler; adding `?frame` does not activate this behavior.

A runtime root-relative URL without a qualifying referer cannot identify its
source site. A document base also cannot rewrite `window.location` or arbitrary
URL strings in JavaScript. Check these cases separately from supported HTML and
CSS references.

## 5. Service Worker Cache Issues

Relevant files:

- [public/sw.js](../../public/sw.js)
- [core/frame/cache.ts](../../core/frame/cache.ts)

The service worker has a frame document/asset cache keyed by scoped frame URL;
only successfully observed eligible assets can be available offline. Shared
Workbox routes also handle some assets, so a frame bundle is not a complete
archive of every resource.
Use **Refresh saved page** in the annotations panel to refresh the document and
open an asset refresh window. After deploying URL rewriting changes, existing
saved pages need this action to regenerate their cached HTML. The `/frame` route,
per-user and query cache identity, and cache versions remain unchanged; do not
clear Cache Storage to apply this transformation. A handled frame fetch failure
preserves the previously saved document.

## 6. Pasted HTML Fallback

Relevant files:

- [components/PasteHtmlDialog.tsx](../../components/PasteHtmlDialog.tsx)
- [app/api/webpages/route.ts](../../app/api/webpages/route.ts)
- [core/frame/pastedHtml.ts](../../core/frame/pastedHtml.ts)

Pasted HTML is stored in R2 under a user-scoped key:

```text
users/{userId}/webpages/{site}/{path}/{queryHash}
```

When stored HTML exists, the frame route uses it instead of fetching upstream.
Stored HTML receives script-disabling transforms and inline event handlers are
removed. Its source base keeps assets loading directly in the browser. Only this
pasted-source path can infer a trailing slash from a matching canonical or Open
Graph URL; fetched pages use the final response URL and authored base. This is
separate from excerpt sanitization and is not an isolated execution environment.
See [ADR-0003](../adr/0003-pasted-html-fallback.md).

## Tests To Run

```sh
npm run test
```

If you change URL rewriting, use the focused examples in
[URL rewriting](../../tests/urlRewrite.test.ts),
[frame HTML rewriting](../../tests/frameHtmlRewrite.test.ts),
[frame routing](../../tests/frameRouting.test.ts),
[proxy CSS](../../tests/proxyCss.test.ts), and
[source bases](../../tests/sourceBase.test.ts).

If you change pasted HTML storage keys, add coverage in `tests/pastedHtml.test.ts`.
