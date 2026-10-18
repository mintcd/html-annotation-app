# HTML Annotation App

HTML Annotation App ("Annotation Studio" in the UI) lets a user save web pages,
highlight text, and keep notes. Edits persist in a browser replica before
synchronizing to a per-user Cloudflare D1 authority. Source pages are served
through a same-origin frame proxy; pasted HTML fallbacks are stored in R2.

## Start Here

The [documentation](docs/README.md) follows the requirements and ADR format used
in sync-engine:

1. [Architecture](docs/architecture.md): responsibilities, boundaries, and data flow.
2. [Requirements](docs/requirements/README.md): observable behavior and acceptance criteria.
3. [Architecture decision records](docs/adr/README.md): decisions, alternatives, and consequences.
4. [Development](docs/development.md): setup, checks, and change workflows.

## Common Commands

Use Node.js 24 for this checkout. Initialize the component submodules before
installing dependencies:

```sh
git submodule update --init --recursive
npm ci
npm run sync
npm run dev
```

The configured D1 and R2 development bindings are remote. Generation does not
apply SQL. Follow [development setup](docs/development.md) for a fresh database
and the [sync upgrade procedure](docs/operations/sync-upgrade.md) before replacing
the previous integration.

```sh
npm run sync:check
npm run test
npm run typecheck
npm run lint
npm run build
```

The dev server uses port `5001` by default:

```text
http://localhost:5001
```

## Documentation Map

- `docs/requirements/` states product and system behavior with stable IDs.
- `docs/adr/` records architectural choices and their consequences.
- `docs/architecture.md` maps the current design.
- `docs/development.md` and `docs/operations/` cover setup and maintenance.
- `docs/reference/` lists files, routes, schema, and commands.

See [docs/README.md](docs/README.md) for the full documentation index.

## Project Shape

- `app/` contains Next/Vinext routes, API routes, layout, and the generated sync endpoint.
- `components/` contains the dashboard, annotator UI, overlays, and local component packages.
- `core/` contains annotation, frame/proxy, persistence, sync, and utility logic.
- `public/sw.js` is the application-owned service worker for shell/frame caches and the bundled sync host.
- `worker/index.ts` is the Cloudflare Worker entry point.
- `migrations/` contains D1 migrations.
- `tests/` contains Node test coverage for the risky pure logic.

## Deployment Runtime

The app is built with Vinext/Next and deployed to Cloudflare Workers. Cloudflare
bindings are configured in [wrangler.jsonc](wrangler.jsonc):

- `DB`: D1 database for auth and sync data
- `WEBPAGES_BUCKET`: R2 bucket for user-pasted HTML fallbacks
- `ASSETS`: compiled static assets
- `IMAGES`: Cloudflare Images binding used by Vinext image optimization

Offline use depends on an existing replica and cached pages/assets. Background
sync is best effort; see the [sync requirements](docs/requirements/sync-and-auth.md)
and [page-loading requirements](docs/requirements/page-loading.md) for the scope.
