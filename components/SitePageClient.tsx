"use client";

import { useEffect, useMemo, useState } from "react";
import { eq, useLiveQuery, useSyncStatus } from "@mintcd/sync-engine";
import Annotator from "@/components/Annotator";
import Loader from "@/components/Loader";
import { db } from "@/utils/engine";
import { generatePageId } from "@/utils/api-helpers";
import { normalizeUrl, appPathToPageUrl } from "@/utils/url";

type SitePageClientProps = {
  site: string;
  path?: string[];
  search: string;
};

export default function SitePageClient({ site, path, search }: SitePageClientProps) {
  const sync = useSyncStatus();
  const website = useLiveQuery(
    db.select().from("websites").where(eq("id", site)),
  );
  const row = website.data?.[0];

  if (website.loading || (!row && sync.isSyncing)) return <Loader />;
  if (website.error) return <PageError message={website.error} />;
  if (!row) return <PageError message={`Unknown site: ${site}`} />;

  return <ResolvedSitePage site={site} path={path} search={search} origin={row.origin} />;
}

function ResolvedSitePage({
  site,
  path,
  search,
  origin,
}: SitePageClientProps & { origin: string }) {
  const url = useMemo(
    () => normalizeUrl(appPathToPageUrl(origin, path, search)),
    [origin, path, search],
  );
  const [pageId, setPageId] = useState<string>();

  useEffect(() => {
    let active = true;
    void generatePageId(url).then((id) => {
      if (active) setPageId(id);
    });
    return () => {
      active = false;
    };
  }, [url]);

  if (!pageId) return <Loader />;

  const framePathname = path?.length ? path.join("/") : "";
  const frameUrl = `/_frame/${site}${framePathname ? `/${framePathname}` : ""}${search}`;

  return <Annotator pageId={pageId} pageUrl={url} iframeUrl={frameUrl} />;
}

function PageError({ message }: { message: string }) {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Unable to open annotated page</h1>
      <p>{message}</p>
    </main>
  );
}
