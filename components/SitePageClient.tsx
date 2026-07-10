"use client";

import { useEffect, useMemo, useState } from "react";
import { eq, useLiveQuery, useSyncStatus } from "@mintcd/sync-engine";
import Annotator from "@/components/Annotator";
import Loader from "@/components/Loader";
import { db } from "@/utils/engine";
import { normalizeUrl, appPathToPageUrl } from "@/utils/url";
import { ensurePage } from "@/utils/syncData";

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
  const sync = useSyncStatus();
  const url = useMemo(
    () => normalizeUrl(appPathToPageUrl(origin, path, search)),
    [origin, path, search],
  );
  const page = useLiveQuery(db.select().from("pages").where(eq("url", url)));
  const pageRow = page.data?.[0];
  const [createError, setCreateError] = useState<string>();

  useEffect(() => {
    let active = true;
    setCreateError(undefined);

    if (page.loading || pageRow || sync.isSyncing) {
      return () => {
        active = false;
      };
    }

    void ensurePage(url).catch((error) => {
      if (!active) return;
      setCreateError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      active = false;
    };
  }, [page.loading, pageRow, sync.isSyncing, url]);

  if (page.loading || (!pageRow && sync.isSyncing)) return <Loader />;
  if (page.error) return <PageError message={page.error} />;
  if (createError) return <PageError message={createError} />;
  if (!pageRow) return <Loader />;

  const framePathname = path?.length ? path.join("/") : "";
  const frameUrl = `/_frame/${site}${framePathname ? `/${framePathname}` : ""}${search}`;

  return <Annotator pageId={String(pageRow.id)} pageUrl={url} iframeUrl={frameUrl} />;
}

function PageError({ message }: { message: string }) {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Unable to open annotated page</h1>
      <p>{message}</p>
    </main>
  );
}
