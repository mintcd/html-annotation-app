import { normalizeUrl } from "../../core/utils/url";
import type { AnnotationPage, PageGroup } from "./types";

export function toAbsoluteUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).href;
  } catch {
    try {
      return new URL(`https://${trimmed}`).href;
    } catch {
      return null;
    }
  }
}

export function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function getPageLocation(rawUrl: string): { host: string; path: string } {
  try {
    const url = new URL(rawUrl);
    return {
      host: url.hostname.replace(/^www\./, ""),
      path: `${url.pathname}${url.search}` || "/",
    };
  } catch {
    return { host: "Saved page", path: rawUrl };
  }
}

export function groupPagesBySite(pages: AnnotationPage[]): PageGroup[] {
  const map = new Map<string, PageGroup>();

  pages.forEach((page) => {
    let key = "other";
    let label = "Other";

    try {
      const url = new URL(page.url);
      key = url.origin;
      label = page.siteTitle || url.hostname.replace(/^www\./, "");
    } catch {
      // Keep invalid legacy rows visible rather than dropping them.
    }

    const existing = map.get(key);
    if (existing) {
      existing.pages.push(page);
      if (!existing.logoSrc && page.siteLogoSrc) existing.logoSrc = page.siteLogoSrc;
    } else {
      map.set(key, { key, label, logoSrc: page.siteLogoSrc, pages: [page] });
    }
  });

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      pages: [...group.pages].sort((a, b) => (
        String(b.uploadedAt).localeCompare(String(a.uploadedAt))
        || normalizeUrl(a.url).localeCompare(normalizeUrl(b.url))
      )),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
