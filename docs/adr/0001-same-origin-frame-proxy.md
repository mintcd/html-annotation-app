# ADR-0001: Serve source pages through a same-origin frame and asset proxy

Status: Accepted (retrospective record of the current implementation).

Date: 2026-10-18

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
base element. Retain it in `annotation-source-base` metadata, install an
app-scoped document base, and rewrite supported same-origin resource attributes
and inline CSS URLs to absolute `/proxy/{site}/...` URLs. Keep other resource
origins external and resolve anchors and form actions to source URLs. Remove
frame-blocking meta elements, resource hints, and configured third-party scripts.

Fetch proxy resources using the stored site origin. Return script/CSS text and
buffered binary bodies with appropriate headers; do not rewrite their contents.
Relative references can resolve through the proxy path. Middleware provides an
additional fallback for some runtime resource requests using the frame referer
or, when absent, a site cookie.

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

Source script execution shares the app origin. The iframe configuration and
selective rewriting are not an origin isolation boundary. URL rewriting and
host validation have the limits described above. The current behavior and those
limits are captured in the [page loading requirements](../requirements/page-loading.md).

Implementation: [frame handler](../../app/frame/[site]/[[...path]]/route.ts),
[asset handler](../../app/proxy/[site]/[[...path]]/route.ts),
[rewrite helpers](../../core/frame/urlRewrite.ts),
[source bases](../../core/frame/sourceBase.ts),
[outbound helper](../../core/net/outboundFetch.ts), and
[middleware](../../proxy.ts).
