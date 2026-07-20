import { syncSessionFromRequest } from "@/core/persistence/syncIdentity";

export const runtime = "edge";

const FETCH_TIMEOUT_MS = 7000;
const MAX_REDIRECTS = 5;
const MAX_LOGO_BYTES = 256 * 1024;
const LOGO_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

class WebsiteLogoError extends Error {
  public constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export async function GET(request: Request): Promise<Response> {
  const session = syncSessionFromRequest(request);
  if (!session.authenticated) {
    return errorResponse(401);
  }

  try {
    const targetUrl = readTargetUrl(request);
    const { response, finalUrl } = await fetchLogo(targetUrl);
    const contentType = logoContentType(response, finalUrl);
    const body = await readLogoBody(response);

    return new Response(body, {
      headers: {
        "cache-control": "private, max-age=86400, stale-while-revalidate=604800",
        "content-length": String(body.byteLength),
        "content-type": contentType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (!(error instanceof WebsiteLogoError)) {
      console.warn("Failed to fetch website logo", error);
    }

    return errorResponse(error instanceof WebsiteLogoError ? error.status : 502);
  }
}

function readTargetUrl(request: Request): URL {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url");

  if (!rawUrl) {
    throw new WebsiteLogoError("Missing logo url.", 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    throw new WebsiteLogoError("Invalid logo url.", 400);
  }

  validateFetchUrl(targetUrl);
  return targetUrl;
}

async function fetchLogo(targetUrl: URL): Promise<{ response: Response; finalUrl: URL }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let currentUrl = targetUrl;

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      validateFetchUrl(currentUrl);
      const response = await fetch(currentUrl.href, {
        headers: {
          accept: "image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "user-agent": LOGO_USER_AGENT,
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new WebsiteLogoError("Logo redirect is missing a location.", 502);
        }
        currentUrl = new URL(location, currentUrl);
        continue;
      }

      if (!response.ok) {
        throw new WebsiteLogoError("Logo fetch failed.", 502);
      }

      return { response, finalUrl: currentUrl };
    }
  } finally {
    clearTimeout(timeout);
  }

  throw new WebsiteLogoError("Logo redirected too many times.", 508);
}

async function readLogoBody(response: Response): Promise<ArrayBuffer> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_LOGO_BYTES) {
    throw new WebsiteLogoError("Logo is too large.", 413);
  }

  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_LOGO_BYTES) {
    throw new WebsiteLogoError("Logo is too large.", 413);
  }

  return body;
}

function logoContentType(response: Response, finalUrl: URL): string {
  const header = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (header?.startsWith("image/")) {
    return header;
  }

  const fallback = contentTypeForPath(finalUrl.pathname);
  if (fallback) return fallback;

  throw new WebsiteLogoError("Logo response is not an image.", 415);
}

function contentTypeForPath(pathname: string): string | undefined {
  const lowerPath = pathname.toLowerCase();
  return Object.entries(CONTENT_TYPES_BY_EXTENSION)
    .find(([extension]) => lowerPath.endsWith(extension))?.[1];
}

function validateFetchUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WebsiteLogoError("Unsupported logo protocol.", 400);
  }

  if (isBlockedHost(url.hostname)) {
    throw new WebsiteLogoError("Unsupported logo host.", 400);
  }
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost"
    || host.endsWith(".localhost")
    || host === "0.0.0.0"
    || host === "::1"
  ) {
    return true;
  }

  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;
  return first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

function errorResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
