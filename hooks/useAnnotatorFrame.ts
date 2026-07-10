"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { eq, useLiveQuery } from '@mintcd/sync-engine';
import { db } from '../utils/engine';
import { awaitDomSettled, findBestContentNode, trackScriptExecution } from '../utils/dom';
import { normalizeUrl } from '../utils/url';
import { refreshFrameBundle } from '../utils/frameCache';
import {
  ensurePage,
  getOrCreateWebsite,
  syncTimestamp,
} from '../utils/syncData';

const COOKIE_BANNER_SELECTORS = [
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

export type AnnotatorFrameOptions = {
  pageId: string;
  iframeUrl: string;
  initialTitle?: string;
  onExternalHref?: (href: string) => void;
};

function removeElement(element: Element | null) {
  if (!element) return;

  try {
    if (element.tagName.toLowerCase() === 'dialog') {
      try {
        (element as HTMLDialogElement).close?.();
      } catch {}
    }
    element.remove();
  } catch {}
}

function cleanupFrameDocument(doc: Document, target: Element | Document) {
  try {
    for (const selector of COOKIE_BANNER_SELECTORS) {
      target.querySelectorAll(selector).forEach(removeElement);
    }

    target
      .querySelectorAll('.cookie-overlay, .cc-overlay, .consent-overlay')
      .forEach(removeElement);

    try { doc.documentElement.style.overflow = ''; } catch {}
    try { doc.body.style.overflow = ''; } catch {}

    ['modal-open', 'has-cookie-banner', 'no-scroll'].forEach((className) => {
      doc.documentElement.classList.remove(className);
      doc.body?.classList.remove(className);
    });
  } catch {}
}

function startFrameDocumentPostprocessing(doc: Document): () => void {
  const target = doc.body
    ? findBestContentNode(doc.body)
    : doc.documentElement;
  cleanupFrameDocument(doc, target);

  let cleaning = false;
  const observer = new MutationObserver(() => {
    if (cleaning) return;
    cleaning = true;
    cleanupFrameDocument(doc, target);
    cleaning = false;
  });

  try {
    observer.observe(target, { childList: true, subtree: true, attributes: true, characterData: true });
  } catch {
    observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  }

  const timeouts = [200, 800, 2000].map((delay) => (
    window.setTimeout(() => cleanupFrameDocument(doc, target), delay)
  ));

  return () => {
    observer.disconnect();
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  };
}

export function useAnnotatorFrame({
  pageId,
  iframeUrl,
  initialTitle = '',
  onExternalHref,
}: AnnotatorFrameOptions) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const postprocessCleanupRef = useRef<(() => void) | null>(null);
  const frameLoadId = useRef(0);
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeError, setIframeError] = useState('');
  const [discoveredTitle, setDiscoveredTitle] = useState(initialTitle);

  const livePage = useLiveQuery(
    db.select().from('pages').where(eq('id', pageId)),
  );

  const title = livePage.data?.[0]?.title || discoveredTitle;

  const framePath = useMemo(() => {
    const parts = iframeUrl.replace(/^\/+frame\//, '').split('?')[0].split('/');
    return parts.slice(1).join('/');
  }, [iframeUrl]);

  useEffect(() => {
    document.title = title || 'Annotated page';
  }, [title]);

  useEffect(() => {
    if (!onExternalHref) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let attachedDocument: Document | null = null;

    const handleClick = (event: MouseEvent) => {
      if (
        event.button !== 0
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
      ) return;

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href]');
      const href = anchor?.getAttribute('href');
      if (!target || !href || href.startsWith('javascript:') || href.startsWith('#')) return;

      try {
        const base = target.ownerDocument.location?.href || window.location.href;
        const linkUrl = new URL(href, base);
        if (linkUrl.origin === window.location.origin) return;

        event.preventDefault();
        onExternalHref(linkUrl.href);
      } catch {}
    };

    const detach = () => {
      attachedDocument?.removeEventListener('click', handleClick);
      attachedDocument = null;
    };

    const attach = () => {
      const doc = iframe.contentDocument;
      if (!doc || doc === attachedDocument) return;
      detach();
      doc.addEventListener('click', handleClick);
      attachedDocument = doc;
    };

    iframe.addEventListener('load', attach);
    attach();

    return () => {
      iframe.removeEventListener('load', attach);
      detach();
    };
  }, [onExternalHref]);

  const stopFrameDocumentPostprocessing = useCallback(() => {
    postprocessCleanupRef.current?.();
    postprocessCleanupRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopFrameDocumentPostprocessing();
    };
  }, [stopFrameDocumentPostprocessing]);

  const handleFrameLoad = useCallback(async (
    event: SyntheticEvent<HTMLIFrameElement>,
  ) => {
    const iframe = event.currentTarget;
    const doc = iframe.contentDocument;
    if (!iframe.getAttribute('src') || !doc) return;

    const loadId = ++frameLoadId.current;
    stopFrameDocumentPostprocessing();
    contentRef.current = null;
    setIframeReady(false);
    setIframeError('');

    const frameError = doc
      .querySelector<HTMLMetaElement>('meta[name="frame-error"]')
      ?.content.trim();
    if (frameError) {
      setIframeError(frameError);
      return;
    }

    await awaitDomSettled(iframe);
    if (frameLoadId.current !== loadId || iframe.contentDocument !== doc) return;
    trackScriptExecution(iframe);

    if (!title) {
      const documentTitle = doc.title.trim();
      if (documentTitle) {
        setDiscoveredTitle(documentTitle);
        const existingPages = await db
          .select('id', 'title')
          .from('pages')
          .where(eq('id', pageId))
          .execute();

        if (existingPages[0]) {
          await db
            .update({ title: documentTitle, updated_at: syncTimestamp() })
            .from('pages')
            .where(eq('id', pageId))
            .execute();
        }
      }
    }

    if (frameLoadId.current !== loadId || iframe.contentDocument !== doc) return;

    const highlightStyleId = 'annotation-highlight-styles';
    if (!doc.getElementById(highlightStyleId)) {
      const style = doc.createElement('style');
      style.id = highlightStyleId;
      style.textContent = `
        .highlighted-text {
          cursor: pointer;
          padding-inline: 1px;
          border-radius: 2px;
        }
      `;
      doc.head.appendChild(style);
    }

    contentRef.current = doc.body ? findBestContentNode(doc.body) : doc.documentElement;
    postprocessCleanupRef.current = startFrameDocumentPostprocessing(doc);
    setIframeReady(true);
  }, [pageId, stopFrameDocumentPostprocessing, title]);

  const reportFrameError = useCallback((message = 'Failed to load page') => {
    stopFrameDocumentPostprocessing();
    contentRef.current = null;
    setIframeReady(false);
    setIframeError(message);
  }, [stopFrameDocumentPostprocessing]);

  const reloadFrame = useCallback(async () => {
    stopFrameDocumentPostprocessing();
    contentRef.current = null;
    setIframeReady(false);
    setIframeError('');
    if (!iframeRef.current) return;

    try {
      // Pasted HTML changes the page source, so a normal cache-first reload
      // would incorrectly keep showing the previous local copy.
      await refreshFrameBundle(iframeUrl, iframeRef.current);
    } catch (error) {
      setIframeError(error instanceof Error ? error.message : 'Failed to reload page');
    }
  }, [iframeUrl, stopFrameDocumentPostprocessing]);

  const openInAnnotator = useCallback(async (href: string) => {
    const normalized = normalizeUrl(href);
    await ensurePage(normalized);

    const url = new URL(normalized);
    const website = await getOrCreateWebsite(url.origin);
    const pathname = url.pathname === '/' ? '' : url.pathname;
    window.location.href = `/${website.id}${pathname}${url.search}`;
  }, []);

  const openOriginal = useCallback((href: string) => {
    window.open(href, '_blank', 'noopener');
  }, []);

  return {
    contentRef,
    framePath,
    handleFrameLoad,
    iframeError,
    iframeReady,
    iframeRef,
    openInAnnotator,
    openOriginal,
    reloadFrame,
    reportFrameError,
    title,
  };
}
