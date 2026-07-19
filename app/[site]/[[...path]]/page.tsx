import SitePageClient from "@/components/SitePageClient";
import { headers } from "next/headers";
import { syncSessionFromHeaderValues } from "@/core/persistence/syncIdentity";
import {
  findSyncStateRow,
  readSyncStreamState,
} from "@/core/persistence/syncServerState";
import { normalizeUrl } from "@/core/utils/url";

type Params = { site: string; path?: string[] };
type SearchParams = Record<string, string | string[] | undefined>;
type WebsiteRow = { origin: string };

export const runtime = "edge";
export const dynamic = "force-dynamic";

function buildSearchParams(searchParams: SearchParams): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }

  const search = params.toString();
  return search ? `?${search}` : "";
}

function validateSiteId(site: string): string | null {
  const siteId = site.trim();
  if (!/^[A-Za-z0-9-]+$/.test(siteId)) {
    return null;
  }
  return siteId;
}

function buildCleanPathname(path: string[] | undefined): { pathname: string } | { error: string } {
  if (!path?.length) return { pathname: "/" };

  const segments: string[] = [];
  for (const segment of path) {
    if (
      !segment
      || segment === "."
      || segment === ".."
      || /[\/\\]/.test(segment)
      || /[\u0000-\u001F\u007F]/.test(segment)
    ) {
      return { error: "The requested page path is invalid." };
    }
    segments.push(encodeURIComponent(segment));
  }

  return { pathname: `/${segments.join("/")}` };
}

function cleanOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function resolveAnnotatorRoute({
  site,
  path,
  search,
}: {
  site: string;
  path?: string[];
  search: string;
}): Promise<
  | {
      ok: true;
      pageUrl: string;
      proxiedUrl: string;
      frameSiteId: string;
      frameStoragePath: string;
    }
  | { ok: false; message: string }
> {
  const requestHeaders = await headers();
  const session = syncSessionFromHeaderValues(
    requestHeaders.get("x-html-annotation-user-id"),
    requestHeaders.get("cookie"),
  );
  const siteId = validateSiteId(site);
  if (!siteId) return { ok: false, message: "The requested site is invalid." };

  const pathResult = buildCleanPathname(path);
  if ("error" in pathResult) return { ok: false, message: pathResult.error };

  const state = await readSyncStreamState(session);
  const row = findSyncStateRow<WebsiteRow>(state, "websites", "id", siteId);

  if (!row) return { ok: false, message: `Unknown site: ${siteId}` };

  const origin = cleanOrigin(row.origin);
  if (!origin) return { ok: false, message: "The stored site origin is invalid." };

  try {
    const targetUrl = new URL(`${pathResult.pathname}${search}`, origin);
    const pageUrl = new URL(normalizeUrl(targetUrl.href));
    const framePath = pageUrl.pathname === "/" ? "" : pageUrl.pathname;
    const frameStoragePath = path?.length ? path.join("/") : "";

    return {
      ok: true,
      pageUrl: pageUrl.href,
      proxiedUrl: `/frame/${encodeURIComponent(siteId)}${framePath}${pageUrl.search}`,
      frameSiteId: siteId,
      frameStoragePath,
    };
  } catch {
    return { ok: false, message: "The requested page URL is invalid." };
  }
}

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  // Vinext currently resolves dynamic params to an object with a null
  // prototype. Normalize both route inputs before crossing the RSC boundary.
  const resolvedParams = { ...(await params) };
  const resolvedSearchParams = { ...(await searchParams) };
  const resolvedRoute = await resolveAnnotatorRoute({
    site: resolvedParams.site,
    path: resolvedParams.path ? [...resolvedParams.path] : undefined,
    search: buildSearchParams(resolvedSearchParams),
  });

  if (!resolvedRoute.ok) {
    return <PageError message={resolvedRoute.message} />;
  }

  return (
    <SitePageClient
      pageUrl={resolvedRoute.pageUrl}
      proxiedUrl={resolvedRoute.proxiedUrl}
      frameSiteId={resolvedRoute.frameSiteId}
      frameStoragePath={resolvedRoute.frameStoragePath}
    />
  );
}

function PageError({ message }: { message: string }) {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Unable to open annotated page</h1>
      <p>{message}</p>
    </main>
  );
}
