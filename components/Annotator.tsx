"use client";

import { useRef, useCallback, useState, type RefObject } from 'react';
import { useClickHref } from '../hooks/Annotator.hooks';
import { AnnotationContext } from '../context/Annotator.context';
import Sidebar from './Sidebar';
import MenuOnRange from './MenuOnRange';
import MenuOnFocus from './MenuOnFocus';
import PromptBox from './PromptBox';
import PasteHTML from './PasteHTML';
import annotationStyles from "../styles/Annotator.styles";
import Loader from './Loader';
import { getPage, updatePage } from '@/utils/api.client';
import { findBestContentNode, awaitDomSettled, trackScriptExecution } from '@/utils/dom';
import { highlightAnnotations } from '@/utils/annotations';

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

  // Parse site and path from iframeUrl: /_frame/<site>/<path...>
  const iframePathParts = iframeUrl.replace(/^\/+_frame\//, '').split('?')[0].split('/');
  const contentRef = useRef<HTMLElement>(null);

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const closeModal = useCallback(() => setPendingHref(null), []);

  const openAnnotator = useCallback((href: string) => {
    const annotatorUrl = new URL('/annotation', window.location.origin);
    annotatorUrl.searchParams.set('url', href);
    window.open(annotatorUrl.toString(), '_blank', 'noopener');
    closeModal();
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

    if (title === '') {
      const docTitle = iframe.contentDocument?.title ?? '';
      console.log("No stored title, using document title", docTitle);
      // Only update the page if it already exists; Dashboard creates pages.
      (async () => {
        const existing = await getPage(pageUrl);
        if (existing) await updatePage({ url: pageUrl, title: docTitle });
      })();
    }

    await awaitDomSettled(iframe);
    trackScriptExecution(iframe);

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

  return (
    <>
      <iframe
        id="annotated-frame"
        onLoad={(e) => initAnnotatedPage(e)}
        onError={(e) => {
          setIframeError("Failed to load page");
          setShowPasteHTML(true);
        }}
        ref={iframeRef}
        src={iframeUrl}
        style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
        title={title || 'Annotated page'}
      />
      <AnnotationContext
        initialAnnotations={annotations}
        title={title}
        pageUrl={pageUrl}
        contentRef={contentRef as React.RefObject<HTMLElement>}
        iframeRef={iframeRef as React.RefObject<HTMLIFrameElement>}
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
