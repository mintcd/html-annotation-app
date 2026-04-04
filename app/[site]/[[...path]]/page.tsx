import Annotator from "@/components/Annotator";
import { getWebsiteBySlug, loadAnnotationsForPage, getPageFromServer } from "@/utils/api.server";
import { normalizeUrl, appPathToPageUrl } from "@/utils/url";
import { notFound } from "next/navigation";

type Params = { site: string; path?: string[] };
type SearchParams = Record<string, string | string[] | undefined>;

/** Re-serialize Next.js searchParams as a query string. */
function buildSearch(sp: SearchParams): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((val) => params.append(k, val));
    else if (v !== undefined) params.set(k, v);
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { site, path } = await params;
  const search = buildSearch(await searchParams);

  const website = await getWebsiteBySlug(site);
  if (!website) return { title: "Not Found 2" };
  const url = appPathToPageUrl(website.origin, path, search);
  const { title } = await getPageFromServer(url);
  const fallback = new URL(url).hostname.replace(/^www\./, '');
  return { title: title ?? `Annotating ${fallback}` };
}

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { site, path } = await params;
  const search = buildSearch(await searchParams);

  const website = await getWebsiteBySlug(site);
  if (!website) notFound();

  // Reconstruct the original URL and strip tracking params
  const url = normalizeUrl(appPathToPageUrl(website.origin, path, search));
  const framePathname = path?.length ? path.join('/') : '';
  const frameUrl = `/_frame/${site}${framePathname ? '/' + framePathname : ''}${search}`;
  const annotations = await loadAnnotationsForPage(url);
  const { title, numberOfScripts } = await getPageFromServer(url);

  return (
    <Annotator
      annotations={annotations}
      title={title ?? ''}
      remoteScriptCount={numberOfScripts}
      pageUrl={url}
      iframeUrl={frameUrl}
    />
  )
}
