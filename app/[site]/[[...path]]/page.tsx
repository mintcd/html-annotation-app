import SitePageClient from "@/components/SitePageClient";

type Params = { site: string; path?: string[] };
type SearchParams = Record<string, string | string[] | undefined>;

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

  return (
    <SitePageClient
      site={resolvedParams.site}
      path={resolvedParams.path ? [...resolvedParams.path] : undefined}
      search={buildSearchParams(resolvedSearchParams)}
    />
  );
}
