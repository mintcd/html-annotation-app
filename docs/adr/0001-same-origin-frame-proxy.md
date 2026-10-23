# ADR-0001: Serve source pages through a same-origin frame and asset proxy

Status: Accepted (retrospective record of the current implementation).

Date: 2026-10-18. Updated: 2026-10-23.

Requirements: [F01-F10, F19](../requirements/page-loading.md).

## Context

Annotation depends on access to the displayed document: text selections, DOM
ranges, highlight spans, link events, and reading presentation changes. Loading
an original external URL directly into an iframe prevents the parent from using
those APIs across origins. Source pages also resolve resources and links against
their own URLs, which differ from the app's route layout.

## Decision

Resolve the website from the current session's synced server state, then serve
its HTML from `/frame/{site}/...` on the app origin. Prefer an existing
user-scoped pasted source object; otherwise fetch the source page. Return
same-origin frame headers and keep the parent able to inspect the document.
The outer iframe permits scripts, same-origin access, and forms, so fetched
source scripts execute in the app origin.

For fetched HTML, derive the source base from the final response URL and authored
base element. Retain it in `annotation-source-base` metadata. When the source base
belongs to the stored site origin, install an app-origin document base at
`/proxy/{site}/{complete-source-path}?source-query`. Preserve native relative
resource references when the browser resolves them to the intended proxy URL;
rewrite root-relative, absolute, and escaping references where needed. Keep
other origins external, including authored bases on another origin. Resolve
anchors and form actions to absolute source URLs, including fragment-only links.
Remove frame-blocking meta elements, resource hints, and configured third-party
scripts. Canonical and Open Graph trailing-slash recovery applies only to pasted
source; fetched HTML follows the final source URL and authored base.

Fetch proxy resources using the stored site origin. Rewrite CSS dependencies
against the final stylesheet URL, including imports with qualifiers. Dependencies
on the stored site origin use the asset proxy; others remain external. Return
JavaScript unchanged and buffer asset bodies within their read limit.
Remove integrity hashes from proxied stylesheet links because rewriting changes
the response bytes. Retain integrity on direct external stylesheets and scripts.

Middleware provides a narrow fallback for eligible GET, HEAD, or OPTIONS resource
requests when the referer comes from the app origin and its path starts with the
exact `/frame/{site}` or `/proxy/{site}` route. Prefer fetch destination over the
Accept header when classifying a request. Retain legacy `/{site}/...` asset prefix
handling for saved HTML, but do not infer a site from cookies. Protect app internals, APIs, and
explicit frame/proxy resources from remapping. Iframe navigations from
`/{site}/...` or `/proxy/{site}/...` use the frame handler while preserving the
path's trailing slash and query. A `?frame` query parameter does not enable this
behavior.

Keep `/frame` document routes and scoped browser cache identity stable. Pasted
source retains its source document base, disabled execution transforms, and
direct asset loading. Existing saved frames adopt the new transformation through
**Refresh saved page** after deployment; no cache reset or version change is
required.

Handled frame fetch failures use an HTTP 200 error document carrying both a
`frame-error` meta element and an error response header. The parent can offer
manual source recovery, and the cache can avoid saving the error document.

Validate outbound input and final response URLs and enforce body-read caps of
5 MiB for HTML and 10 MiB for proxy assets. The current helper relies on runtime
redirect following; its manual redirect loop, abort signal, and content-type
validation are disabled. It does not check DNS resolution or validate redirect
destinations before the runtime follows them. Option names and unused constants
are not additional enforced constraints.

## Alternatives

**Direct external iframe:** preserves the source origin's normal loading
behavior, but prevents the parent from reading selections and modifying the DOM
for annotations.

**Static extraction for every page:** reduces execution complexity, but discards
source behavior and layout that the current fetched-page path retains. Static
pasted source remains a separate recovery path under
[ADR-0003](0003-pasted-html-fallback.md).

**Rewrite every dependency:** requires understanding arbitrary scripts, CSS,
redirects, dynamic URLs, and remote origins. The current approach rewrites
supported HTML references and uses runtime fallbacks without promising complete
site reproduction.

## Consequences

The annotator can work against real DOM content and resolve source links while
displaying app-origin HTML. Route resolution depends on the server having the
website row, and some sites still reject automatic requests or fail to reproduce
their runtime behavior. Proxy asset requests do not forward the page's saved
site cookie.

The proxy base removes middleware from normal relative resource loading. It
cannot add the site prefix to runtime root-relative URLs; without a qualifying
referer, middleware cannot identify their source site. It also does not rewrite
`window.location` or arbitrary URL strings inside JavaScript. Separate document
and asset routes keep these responsibilities explicit without changing saved
frame identities.

Source script execution shares the app origin. The iframe configuration and
selective rewriting are not an origin isolation boundary. URL rewriting and
host validation have the limits described above. The current behavior and those
limits are captured in the [page loading requirements](../requirements/page-loading.md).

Implementation: [frame handler](../../app/frame/[site]/[[...path]]/route.ts),
[asset handler](../../app/proxy/[site]/[[...path]]/route.ts),
[HTML rewriting](../../core/frame/rewriteHtml.ts),
[CSS dependencies](../../core/frame/proxyCss.ts),
[rewrite helpers](../../core/frame/urlRewrite.ts),
[source bases](../../core/frame/sourceBase.ts),
[outbound helper](../../core/net/outboundFetch.ts), and
[middleware routing](../../core/frame/routing.ts).
Focused examples: [HTML rewriting](../../tests/frameHtmlRewrite.test.ts),
[request routing](../../tests/frameRouting.test.ts), and
[proxy CSS](../../tests/proxyCss.test.ts).
