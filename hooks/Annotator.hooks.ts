import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { findBestContentNode } from '../utils/dom';

export function useClickHref(
  contentRef: RefObject<HTMLElement | null>,
  onExternalHref: (href: string) => void
) {
  useEffect(() => {
    const el = contentRef?.current;
    if (!el) return;

    const onClick = (e: MouseEvent) => {
      // Only handle primary button clicks without modifier keys
      if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      const target = e.target as Element | null;
      if (!target) return;

      // Find nearest anchor
      const anchor = (target as Element).closest ? (target as Element).closest('a[href]') as HTMLAnchorElement | null : null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Ignore anchors that are javascript: or anchor links
      if (href.startsWith('javascript:') || href.startsWith('#')) return;

      try {
        // Resolve relative URLs against the document the element lives in
        const base = (target.ownerDocument as Document | null)?.location?.href || window.location.href;
        const linkUrl = new URL(href, base);

        // If same origin, let the browser handle it (includes all proxied /proxy/ links)
        if (linkUrl.origin === window.location.origin) return;

        // External link: notify by calling the callback
        e.preventDefault();
        onExternalHref(linkUrl.href);
      } catch (err) {
        // If URL parsing fails, don't intercept
        return;
      }
    };

    // If the element is an <iframe>, clicks inside it don't bubble to the parent
    // document - attach listener to the iframe's own contentDocument instead.
    if ((el as HTMLElement).tagName === 'IFRAME') {
      const iframe = el as HTMLIFrameElement;
      let attached = false;

      const attach = () => {
        const iDoc = iframe.contentDocument;
        if (!iDoc || attached) return;
        iDoc.addEventListener('click', onClick);
        attached = true;
      };

      const onLoad = () => {
        // Each navigation replaces contentDocument; re-attach each time.
        attached = false;
        attach();
      };

      iframe.addEventListener('load', onLoad);
      attach(); // in case the iframe is already loaded

      return () => {
        iframe.removeEventListener('load', onLoad);
        iframe.contentDocument?.removeEventListener('click', onClick);
      };
    }

    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [contentRef, onExternalHref]);
}

// 1) Update title
// 2) Set contentRef for range matching
// 3) Clear cookies banners
export function usePostprocessIframeRef(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  ready: boolean,
  title?: string,
) {
  const [postprocessed, setPostprocessed] = useState(false);
  const [docTitle, setDocTitle] = useState<string | null>(null);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const iframeBody = iframeRef?.current;
    const iframeTitle = iframeBody?.contentDocument?.title;
    if (!ready || !iframeBody || !iframeTitle) return;

    contentRef.current = findBestContentNode(iframeBody.contentDocument?.body ?? null);
    document.title = title || iframeTitle;

  }, [iframeRef, ready]);

  // Run cleanup only after the DOM has settled (ready === true).
  // Gating here ensures cleanupDoc mutations never reset the settle timer.
  useEffect(() => {
    if (!ready) return;
    const iframe = iframeRef?.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) { setPostprocessed(true); setDocTitle(null); return; }

    let observer: MutationObserver | null = null;

    const selectors = [
      'dialog.cc-banner[open]',
      'dialog[class*="cc-banner"]',
      '[data-cc-banner]',
      '[class*="cookie"]',
      '[id*="cookie"]',
      '[class*="consent"]',
      '[id*="consent"]',
      '[class*="gdpr"]',
      '[id*="gdpr"]',
      '.cc-banner',
      '.cookie-banner',
      '.cookie-consent',
      '.cookie-overlay',
    ];

    function tryRemove(el: Element | null) {
      if (!el) return;
      try {
        // If it's a <dialog>, try close() first for graceful dismissal.
        if (el instanceof HTMLDialogElement && typeof el.close === 'function') {
          try { el.close(); } catch { }
        }
        el.remove();
      } catch { }
    }

    function cleanupDoc(doc: Document | null, target?: Element | null) {
      if (!doc) return;
      try {
        const root: ParentNode = (target as ParentNode) ?? doc;

        // Remove matching banners within the targeted node
        for (const s of selectors) {
          root.querySelectorAll(s).forEach(el => tryRemove(el));
        }

        // Remove known overlays that block pointer events
        root.querySelectorAll('.cookie-overlay, .cc-overlay, .consent-overlay').forEach(el => tryRemove(el));

        // Clear inline styles that may disable scrolling on the document
        try { doc.documentElement.style.overflow = ''; } catch { }
        try { doc.body.style.overflow = ''; } catch { }
        // Remove modal-like classes on <html> or <body>
        ['modal-open', 'has-cookie-banner', 'no-scroll'].forEach(c => {
          doc.documentElement.classList.remove(c);
          doc.body.classList.remove(c);
        });
      } catch { }
    }

    // Prefer the best content node so we don't disturb UI chrome.
    const targetNode = findBestContentNode(doc.body) ?? doc.body ?? doc.documentElement;

    // Run initial cleanup now that the DOM is settled.
    cleanupDoc(doc, targetNode);
    setPostprocessed(true);
    try { setDocTitle(doc.title || null); } catch { setDocTitle(null); }

    // Observe for later CMP injections. Re-entrancy guard prevents cleanupDoc's
    // own mutations from re-firing the observer.
    let cleaning = false;
    observer = new MutationObserver(() => {
      if (cleaning) return;
      cleaning = true;
      cleanupDoc(doc, targetNode);
      cleaning = false;
    });
    try {
      observer.observe(targetNode, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch {
      observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    }

    // A few delayed cleanups for CMPs that inject after timers.
    const timeouts = [200, 800, 2000].map(t => window.setTimeout(() => cleanupDoc(doc, targetNode), t));
    (iframe as any)._postprocess_timeouts = timeouts;

    return () => {
      if (observer) { observer.disconnect(); observer = null; }
      const stored: number[] = (iframe as any)._postprocess_timeouts || [];
      stored.forEach(id => clearTimeout(id));
      (iframe as any)._postprocess_timeouts = [];
    };
  }, [iframeRef, ready]);
  return { contentRef: contentRef as RefObject<HTMLElement>, postprocessed, docTitle } as const;
}
