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
- [core/frame/urlRewrite.ts](../../core/frame/urlRewrite.ts)

The frame route rewrites supported same-origin `src`, stylesheet `href`, `srcset`, and CSS
`url(...)` references to `/proxy/{site}/...`. Middleware also catches some
runtime-generated relative asset requests from the iframe and rewrites them to
the asset proxy.

If images or CSS are missing, inspect the rewritten HTML and confirm that URLs
are app-origin proxy URLs, not source-origin URLs.

## 5. Service Worker Cache Issues

Relevant files:

- [public/sw.js](../../public/sw.js)
- [core/frame/cache.ts](../../core/frame/cache.ts)

The service worker has a frame document/asset cache keyed by scoped frame URL;
only successfully observed eligible assets can be available offline. Shared
Workbox routes also handle some assets, so a frame bundle is not a complete
archive of every resource.
Use the annotations panel refresh action to force a frame refresh window.

During debugging, it can help to unregister the service worker and clear Cache
Storage in browser devtools.

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
removed. This is separate from excerpt sanitization and is not an isolated
execution environment. See [ADR-0003](../adr/0003-pasted-html-fallback.md).

## Tests To Run

```sh
npm run test
```

If you change URL rewriting, add coverage in `tests/urlRewrite.test.ts`.

If you change pasted HTML storage keys, add coverage in `tests/pastedHtml.test.ts`.
