export class OutboundFetchError extends Error {
  public readonly status: number;

  public constructor(
    message: string,
    status = 400,
  ) {
    super(message);
    this.status = status;
  }
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type FetchOutboundUrlOptions = Omit<RequestInit, 'redirect' | 'signal'> & {
  readonly fetchImpl?: FetchLike;
  readonly maxRedirects?: number;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly allowedContentTypes?: readonly string[];
  readonly allowMissingContentType?: boolean;
};

export type OutboundFetchResult = {
  readonly response: Response;
  readonly finalUrl: URL;
};

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_SAFE_PORT = 65535;

const BLOCKED_HOST_SUFFIXES = [
  '.corp',
  '.home',
  '.internal',
  '.intranet',
  '.lan',
  '.local',
  '.localhost',
];

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
]);

export function validateOutboundUrl(rawUrl: string | URL): URL {
  let url: URL;
  try {
    url = rawUrl instanceof URL ? new URL(rawUrl.href) : new URL(rawUrl);
  } catch {
    throw new OutboundFetchError('Invalid outbound URL.', 400);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new OutboundFetchError('Unsupported outbound URL protocol.', 400);
  }

  if (url.username || url.password) {
    throw new OutboundFetchError('Outbound URL credentials are not allowed.', 400);
  }

  if (!url.hostname) {
    throw new OutboundFetchError('Outbound URL host is required.', 400);
  }

  if (url.port && !isValidPort(url.port)) {
    throw new OutboundFetchError('Outbound URL port is invalid.', 400);
  }

  if (isBlockedHostname(url.hostname)) {
    throw new OutboundFetchError('Outbound URL host is not allowed.', 400);
  }

  return url;
}

export async function fetchOutboundUrl(
  rawUrl: string | URL,
  options: FetchOutboundUrlOptions = {},
): Promise<OutboundFetchResult> {
  const {
    fetchImpl = fetch,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes,
    allowedContentTypes,
    allowMissingContentType = false,
    ...requestInit
  } = options;

  let currentUrl = validateOutboundUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const response = await fetchOnce(fetchImpl, currentUrl, {
        ...requestInit,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (isRedirect(response.status)) {
        if (redirectCount === maxRedirects) {
          throw new OutboundFetchError('Outbound URL redirected too many times.', 508);
        }

        const location = response.headers.get('location');
        if (!location) {
          throw new OutboundFetchError('Outbound URL redirect is missing a location.', 502);
        }

        currentUrl = validateOutboundUrl(new URL(location, currentUrl));
        continue;
      }

      if (maxBytes !== undefined) {
        validateContentLength(response, maxBytes);
      }

      if (response.ok && allowedContentTypes) {
        validateContentType(response, allowedContentTypes, allowMissingContentType);
      }

      return { response, finalUrl: currentUrl };
    }
  } finally {
    clearTimeout(timeout);
  }

  throw new OutboundFetchError('Outbound URL redirected too many times.', 508);
}

export async function readResponseArrayBuffer(
  response: Response,
  maxBytes: number,
): Promise<ArrayBuffer> {
  validateContentLength(response, maxBytes);

  if (!response.body) {
    const body = await response.arrayBuffer();
    if (body.byteLength > maxBytes) {
      throw new OutboundFetchError('Outbound response is too large.', 413);
    }
    return body;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new OutboundFetchError('Outbound response is too large.', 413);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
}

export async function readResponseText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const body = await readResponseArrayBuffer(response, maxBytes);
  return new TextDecoder().decode(body);
}

async function fetchOnce(
  fetchImpl: FetchLike,
  url: URL,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchImpl(url.href, init);
  } catch (error) {
    if (isAbortError(error)) {
      throw new OutboundFetchError('Outbound request timed out.', 504);
    }
    throw new OutboundFetchError('Outbound request failed.', 502);
  }
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function isValidPort(port: string): boolean {
  const parsed = Number(port);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_SAFE_PORT;
}

function validateContentLength(response: Response, maxBytes: number): void {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) {
    throw new OutboundFetchError('Outbound response is too large.', 413);
  }
}

function validateContentType(
  response: Response,
  allowedContentTypes: readonly string[],
  allowMissingContentType: boolean,
): void {
  const header = response.headers.get('content-type');
  if (!header) {
    if (allowMissingContentType) return;
    throw new OutboundFetchError('Outbound response is missing a content type.', 415);
  }

  const actual = header.split(';', 1)[0].trim().toLowerCase();
  const allowed = allowedContentTypes.some((expected) => {
    const normalized = expected.toLowerCase();
    if (normalized.endsWith('/*')) {
      return actual.startsWith(normalized.slice(0, -1));
    }
    return actual === normalized;
  });

  if (!allowed) {
    throw new OutboundFetchError('Outbound response has an unsupported content type.', 415);
  }
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (BLOCKED_HOSTS.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (!host.includes('.') && !host.includes(':')) return true;

  return isBlockedIpv4(host) || isBlockedIpv6(host);
}

function isBlockedIpv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second, third] = parts;
  return first === 0
    || first === 10
    || first === 127
    || first >= 224
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0 && third === 0)
    || (first === 192 && second === 0 && third === 2)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113);
}

function isBlockedIpv6(host: string): boolean {
  if (!host.includes(':')) return false;

  const firstHextet = parseInt(host.split(':')[0] || '0', 16);
  if (!Number.isFinite(firstHextet)) return true;

  return host === '::'
    || host === '::1'
    || host.startsWith('::ffff:')
    || (firstHextet & 0xfe00) === 0xfc00
    || (firstHextet & 0xffc0) === 0xfe80
    || (firstHextet & 0xff00) === 0xff00;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
