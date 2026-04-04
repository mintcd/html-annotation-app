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
import { findBestContentNode } from '@/utils/dom';
import { awaitDomSettled } from '@/utils/dom';
import { highlightAnnotations } from '@/utils/annotations';

type AnnotatorProps = {
  annotations: AnnotationItem[];
  title: string;
  remoteScriptCount: number;
  pageUrl: string;
  iframeUrl: string;
}

export default function Annotator({ annotations, title, remoteScriptCount, pageUrl, iframeUrl }: AnnotatorProps) {
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

    trackScriptExecution(iframe, remoteScriptCount);
    await awaitDomSettled(iframe);
    // Ensure highlight styles exist inside the iframe document (iframe has its own DOM)

    const id = 'annotation-highlight-styles';
    const doc = iframe.contentDocument;
    if (doc && !doc.getElementById(id)) {
      const styleEl = doc.createElement('style');
      styleEl.id = id;
      styleEl.textContent = `
          .highlighted-text {
            cursor: pointer;
            padding-left: 1px;
            padding-right: 1px;
            border-radius: 3px;
          }
        `;
      doc.head?.appendChild(styleEl);

    }

    highlightAnnotations(annotations, iframe.contentDocument?.body as HTMLElement);
    contentRef.current = findBestContentNode(iframe.contentDocument?.body as HTMLElement);
    setIframeReady(true);
  }

  function trackScriptExecution(iframe: HTMLIFrameElement, remoteScriptCount: number) {
    console.log("Remote script count", remoteScriptCount);
    const iWin = iframe.contentWindow as (Window & { __proxy_script_executed?: string[] });
    const IDLE_MS = 2000; // wait this long with no new events to conclude
    let idleTimer: number | null = null;
    let cleanedUp = false;

    const cleanup = (handler?: EventListener) => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (handler) iWin.removeEventListener('proxy:script-executed', handler);
      if (idleTimer) window.clearTimeout(idleTimer);
    };

    const conclude = () => {
      cleanup(onExec);
      const executed = iWin.__proxy_script_executed ?? [];
      console.log('Concluding - executed scripts:', executed.length);
      // If this page had no recorded script count, write back the observed count.
      if (remoteScriptCount === 0) {
        // Only update the page's script count if the page already exists; Dashboard creates pages.
        (async () => {
          const existing = await getPage(pageUrl);
          if (existing) await updatePage({ url: pageUrl, numberOfScripts: executed.length });
        })();
      }
    };

    const scheduleIdle = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(conclude, IDLE_MS);
    };

    const onExec: EventListener = () => {
      const executed = iWin.__proxy_script_executed ?? [];
      if (remoteScriptCount > 0 && executed.length >= remoteScriptCount) {
        conclude();
        return;
      }
      // otherwise, reset idle timer and wait for no-more-events window
      scheduleIdle();
    };

    // Start listening and also start a fallback idle timer in case no events fire
    iWin.addEventListener('proxy:script-executed', onExec);
    scheduleIdle();

    // cleanup if iframe navigates/reloads
    const onFrameUnload = () => cleanup(onExec);
    iframe.addEventListener('load', onFrameUnload);
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
