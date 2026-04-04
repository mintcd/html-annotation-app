import { useEffect, useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import { matchedRange, highlightRange, rangeToHtml, findBestContentNode } from '../utils/dom';
import { getPage } from '../utils/api.client';

type RangeResult = {
  id: string;
  snippet: string;
  success: boolean;
  message?: string;
};

/**
 * Tracks an iframe's load lifecycle using the `proxy:script-executed` signal
 * injected into every cloned script by clone.ts.
 *
 * Strategy:
 *  - On each `load` event, fetch `number_of_scripts` from the pages table.
 *  - If the stored count > 0: finish as soon as that many signals have fired
 *    (early-exit, same as the old useScriptExecutionTracker).
 *  - If the stored count is 0 (first visit or unknown): use a 500 ms quiet
 *    timer that resets on every signal, then finish after silence.
 *  - Hard ceiling: 10 s.
 *
 * After range matching succeeds (`notifyMatchSuccess`) the observed signal
 * count is written back to the DB if the stored count was 0.
 */
export function useIframeTracking(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  pageUrl: string,
): {
  // contentRef: RefObject<HTMLElement>;
  iframeReady: boolean;
  notifyMatchSuccess: (title?: string) => void;
  frameError: string | null;
  clearFrameError: () => void;
} {
  // const contentRef = useRef<HTMLElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);

  // Persisted state across loads within the same pageUrl session.
  const remoteScriptCountRef = useRef<number | null>(null); // null = fetch not done yet
  const executedScriptsRef = useRef(0);
  const notifyCalledRef = useRef(false);
  const pageTitleRef = useRef<string>('');

  // Fetch the stored script count.
  useEffect(() => {
    getPage(pageUrl)
      .then(page => {
        remoteScriptCountRef.current = page.number_of_scripts ?? 0;
        pageTitleRef.current = page.title ?? '';
      })
  }, [pageUrl]);

  // Attach to each new iframe document after load.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const onLoad = () => {
      // Detect frame-error meta tag early and expose it to callers.
      try {
        const errMsg = iframe.contentDocument?.querySelector('meta[name="frame-error"]')?.getAttribute('content') ?? null;
        setFrameError(errMsg);
      } catch {
        // ignore cross-origin access errors or other DOM issues
      }
      console.log(`[IframeTracking] iframe loaded, remoteScriptCount=${remoteScriptCountRef.current ?? 'pending'}`);

      const iWin = iframe.contentWindow;
      if (!iWin) { return; }

      const SIGNAL_QUIET = 500;   // ms of silence after last signal → done
      const MAX_WAIT = 10000; // hard ceiling

      // Scripts execute during parsing, before the `load` event, so their
      // `proxy:script-executed` events are already gone by the time we attach
      // a listener.  The snippet also pushes each payload onto
      // `window.__proxy_script_executed`, so we can recover the pre-load count.
      const preLoaded = ((iWin as unknown as Record<string, unknown>).__proxy_script_executed as unknown[] | undefined)?.length ?? 0;
      let signalCount = preLoaded;
      console.log(`[IframeTracking] pre-load signals already recorded: ${preLoaded}`);

      let quietTimer: ReturnType<typeof setTimeout>;
      let maxTimer: ReturnType<typeof setTimeout>;
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(quietTimer);
        clearTimeout(maxTimer);
        iWin.removeEventListener('proxy:script-executed', onSignal);
        executedScriptsRef.current = signalCount;
        console.log(`[IframeTracking] scripts done (${signalCount}), waiting for DOM to settle…`);

        const DOM_SETTLE_MS = 5000; // ms of silence after last mutation → ready
        const DOM_MAX_MS = 10000;  // hard ceiling for settle phase
        // Grace period before the settle clock starts. Async renderers like
        // MathJax v2 schedule typesetting via setTimeout(0) after scripts run,
        // so there's a window between "scripts done" and "first DOM mutation"
        // where the settle timer would fire prematurely. The grace period ensures
        // the MutationObserver is already resetting the timer by the time it ticks.
        const DOM_GRACE_MS = 1000;

        const body = iframe.contentDocument?.body;
        if (!body) { return; }

        let settleTimer: ReturnType<typeof setTimeout>;
        let domMaxTimer: ReturnType<typeof setTimeout>;

        const declare = () => {
          clearTimeout(settleTimer);
          clearTimeout(domMaxTimer);
          observer.disconnect();
          console.log('[IframeTracking] DOM settled, ready');
          setIframeReady(true);
        };

        const observer = new (iWin as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver(() => {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(declare, DOM_SETTLE_MS);
        });

        observer.observe(body, { childList: true, subtree: true, attributes: true, characterData: true });
        domMaxTimer = setTimeout(declare, DOM_MAX_MS);
        // Start the settle clock only after the grace period, giving async renderers
        // time to begin mutating the DOM so the observer can take over from there.
        setTimeout(() => {
          settleTimer = setTimeout(declare, DOM_SETTLE_MS);
        }, DOM_GRACE_MS);

        // console.log((iWin as unknown as Record<string, unknown>).__proxy_script_executed)
      };

      const onSignal = (ev: Event) => {
        signalCount++;
        const detail = (ev as CustomEvent).detail as { id?: string; url?: string } | undefined;
        const label = detail?.id ?? detail?.url ?? `signal-${signalCount}`;
        console.log(`[IframeTracking] script signal ${signalCount}/${remoteScriptCountRef.current ?? '?'}: ${label}`);
        const expected = remoteScriptCountRef.current;
        // Early exit when we've seen every script we previously counted.
        if (expected !== null && expected > 0 && signalCount >= expected) {
          console.log(`[IframeTracking] reached expected count (${expected}), finishing`);
          finish();
          return;
        }
        // Only slide the quiet timer when the expected count is unknown.
        // When we know how many scripts to expect and haven't reached the count
        // yet, wait for the count (or MAX_WAIT) rather than a silence window —
        // dynamically-loaded scripts (e.g. MathJax extensions) can arrive more
        // than 500 ms after the previous signal.
        if (!expected || expected === 0) {
          clearTimeout(quietTimer);
          quietTimer = setTimeout(finish, SIGNAL_QUIET);
        }
      };

      iWin.addEventListener('proxy:script-executed', onSignal);

      // Check early-exit immediately using the pre-load count.
      const expected = remoteScriptCountRef.current;
      if (expected !== null && expected > 0 && signalCount >= expected) {
        console.log(`[IframeTracking] all ${expected} scripts already recorded pre-load, finishing`);
        finish();
        return;
      }

      maxTimer = setTimeout(finish, MAX_WAIT);
      // Only start the quiet timer when expected count is unknown.
      // When we know the expected count, wait for it (or MAX_WAIT).
      if (!expected || expected === 0) {
        quietTimer = setTimeout(finish, SIGNAL_QUIET);
      }
    };

    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [iframeRef, pageUrl]);

  // When range matching succeeds, write back the observed script
  const notifyMatchSuccess = useCallback((title?: string) => {
    if (notifyCalledRef.current) return; // already called this session
    notifyCalledRef.current = true;
    const resolvedTitle = title || pageTitleRef.current;

    const scriptCount = executedScriptsRef.current > 0
      ? executedScriptsRef.current
      : (remoteScriptCountRef.current ?? 0);
    // createOrUpdatePage({ url: pageUrl, title: resolvedTitle, numberOfScripts: scriptCount })
  }, [pageUrl]);

  const clearFrameError = useCallback(() => setFrameError(null), []);

  return { iframeReady, notifyMatchSuccess, frameError, clearFrameError };
}

export function useRangeMatching(
  contentRef: RefObject<HTMLElement | null>,
  annotations: AnnotationItem[] | undefined,
  ready: boolean,
  pageUrl: string,
) {
  const [rangeResults, setRangeResults] = useState<RangeResult[]>([]);
  const [renderedHtmlMap, setRenderedHtmlMap] = useState<Record<string, string>>({});
  const [isMatching, setIsMatching] = useState(false);
  const pendingMatchesRef = useRef(0);
  // Track which annotations have been successfully matched to avoid re-matching
  const matchedAnnotationIdsRef = useRef<Set<string>>(new Set());
  // Track the last ready state and annotation set to prevent duplicate runs
  const lastProcessedRef = useRef<{ ready: boolean; annotationIds: string[] }>({ ready: false, annotationIds: [] });

  function updateRangeResult(id: string, patch: Partial<RangeResult>) {
    setRangeResults(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) {
        return [...prev, { id, snippet: patch.snippet ?? '', success: patch.success ?? false, message: patch.message }];
      }
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  useEffect(() => {
    if (!ready) return;
    const container = contentRef.current;
    if (!container) return;
    if (!annotations || annotations.length === 0) return;

    // Check if we should skip this matching run
    const currentAnnotationIds = annotations.map(a => a.id).sort();
    const lastAnnotationIds = lastProcessedRef.current.annotationIds;
    const sameAnnotations = currentAnnotationIds.length === lastAnnotationIds.length &&
      currentAnnotationIds.every((id, idx) => id === lastAnnotationIds[idx]);

    // Skip if we've already processed these exact annotations when ready was true
    if (lastProcessedRef.current.ready && sameAnnotations) {
      return;
    }

    // Update tracking
    lastProcessedRef.current = { ready, annotationIds: currentAnnotationIds };

    // Only clear data for annotations that are no longer in the list
    const currentIds = new Set(currentAnnotationIds);
    setRenderedHtmlMap(prev => {
      const filtered: Record<string, string> = {};
      for (const id of Object.keys(prev)) {
        if (currentIds.has(id)) {
          filtered[id] = prev[id];
        }
      }
      return filtered;
    });

    // Only keep results for current annotations
    setRangeResults(prev => {
      const filtered = prev.filter(r => currentIds.has(r.id));

      // For annotations that are already matched but don't have results yet, add them
      const existingResultIds = new Set(filtered.map(r => r.id));
      const alreadyMatchedWithoutResults = annotations
        .filter(a => matchedAnnotationIdsRef.current.has(a.id) && !existingResultIds.has(a.id))
        .map(a => ({
          id: a.id,
          snippet: a.text.substring(0, 120),
          success: true,
          message: 'Already matched'
        }));

      return [...filtered, ...alreadyMatchedWithoutResults];
    });

    // Only match annotations that haven't been successfully matched yet
    const annotationsToMatch = annotations.filter(a => !matchedAnnotationIdsRef.current.has(a.id));

    if (annotationsToMatch.length === 0) {
      // All annotations already matched
      setIsMatching(false);
      return;
    }

    // Set isMatching to true when starting
    setIsMatching(true);
    pendingMatchesRef.current = annotationsToMatch.length;

    // DOM stability is guaranteed by useIframeTracking before iframeReady is set;
    // match ranges immediately.
    annotationsToMatch.forEach(ann => {
      const tryRestore = () => {
        const range = matchedRange(container, ann.text);
        const html = rangeToHtml(range);
        if (range) {
          highlightRange(range, ann.color || '#ffff00', ann.id);
          // Mark as successfully matched
          matchedAnnotationIdsRef.current.add(ann.id);
          try {
            setRenderedHtmlMap(prev => ({ ...prev, [ann.id]: html }));
            updateRangeResult(ann.id, { success: true, snippet: ann.text.substring(0, 120), message: 'Restored' });
          } catch (err) {
            // still mark success, but note failure to render HTML
            updateRangeResult(ann.id, { success: true, snippet: ann.text.substring(0, 120), message: 'Restored (rangeToHtml failed)' });
          }
        } else {
          const msg = `Could not restore highlight. Container content length: ${container.innerHTML.length}`;
          updateRangeResult(ann.id, { success: false, snippet: ann.text.substring(0, 120), message: msg });
        }

        // Decrement pending matches counter
        pendingMatchesRef.current--;
        if (pendingMatchesRef.current <= 0) {
          setIsMatching(false);
        }
      };

      tryRestore();
    });
  }, [ready, annotations, contentRef]);

  // Reset tracking when pageUrl changes (new page)
  useEffect(() => {
    matchedAnnotationIdsRef.current.clear();
    lastProcessedRef.current = { ready: false, annotationIds: [] };
    setRangeResults([]);
    setRenderedHtmlMap({});
  }, [pageUrl]);

  const allMatched = (annotations || []).every(a => {
    const r = rangeResults.find(rr => rr.id === a.id);
    return !!(r && r.success === true);
  });

  const annotationsWithRendered = (annotations || []).map(a => ({
    ...a,
    html: renderedHtmlMap[a.id] ?? a.html,
  }));
  return { rangeResults, allMatched, isMatching, matchedAnnotations: annotationsWithRendered } as const;
}

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

        // If same origin, let the browser handle it (includes all proxied /_proxy/ links)
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
