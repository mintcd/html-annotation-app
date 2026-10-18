# Commands

Commands are defined in [package.json](../../package.json).

## Development

```sh
npm run dev
```

Runs:

```sh
vinext dev --port 5001 --host 0.0.0.0
```

Open:

```text
http://localhost:5001
```

## Sync Generation

```sh
npm run sync
```

Runs `sync-engine-vinext generate` using
[sync-engine.config.ts](../../sync-engine.config.ts).

Outputs:

- `sync/*.generated.ts`: model, client, runtime and D1/server composition
- `app/api/sync/route.ts`: the single POST endpoint
- `migrations/0001_sync_html_annotation.sql`: created once, then application-owned

Generation reads local schema/Wrangler configuration and never applies SQL or
discovers a remote schema. Apply migrations explicitly before serving the new
integration. Existing installations should follow the
[upgrade procedure](../operations/sync-upgrade.md).

```sh
npm run sync:check
npm run cf:typegen
```

`sync:check` checks generated-source drift without writing. `cf:typegen` delegates
to `wrangler types` to refresh binding declarations. Vinext tooling needs Node
22.12 or newer on this project; Node 24 is recommended.

## Checks

```sh
npm run test
npm run typecheck
npm run lint
```

## Build

```sh
npm run build
```

`prebuild` runs `npm run sync`.

## Deploy

```sh
npm run deploy
```

Runs Vinext deployment for the Cloudflare Worker configuration.

## Start Built App

```sh
npm run start
```

Runs the Vinext start command for the built app.
