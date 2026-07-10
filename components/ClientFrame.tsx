"use client";
import React, { useEffect, useRef, useState } from "react";

type ClientFrameProps = {
  frameUrl: string;
  preload?: boolean;
  className?: string;
  iframeProps?: React.IframeHTMLAttributes<HTMLIFrameElement>;
  frameRef?: React.RefObject<HTMLIFrameElement | null>;
};

const MAX_CONCURRENCY = 6;

function toAbsolute(resource: string, base: string) {
  if (!resource) return resource;
  if (/^(data:|blob:|http|https|\/\/)/i.test(resource)) {
    if (resource.startsWith('//')) return window.location.protocol + resource;
    return resource;
  }
  try {
    return new URL(resource, window.location.origin + base).href;
  } catch {
    return resource;
  }
}

export default function ClientFrame({ frameUrl, preload = true, className, iframeProps, frameRef }: ClientFrameProps) {
  const internalRef = useRef<HTMLIFrameElement | null>(null);
  const iframeRef = (iframeProps && (iframeProps as any).ref) || (frameRef as any) || internalRef;
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

    async function prefetchAndLoad() {
      if (!preload) {
        if (iframeRef.current) iframeRef.current.src = frameUrl;
        return;
      }

      try {
        const res = await fetch(frameUrl, { credentials: 'omit' });
        if (!res.ok) {
          if (!cancelled && iframeRef.current) iframeRef.current.src = frameUrl;
          return;
        }
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const resourceSet = new Set<string>();
        const add = (u?: string | null) => {
          if (!u) return;
          if (u.startsWith('data:') || u.startsWith('blob:')) return;
          const abs = toAbsolute(u, frameUrl);
          if (abs) resourceSet.add(abs);
        };

        doc.querySelectorAll('link[rel="stylesheet"]').forEach(l => add(l.getAttribute('href')));
        doc.querySelectorAll('img').forEach(i => add(i.getAttribute('src')));
        doc.querySelectorAll('[srcset]').forEach(el => {
          const ss = el.getAttribute('srcset') || '';
          ss.split(',').map(p => p.trim().split(' ')[0]).forEach(part => add(part));
        });
        doc.querySelectorAll('link[rel~="icon"]').forEach(l => add(l.getAttribute('href')));
        doc.querySelectorAll('audio,video,source').forEach(el => add((el as HTMLSourceElement).getAttribute('src')));

        // Inline style url() references
        doc.querySelectorAll('[style]').forEach(el => {
          const s = el.getAttribute('style') || '';
          const re = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(s))) {
            add(m[2]);
          }
        });

        const resources = Array.from(resourceSet);

        const cache = await caches.open('frames-cache-v1');

        let idx = 0;
        async function worker() {
          while (idx < resources.length) {
            const i = idx++;
            const url = resources[i];
            try {
              const r = await fetch(url, { credentials: 'omit' });
              if (r && r.ok) {
                try { await cache.put(url, r.clone()); } catch (e) { /* ignore */ }
              }
            } catch (e) { /* ignore per resource */ }
          }
        }

        const runners = Array(Math.min(MAX_CONCURRENCY, resources.length)).fill(null).map(() => worker());
        await Promise.all(runners);

        if (!cancelled && iframeRef.current) iframeRef.current.src = frameUrl;
      } catch (e) {
        if (!cancelled && iframeRef.current) iframeRef.current.src = frameUrl;
      }
    }

    prefetchAndLoad();
    return () => { cancelled = true; };
  }, [frameUrl, preload]);

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <iframe
        ref={iframeRef as any}
        style={{ width: '100%', height: '100%', border: 0 }}
        sandbox="allow-scripts allow-same-origin allow-forms"
        {...restIframeProps}
        onLoad={handleLoad}
      />
    </div>
  );
}
