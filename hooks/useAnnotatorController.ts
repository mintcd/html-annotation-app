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
import { awaitDomSettled, trackScriptExecution } from '../utils/dom';
import { normalizeUrl } from '../utils/url';
import { highlightAnnotations } from '../utils/annotations';
import { refreshFrameBundle } from '../utils/frameCache';
import {
  ensurePage,
  getOrCreateWebsite,
  normalizeAnnotationRow,
  syncTimestamp,
} from '../utils/syncData';

export type AnnotatorControllerOptions = {
  pageId: string;
  pageUrl: string;
  iframeUrl: string;
  initialAnnotations?: Annotation[];
  initialTitle?: string;
};

export function useAnnotatorController({
  pageId,
  pageUrl,
  iframeUrl,
  initialAnnotations = [],
  initialTitle = '',
}: AnnotatorControllerOptions) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const initialHighlightsApplied = useRef(false);
  const frameLoadId = useRef(0);
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeError, setIframeError] = useState('');
  const [discoveredTitle, setDiscoveredTitle] = useState(initialTitle);

  const liveAnnotations = useLiveQuery(db.select().from('annotations'));
  const livePage = useLiveQuery(
    db.select().from('pages').where(eq('id', pageId)),
  );

  const annotations = useMemo(
    () => liveAnnotations.data
      ? liveAnnotations.data
        .map((row) => normalizeAnnotationRow(row as unknown as Record<string, unknown>))
        .filter((annotation) => annotation.page_id === pageId || annotation.page_id === pageUrl)
      : initialAnnotations,
    [initialAnnotations, liveAnnotations.data, pageId, pageUrl],
  );
  const title = livePage.data?.[0]?.title || discoveredTitle;

  const framePath = useMemo(() => {
    const parts = iframeUrl.replace(/^\/+_frame\//, '').split('?')[0].split('/');
    return parts.slice(1).join('/');
  }, [iframeUrl]);

  useEffect(() => {
    document.title = title || 'Annotated page';
  }, [title]);

  const handleFrameLoad = useCallback(async (
    event: SyntheticEvent<HTMLIFrameElement>,
  ) => {
    const iframe = event.currentTarget;
    const doc = iframe.contentDocument;
    if (!iframe.getAttribute('src') || !doc) return;

    const loadId = ++frameLoadId.current;
    initialHighlightsApplied.current = false;
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

    contentRef.current = doc.body;
    setIframeReady(true);
  }, [pageId, title]);

  useEffect(() => {
    if (
      !iframeReady
      || liveAnnotations.loading
      || initialHighlightsApplied.current
      || !contentRef.current
    ) return;

    initialHighlightsApplied.current = true;
    void highlightAnnotations(annotations, contentRef.current);
  }, [annotations, iframeReady, liveAnnotations.loading]);

  const reportFrameError = useCallback((message = 'Failed to load page') => {
    setIframeReady(false);
    setIframeError(message);
  }, []);

  const reloadFrame = useCallback(async () => {
    setIframeReady(false);
    setIframeError('');
    initialHighlightsApplied.current = false;
    if (!iframeRef.current) return;

    try {
      // Pasted HTML changes the page source, so a normal cache-first reload
      // would incorrectly keep showing the previous local copy.
      await refreshFrameBundle(iframeUrl, iframeRef.current);
    } catch (error) {
      setIframeError(error instanceof Error ? error.message : 'Failed to reload page');
    }
  }, [iframeUrl]);

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
    annotations,
    contentRef,
    framePath,
    handleFrameLoad,
    iframeError,
    iframeReady,
    iframeRef,
    liveAnnotationsLoading: liveAnnotations.loading,
    openInAnnotator,
    openOriginal,
    reloadFrame,
    reportFrameError,
    title,
  };
}
