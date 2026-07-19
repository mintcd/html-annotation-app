"use client";

import { useEffect, useState } from "react";
import Annotator from "@/components/Annotator";
import Loader from "@/components/Loader";
import {
  ensurePage,
  useSyncRows,
  useSyncRuntime,
  useSyncStatus,
} from "@/core/persistence";

type SitePageClientProps = {
  pageUrl: string;
  proxiedUrl: string;
  frameSiteId: string;
  frameStoragePath: string;
};

export default function SitePageClient({
  pageUrl,
  proxiedUrl,
  frameSiteId,
  frameStoragePath,
}: SitePageClientProps) {
  const sync = useSyncStatus();
  const runtime = useSyncRuntime();
  const page = useSyncRows("pages");
  const pageRow = page.data?.find((row) => row.url === pageUrl);
  const [createError, setCreateError] = useState<{ url: string; message: string }>();
  const currentCreateError = createError?.url === pageUrl ? createError.message : undefined;

  useEffect(() => {
    let active = true;

    if (page.loading || pageRow || sync.isSyncing) {
      return () => {
        active = false;
      };
    }

    void ensurePage(pageUrl, '', runtime).catch((error) => {
      if (!active) return;
      setCreateError({
        url: pageUrl,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return () => {
      active = false;
    };
  }, [page.loading, pageRow, runtime, sync.isSyncing, pageUrl]);

  if (page.loading || (!pageRow && sync.isSyncing))
    return <Loader />;

  if (page.error)
    return <PageError message={page.error} />;

  if (currentCreateError)
    return <PageError message={currentCreateError} />;

  if (!pageRow) return <Loader />;

  return (
    <Annotator
      pageId={String(pageRow.id)}
      pageUrl={pageUrl}
      iframeUrl={proxiedUrl}
      frameSiteId={frameSiteId}
      frameStoragePath={frameStoragePath}
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
