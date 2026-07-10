"use client";
import React, { useEffect, useRef } from "react";
import { ensureFrameCacheReady } from '../utils/frameCache';

type ClientFrameProps = {
  frameUrl: string;
  preload?: boolean;
  className?: string;
  iframeProps?: React.IframeHTMLAttributes<HTMLIFrameElement>;
  frameRef?: React.RefObject<HTMLIFrameElement | null>;
};

export default function ClientFrame({ frameUrl, preload = true, className, iframeProps, frameRef }: ClientFrameProps) {
  const internalRef = useRef<HTMLIFrameElement | null>(null);
  const iframeRef = frameRef || internalRef;
  const { onLoad, ...restIframeProps } = iframeProps ?? {};

  const handleLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    // An iframe without a src emits an initial load event for about:blank.
    // The real src is assigned after preloading, so do not report that empty
    // document as ready to consumers.
    if (!event.currentTarget.getAttribute('src')) return;
    onLoad?.(event);
  };

  useEffect(() => {
    let cancelled = false;


    async function loadFrame() {
      if (iframeRef.current === null) return;
      // The worker captures the real requests made by the iframe, including
      // scripts, CSS imports, fonts, and dynamic images. There is no separate
      // HTML fetch, so the first visit no longer downloads the page twice.
      if (preload) await ensureFrameCacheReady();
      if (!cancelled && iframeRef.current) iframeRef.current.src = frameUrl;
    }

    void loadFrame();
    return () => { cancelled = true; };
  }, [frameUrl, preload, iframeRef]);

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <iframe
        ref={iframeRef}
        style={{ width: '100%', height: '100%', border: 0 }}
        sandbox="allow-scripts allow-same-origin allow-forms"
        {...restIframeProps}
        onLoad={handleLoad}
      />
    </div>
  );
}
