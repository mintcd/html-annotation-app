// ─── Cloudflare Env Accessor ─────────────────────────────────────────────────
// The worker entry (worker/index.ts) injects `env` onto globalThis before
// handing the request to vinext. Route handlers that need D1 / R2 bindings
// call `getEnv()` to retrieve it.

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

interface D1DatabaseBinding {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}

export interface Env {
  DB: D1DatabaseBinding;
  WEBPAGES_BUCKET: any;
  ASSETS: { fetch(request: Request): Promise<Response> };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  /** URL of the annotation-browser worker, e.g. https://annotation-browser.<account>.workers.dev */
  BROWSER_WORKER_URL?: string;
  /** Shared secret that matches AUTH_TOKEN in the browser worker */
  BROWSER_WORKER_TOKEN?: string;
  [key: string]: any;
}

export function getEnv(): Env {
  const env = globalThis.__env;
  if (!env) throw new Error("Cloudflare env not available (missing globalThis.__env)");
  return env as unknown as Env;
}
