"use client";

import { useRef, useCallback, useState, type RefObject, useEffect } from 'react';
import { useClickHref } from '../hooks/Annotator.hooks';
import { AnnotationContext } from '../context/Annotator.context';
import Sidebar from './Sidebar';
import MenuOnRange from './MenuOnRange';
import MenuOnFocus from './MenuOnFocus';
import PromptBox from './PromptBox';
import PasteHTML from './PasteHTML';
import annotationStyles from "../styles/Annotator.styles";
import Loader from './Loader';
import repository from '../utils/repository';
import { eq } from '../utils/QueryBuilder';
import { findBestContentNode, awaitDomSettled, trackScriptExecution } from '@/utils/dom';
import { normalizeUrl, originToSlug } from '@/utils/url';
import { highlightAnnotations } from '@/utils/annotations';
import ClientFrame from './ClientFrame';

type AnnotatorProps = {
  annotations: Annotation[];
  title: string;
  pageUrl: string;
  iframeUrl: string;
}

export default function Annotator({ annotations, title, pageUrl, iframeUrl }: AnnotatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showPasteHTML, setShowPasteHTML] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeError, setIframeError] = useState("");
  const [_title, setTitle] = useState(title);

  // Parse site and path from iframeUrl: /_frame/<site>/<path...>
  const iframePathParts = iframeUrl.replace(/^\/+_frame\//, '').split('?')[0].split('/');
  const contentRef = useRef<HTMLElement>(null);

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const closeModal = useCallback(() => setPendingHref(null), []);

  const openAnnotator = useCallback(async (href: string) => {
    const normalized = normalizeUrl(href);

    // Ensure page exists; create if missing
    const pages: any[] = await repository.select('id', 'url').from('pages').where(eq('url', normalized));
    if (!pages || pages.length === 0) {
      await repository.insert({ url: normalized, title: '', number_of_scripts: 0, created_at: Date.now(), updated_at: Date.now() }).from('pages');
    }

    // Ensure website (site slug) exists
    const origin = new URL(normalized).origin;
    let websites: any[] = await repository.select('id', 'origin').from('websites').where(eq('origin', origin));
    let website = websites && websites.length ? websites[0] : null;
    if (!website) {
      const slug = originToSlug(origin);
      await repository.insert({ id: slug, origin, created_at: Date.now(), updated_at: Date.now() }).from('websites');
      websites = await repository.select('id', 'origin').from('websites').where(eq('origin', origin));
      website = websites[0];
    }
    const site = website.id;

    const pathname = new URL(normalized).pathname; // e.g. '/' or '/path/to/page'
    const pathPart = pathname === '/' ? '' : pathname;
    const search = new URL(normalized).search || '';

    const appPath = `/${site}${pathPart}${search}`;
    window.location.href = appPath;
  }, [closeModal]);

  const openOriginal = useCallback((href: string) => {
    window.open(href, '_blank', 'noopener');
    closeModal();
  }, [closeModal]);

  useClickHref(iframeRef as RefObject<HTMLElement | null>, setPendingHref);

  const handlePasteHTML = useCallback(() => setShowPasteHTML(true), []);

  async function initAnnotatedPage(e: React.SyntheticEvent<HTMLIFrameElement>) {
    const iframe = e.currentTarget;
    console.log("Iframe loaded");

    // Wait for the frame DOM and scripts to settle before reading the document title.
    await awaitDomSettled(iframe);
    trackScriptExecution(iframe);

    // If there is no stored title, try to use the document's title.
    // Only set state and persist to DB when the document title is non-empty (avoid overwriting with blank).
    if (title === '') {
      const docTitle = (iframe.contentDocument?.title ?? '').trim();
      console.log("No stored title, using document title", docTitle);
      if (docTitle !== '') {
        setTitle(docTitle);

        // Only update the page if it already exists; Dashboard creates pages.
        const pages: any[] = await repository.select('id', 'title').from('pages').where(eq('url', pageUrl));
        const existing = pages && pages.length ? pages[0] : null;
        if (existing) await repository.update({ title: docTitle }).from('pages').where(eq('url', pageUrl));
        console.log("Updated page title in DB");
      } else {
        console.log('Document title empty; skipping DB update to avoid erasing stored title.');
      }
    }

    const id = 'annotation-highlight-styles';
    const doc = iframe.contentDocument as Document;
    if (!doc.getElementById(id)) {
      const styleEl = doc.createElement('style');
      styleEl.id = id;
      styleEl.textContent = `
          .highlighted-text {
            cursor: pointer;
            padding-left: 1px;
            padding-right: 1px;
          }
        `;
      doc.head.appendChild(styleEl);

    }

    contentRef.current = findBestContentNode(iframe.contentDocument?.body as HTMLElement);
    highlightAnnotations(annotations, contentRef.current);
    setIframeReady(true);
  }

  useEffect(() => {
    document.title = _title ?? "Annotated page";
  }, [_title]);

  return (
    <>
      <ClientFrame
        frameUrl={iframeUrl}
        frameRef={iframeRef}
        iframeProps={{
          id: 'annotated-frame',
          onLoad: (e: React.SyntheticEvent<HTMLIFrameElement>) => initAnnotatedPage(e),
          onError: (e: React.SyntheticEvent<HTMLIFrameElement>) => {
            setIframeError('Failed to load page');
            setShowPasteHTML(true);
          },
          style: { width: '100%', height: '100vh', border: 'none', display: 'block' },
        }}
      />
      <AnnotationContext
        initialAnnotations={annotations}
        title={_title}
        pageUrl={pageUrl}
        contentRef={contentRef as React.RefObject<HTMLElement>}
        iframeRef={iframeRef as React.RefObject<HTMLIFrameElement>}
        iframeUrl={iframeUrl}
        iframeReady={iframeReady}
      >
        <Sidebar onPasteHTML={handlePasteHTML} />
        <MenuOnRange />
        <MenuOnFocus />
      </AnnotationContext>

      {pendingHref && (
        <PromptBox
          message={(
            <>
              <div style={annotationStyles.promptTitle}>Open external link</div>
              <div style={annotationStyles.promptDescription}>You are about to open an external page <em>{pendingHref}</em>. Would you like to open it in the Annotator or open the original page?</div>
            </>
          )}
          actions={[
            { label: 'Annotate', action: () => openAnnotator(pendingHref), variant: 'primary' },
            { label: 'Open original', action: () => openOriginal(pendingHref), variant: 'secondary' },
            { label: 'Cancel', action: closeModal, variant: 'neutral' },
          ]}
          onClose={closeModal}
        />
      )}

      {!iframeReady && <Loader />}

      {iframeError && !showPasteHTML && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 40, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
          Page failed to load.{' '}
          <button
            style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => setShowPasteHTML(true)}
          >
            Paste HTML
          </button>
        </div>
      )}

      {showPasteHTML && (
        <PasteHTML
          error={iframeError}
          site={pageUrl}
          path={iframePathParts.slice(1).join('/')}
          onSuccess={() => {
            setShowPasteHTML(false);
            setIframeError("");
            if (iframeRef.current) iframeRef.current.src = iframeUrl;
          }}
          onClose={() => setShowPasteHTML(false)}
        />
      )}
    </>
  );
}
