import {
  OutboundFetchError,
  fetchOutboundUrl,
  readResponseArrayBuffer,
  validateOutboundUrl,
} from "@/core/net/outboundFetch";
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
    const { body, contentType } = await fetchLogo(targetUrl);

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

  try {
    return validateOutboundUrl(targetUrl);
  } catch (error) {
    if (error instanceof OutboundFetchError) {
      throw new WebsiteLogoError(error.message, error.status);
    }
    throw error;
  }
}

async function fetchLogo(targetUrl: URL): Promise<{ body: ArrayBuffer; contentType: string }> {
  try {
    const { response, finalUrl } = await fetchOutboundUrl(targetUrl, {
      headers: {
        accept: "image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": LOGO_USER_AGENT,
      },
      maxBytes: MAX_LOGO_BYTES,
      maxRedirects: MAX_REDIRECTS,
      timeoutMs: FETCH_TIMEOUT_MS,
      allowedContentTypes: ["image/*"],
      allowMissingContentType: true,
    });

    if (!response.ok) {
      throw new WebsiteLogoError("Logo fetch failed.", 502);
    }

    return {
      body: await readResponseArrayBuffer(response, MAX_LOGO_BYTES),
      contentType: logoContentType(response, finalUrl),
    };
  } catch (error) {
    if (error instanceof OutboundFetchError) {
      throw new WebsiteLogoError(error.message, error.status);
    }
    throw error;
  }
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

function errorResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
