import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import {
  OutboundFetchError,
  fetchOutboundUrl,
  readResponseText,
  validateOutboundUrl,
} from "@/core/net/outboundFetch";
import { syncSessionFromRequest } from "@/core/persistence/syncIdentity";

export const runtime = "edge";

const MAX_HTML_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 7000;
const MAX_REDIRECTS = 5;
const METADATA_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type WebsiteMetadata = {
  title: string | null;
  logoUrl: string | null;
};

type LogoCandidate = {
  url: string;
  score: number;
};

class WebsiteMetadataError extends Error {
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
    return metadataResponse({ title: null, logoUrl: null }, 401);
  }

  let targetUrl: URL | undefined;
  try {
    targetUrl = readTargetUrl(request);
    const { html, pageUrl } = await fetchHtml(targetUrl);
    const metadata = extractMetadata(html, pageUrl);

    return metadataResponse(metadata);
  } catch (error) {
    if (error instanceof WebsiteMetadataError) {
      if (targetUrl && error.status >= 500) {
        return metadataResponse({
          title: null,
          logoUrl: fallbackIconUrl(targetUrl),
        });
      }

      return metadataResponse({ title: null, logoUrl: null }, error.status);
    }

    console.warn("Failed to fetch website metadata", error);
    return metadataResponse({ title: null, logoUrl: null }, 502);
  }
}

function readTargetUrl(request: Request): URL {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url")
    ?? requestUrl.searchParams.get("origin");

  if (!rawUrl) {
    throw new WebsiteMetadataError("Missing url.", 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    try {
      targetUrl = new URL(`https://${rawUrl}`);
    } catch {
      throw new WebsiteMetadataError("Invalid url.", 400);
    }
  }

  try {
    return validateOutboundUrl(targetUrl);
  } catch (error) {
    if (error instanceof OutboundFetchError) {
      throw new WebsiteMetadataError(error.message, error.status);
    }
    throw error;
  }
}

async function fetchHtml(targetUrl: URL): Promise<{ html: string; pageUrl: URL }> {
  try {
    const { response, finalUrl } = await fetchOutboundUrl(targetUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "upgrade-insecure-requests": "1",
        "user-agent": METADATA_USER_AGENT,
      },
      maxBytes: MAX_HTML_BYTES,
      maxRedirects: MAX_REDIRECTS,
      timeoutMs: FETCH_TIMEOUT_MS,
      allowedContentTypes: ["text/html", "application/xhtml+xml"],
      allowMissingContentType: true,
    });

    if (!response.ok) {
      throw new WebsiteMetadataError("Website metadata fetch failed.", 502);
    }

    return {
      html: await readResponseText(response, MAX_HTML_BYTES),
      pageUrl: finalUrl,
    };
  } catch (error) {
    if (error instanceof OutboundFetchError) {
      throw new WebsiteMetadataError(error.message, error.status);
    }
    throw error;
  }
}

function extractMetadata(html: string, pageUrl: URL): WebsiteMetadata {
  const $ = cheerio.load(html);
  const title = cleanText(
    metaContent($, 'meta[property="og:site_name"]')
    ?? metaContent($, 'meta[name="application-name"]')
    ?? metaContent($, 'meta[name="apple-mobile-web-app-title"]')
    ?? $("title").first().text()
    ?? metaContent($, 'meta[property="og:title"]')
  );

  return {
    title,
    logoUrl: findLogoUrl($, pageUrl, title),
  };
}

function findLogoUrl(
  $: cheerio.CheerioAPI,
  pageUrl: URL,
  siteTitle: string | null,
): string | null {
  const candidates: LogoCandidate[] = [];

  $("link[href]").each((_, element) => {
    const rel = String($(element).attr("rel") ?? "").toLowerCase();
    if (!rel) return;

    const href = $(element).attr("href");
    if (!href) return;

    if (rel.includes("apple-touch-icon")) {
      addCandidate(candidates, href, pageUrl, 120 + sizeScore($(element).attr("sizes")));
    } else if (rel.split(/\s+/).includes("icon") || rel.includes("shortcut icon")) {
      addCandidate(candidates, href, pageUrl, 80 + sizeScore($(element).attr("sizes")));
    } else if (rel.includes("mask-icon")) {
      addCandidate(candidates, href, pageUrl, 60);
    } else if (rel.split(/\s+/).includes("image_src")) {
      addCandidate(candidates, href, pageUrl, 55);
    }
  });

  addCandidate(candidates, metaContent($, 'meta[property="og:logo"]'), pageUrl, 110);
  addCandidate(candidates, metaContent($, 'meta[name="msapplication-TileImage"]'), pageUrl, 105);
  addCandidate(candidates, metaContent($, 'meta[name="twitter:image"]'), pageUrl, 55);
  addCandidate(candidates, metaContent($, 'meta[name="twitter:image:src"]'), pageUrl, 55);
  addCandidate(candidates, metaContent($, 'meta[itemprop="image"]'), pageUrl, 55);
  addCandidate(candidates, metaContent($, 'meta[property="og:image"]'), pageUrl, 40);

  addJsonLdCandidates($, candidates, pageUrl);
  addImageElementCandidates($, candidates, pageUrl, siteTitle);
  addInlineBackgroundCandidates($, candidates, pageUrl);
  addCandidate(candidates, fallbackIconUrl(pageUrl), pageUrl, 10);

  return candidates.sort((a, b) => b.score - a.score)[0]?.url ?? null;
}

function addCandidate(
  candidates: LogoCandidate[],
  rawUrl: string | null | undefined,
  pageUrl: URL,
  score: number,
): void {
  if (!rawUrl) return;

  try {
    const url = new URL(rawUrl, pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    const existing = candidates.find((candidate) => candidate.url === url.href);
    if (existing) existing.score = Math.max(existing.score, score);
    else candidates.push({ url: url.href, score });
  } catch {
    // Ignore malformed page metadata.
  }
}

function addJsonLdCandidates(
  $: cheerio.CheerioAPI,
  candidates: LogoCandidate[],
  pageUrl: URL,
): void {
  $('script[type="application/ld+json"]').each((_, element) => {
    const text = $(element).text().trim();
    if (!text) return;

    try {
      visitStructuredData(JSON.parse(text), (rawUrl, score) => {
        addCandidate(candidates, rawUrl, pageUrl, score);
      });
    } catch {
      // Invalid JSON-LD is common and should not block other candidates.
    }
  });
}

function visitStructuredData(
  value: unknown,
  addUrl: (rawUrl: string | undefined, score: number) => void,
  depth = 0,
): void {
  if (depth > 8 || value === null) return;

  if (Array.isArray(value)) {
    value.forEach((item) => visitStructuredData(item, addUrl, depth + 1));
    return;
  }

  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const typeText = jsonText(record["@type"]).toLowerCase();
  const likelySiteEntity = /\b(organization|website|blog|brand|localbusiness|corporation|person)\b/
    .test(typeText);

  if (likelySiteEntity) {
    addUrl(jsonImageUrl(record.logo), 130);
    addUrl(jsonImageUrl(record.image), 70);
  }

  addUrl(jsonImageUrl((record.publisher as Record<string, unknown> | undefined)?.logo), 90);

  Object.values(record).forEach((item) => visitStructuredData(item, addUrl, depth + 1));
}

function addImageElementCandidates(
  $: cheerio.CheerioAPI,
  candidates: LogoCandidate[],
  pageUrl: URL,
  siteTitle: string | null,
): void {
  $("img").each((_, element) => {
    const rawUrl = $(element).attr("src")
      ?? bestSrcsetUrl($(element).attr("srcset"));
    if (!rawUrl) return;

    const score = imageElementScore($, element, rawUrl, siteTitle);
    if (score >= 55) addCandidate(candidates, rawUrl, pageUrl, score);
  });
}

function addInlineBackgroundCandidates(
  $: cheerio.CheerioAPI,
  candidates: LogoCandidate[],
  pageUrl: URL,
): void {
  $("[style]").each((_, element) => {
    const style = $(element).attr("style") ?? "";
    const rawUrl = firstCssUrl(style);
    if (!rawUrl) return;

    const context = elementContext($, element).toLowerCase();
    if (!/(custom-logo|site-logo|logo|brand|site-branding|masthead|site-header)/.test(context)) {
      return;
    }

    addCandidate(candidates, rawUrl, pageUrl, 85);
  });
}

function imageElementScore(
  $: cheerio.CheerioAPI,
  element: Element,
  rawUrl: string,
  siteTitle: string | null,
): number {
  const context = elementContext($, element).toLowerCase();
  const rawUrlLower = rawUrl.toLowerCase();
  let score = 0;

  if (/(custom-logo|site-logo|logo|brand|site-branding|navbar-brand|site-title|masthead)/.test(context)) {
    score += 120;
  }
  if (/\b(header|site-header|banner)\b/.test(context)) score += 45;
  if (/(logo|icon|favicon|apple-touch|site-icon|cropped)/.test(rawUrlLower)) score += 45;
  if (/(avatar|comment|entry|post|article|content|attachment|wp-post-image|sidebar|widget|advert|ad-)/.test(context)) {
    score -= 80;
  }

  const alt = cleanText($(element).attr("alt"))?.toLowerCase();
  if (alt && siteTitle && titleTokens(siteTitle).some((token) => alt.includes(token))) {
    score += 25;
  }

  const width = numericAttribute($, element, "width");
  const height = numericAttribute($, element, "height");
  if (width && height) {
    const min = Math.min(width, height);
    const max = Math.max(width, height);
    if (max / min <= 1.5) score += 20;
    if (max <= 512) score += 20;
    if (max > 1000) score -= 35;
  }

  return score;
}

function elementContext($: cheerio.CheerioAPI, element: Element): string {
  const parts: string[] = [];
  let current = $(element);

  for (let depth = 0; depth < 5 && current.length; depth += 1) {
    const node = current[0];
    parts.push(node.tagName ?? "");
    for (const name of ["id", "class", "role", "aria-label", "alt", "title"]) {
      const value = current.attr(name);
      if (value) parts.push(value);
    }
    current = current.parent();
  }

  return parts.join(" ");
}

function bestSrcsetUrl(rawSrcset: string | undefined): string | undefined {
  if (!rawSrcset) return undefined;

  return rawSrcset
    .split(",")
    .map((candidate) => {
      const [url, descriptor] = candidate.trim().split(/\s+/, 2);
      const weight = descriptor?.endsWith("w")
        ? Number(descriptor.slice(0, -1))
        : descriptor?.endsWith("x")
          ? Number(descriptor.slice(0, -1)) * 1000
          : 0;
      return { url, weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((candidate) => candidate.url)
    .sort((a, b) => b.weight - a.weight)[0]?.url;
}

function firstCssUrl(style: string): string | undefined {
  const match = /url\((['"]?)(.*?)\1\)/i.exec(style);
  return match?.[2]?.trim();
}

function numericAttribute(
  $: cheerio.CheerioAPI,
  element: Element,
  name: string,
): number | undefined {
  const value = Number($(element).attr(name));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

function jsonText(value: unknown): string {
  if (Array.isArray(value)) return value.map(jsonText).join(" ");
  return typeof value === "string" ? value : "";
}

function jsonImageUrl(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(jsonImageUrl).find(Boolean);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return jsonImageUrl(record.url ?? record.contentUrl);
  }
  return undefined;
}

function metaContent($: cheerio.CheerioAPI, selector: string): string | undefined {
  return $(selector).first().attr("content")?.trim();
}

function cleanText(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text || null;
}

function sizeScore(rawSizes: string | undefined): number {
  if (!rawSizes || rawSizes.toLowerCase() === "any") return 0;

  return rawSizes
    .split(/\s+/)
    .reduce((best, size) => {
      const match = /^(\d+)x(\d+)$/i.exec(size);
      if (!match) return best;
      return Math.max(best, Math.min(Number(match[1]), Number(match[2])));
    }, 0);
}

function fallbackIconUrl(pageUrl: URL): string {
  return new URL("/favicon.ico", pageUrl).href;
}

function metadataResponse(metadata: WebsiteMetadata, status = 200): Response {
  return Response.json(metadata, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
