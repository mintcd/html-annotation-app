# Routes And Runtime

This is the route inventory for the [architecture](../architecture.md).
Behavioral contracts are in [page loading](../requirements/page-loading.md)
and [sync and auth](../requirements/sync-and-auth.md).

## Page Routes

| Route | Runtime | File | Purpose |
| --- | --- | --- | --- |
| `/` | edge via layout | `app/page.tsx` | Dashboard. |
| `/{site}/{path...}` | edge | `app/[site]/[[...path]]/page.tsx` | Annotator page for a saved website/page path. |
| `/frame/{site}/{path...}` | edge | `app/frame/[site]/[[...path]]/route.ts` | Same-origin iframe HTML route. |
| `/proxy/{site}/{path...}` | default route handler runtime | `app/proxy/[site]/[[...path]]/route.ts` | Same-origin asset proxy for iframe resources. |

## API Routes

| Route | Runtime | Purpose |
| --- | --- | --- |
| `POST /api/auth/signup` | edge | Create user and session cookie. |
| `POST /api/auth/login` | edge | Verify credentials and set session cookie. |
| `POST /api/auth/logout` | edge | Clear session cookie. |
| `GET /api/auth/session` | edge | Return current sync session. |
| `POST /api/sync` | Cloudflare workerd | Typed CRUD sync endpoint with cookie, Origin and stream checks. |
| `GET /api/websites` | edge | Read website rows from current user's sync state. |
| `POST /api/webpages` | edge | Save pasted HTML to R2. |
| `GET /api/website-metadata` | edge | Fetch title and logo candidates for a site. |
| `GET /api/website-logo` | edge | Fetch and cache a selected logo image. |

## Middleware Proxy

[proxy.ts](../../proxy.ts) is the Next/Vinext middleware-style proxy function.
It does two jobs:

1. Rewrites iframe navigations to `/frame/{site}/...`.
2. Rewrites same-origin frame asset fallbacks to `/proxy/{site}/...` when a
   resource request came from a frame route.

It skips app internals such as `_next`, `/api`, `/frame`, `/proxy`, and static
favicon/robots paths.

## Cloudflare Worker

[worker/index.ts](../../worker/index.ts) is the Cloudflare Worker entry point.

It:

- stores Cloudflare bindings on `globalThis.__env`
- stores the request origin on `globalThis.__origin`
- handles Vinext image optimization at `/_vinext/image`
- delegates all other requests to Vinext's app router handler

Route handlers that need D1 or R2 call `getEnv()` from
[core/utils/env.ts](../../core/utils/env.ts).

## Service Workers

The application-owned [public/sw.js](../../public/sw.js) bundles the sync host
against the shared generated model and runtime. VitePWA builds it into
`dist/client/sw.js` for the client environment. The same worker provides:

- versioned sync messages and Background Sync delivery with foreground fallback
- app-shell precache
- app navigation cache
- static asset/image caching
- per-frame document and asset caches
- website logo cache

Auth/session responses bypass runtime caching. The client explicitly retains
its last verified identity for offline replica recovery, and worker activation
removes the retired session-response cache.

## Cloudflare Bindings

Bindings are configured in [wrangler.jsonc](../../wrangler.jsonc):

| Binding | Type | Purpose |
| --- | --- | --- |
| `DB` | D1 | Auth and sync-engine storage. |
| `WEBPAGES_BUCKET` | R2 | User-pasted HTML fallback pages. |
| `ASSETS` | assets | Compiled client assets. |
| `IMAGES` | images | Cloudflare Images transformation for Vinext. |

## Generated Runtime Files

Do not edit:

- `sync/*.generated.ts`
- `app/api/sync/route.ts`

Regenerate them with:

```sh
npm run sync
```

The initial `migrations/0001_sync_html_annotation.sql` is application-owned and
must be applied explicitly; generation and builds do not apply it.
