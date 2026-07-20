"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefCallback,
} from 'react';
import { highlightBoundingRect, removeHighlights } from '../dom';
import {
  applyReadingMode,
  applyFrameDarkMode,
  framePathFromUrl,
  prepareFrameDocument,
  startExternalLinkInterceptor,
} from '../../frame/runtime';
import {
  ensurePage,
  ensureWebsiteAvailableForRoute,
  getOrCreateWebsite,
  syncTimestamp,
  updatePageRow,
  useSyncRows,
  useSyncRuntime,
  type AppSyncRuntime,
} from '../../persistence';
import { ensureFrameCacheReady, refreshFrameBundle } from '../../frame/cache';
import { normalizeUrl } from '../../utils/url';
import { applyAnnotationHighlights, type AnnotationHighlightFailure } from './highlights';
import { shouldAdoptPreparedPageTitle, storedPageTitle } from './title';

export type AnnotationSessionOptions = {
  pageId: string;
  pageUrl: string;
  iframeUrl: string;
  initialTitle?: string;
  onExternalHref?: (href: string) => void;
};

export type AnnotationSession = {
  frame: HTMLIFrameElement | null;
  document: Document | null;
  root: HTMLElement | null;
  ready: boolean;
  error: string;
  title: string;
  framePath: string;
  attachFrame: RefCallback<HTMLIFrameElement>;
  reportFrameError: (message?: string) => void;
  reloadFrame: () => Promise<void>;
  openInAnnotator: (href: string) => Promise<void>;
  openOriginal: (href: string) => void;
  readingMode: boolean;
  setReadingMode: (enabled: boolean) => void;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  applyAnnotations: (annotations: Annotation[]) => Promise<void>;
  removeHighlight: (id: string) => void;
  updateHighlightColor: (id: string, color: string) => void;
  scrollToHighlight: (id: string) => void;
  getHighlightRect: (id: string) => DOMRect | null;
};
export type AnnotationSessionResult = AnnotationSession & {
  frameSourceUrl?: string;
};

type SessionSnapshot = {
  frame: HTMLIFrameElement | null;
  document: Document | null;
  root: HTMLElement | null;
  ready: boolean;
  error: string;
};

const EMPTY_SNAPSHOT: SessionSnapshot = {
  frame: null,
  document: null,
  root: null,
  ready: false,
  error: '',
};

const MATCH_RETRY_DEBOUNCE_MS = 150;
const MATCH_FINAL_IDLE_MS = 1500;
const MATCH_MAX_DURATION_MS = 10000;
const READING_MODE_STORAGE_KEY = 'anno.readingMode';
const DARK_MODE_STORAGE_KEY = 'anno.darkMode';
const MATCH_MUTATION_ATTRIBUTES = ['class', 'style', 'hidden', 'aria-hidden', 'data-mathml'];
const MEANINGFUL_MUTATION_ATTRIBUTES = new Set(MATCH_MUTATION_ATTRIBUTES);
const ANNOTATOR_OWNED_SELECTOR = [
  '#annotation-highlight-styles',
  'span.highlighted-text[data-highlight-id]',
].join(',');
const NON_CONTENT_SELECTOR = 'script, style, noscript, template';

function initialReadingMode(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(READING_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function initialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function elementForNode(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement;
}

function matchesSelector(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function isAnnotatorOwnedNode(node: Node): boolean {
  const element = elementForNode(node);
  if (!element) return false;

  try {
    return Boolean(element.closest(ANNOTATOR_OWNED_SELECTOR));
  } catch {
    return false;
  }
}

function isNonContentElement(element: Element): boolean {
  return matchesSelector(element, NON_CONTENT_SELECTOR);
}

function nodeHasIndexableContent(node: Node): boolean {
  if (isAnnotatorOwnedNode(node)) return false;
  if (node.nodeType === Node.TEXT_NODE) {
    return Boolean(node.nodeValue?.trim());
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return false;

  const element = node as Element;
  if (isNonContentElement(element)) return false;
  return Boolean(element.textContent?.trim());
}

function isMeaningfulAnnotationMutation(mutation: MutationRecord): boolean {
  if (mutation.type === 'characterData') {
    return nodeHasIndexableContent(mutation.target);
  }

  if (mutation.type === 'childList') {
    return [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]
      .some(nodeHasIndexableContent);
  }

  if (mutation.type === 'attributes') {
    const attributeName = mutation.attributeName;
    if (!attributeName || !MEANINGFUL_MUTATION_ATTRIBUTES.has(attributeName)) return false;

    const element = elementForNode(mutation.target);
    if (!element || isAnnotatorOwnedNode(element) || isNonContentElement(element)) return false;
    if (attributeName === 'data-mathml') return true;
    return Boolean(element.textContent?.trim());
  }

  return false;
}

function reportUnmatchedAnnotations(failures: AnnotationHighlightFailure[]) {
  if (failures.length === 0) return;

  console.warn('Annotation recovery finished with unmatched annotations:', failures.map(({ annotation, error }) => ({
    id: annotation.id,
    reason: error instanceof Error ? error.message : String(error),
  })));
}

function escapeAttrValue(value: string): string {
  const esc = (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS?.escape;
  return esc ? esc(value) : value.replace(/["\\]/g, "\\$&");
}

export function useAnnotationSession({
  pageId,
  pageUrl,
  iframeUrl,
  initialTitle = '',
  onExternalHref,
}: AnnotationSessionOptions): AnnotationSessionResult {
  const runtime = useSyncRuntime();
  const livePages = useSyncRows('pages');
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(EMPTY_SNAPSHOT);
  const [discoveredTitle, setDiscoveredTitle] = useState('');
  const [loadedFrameSource, setLoadedFrameSource] = useState<{ requestUrl: string; sourceUrl: string } | null>(null);
  const [readingMode, setReadingModeState] = useState(initialReadingMode);
  const [darkMode, setDarkModeState] = useState(initialDarkMode);
  const attachedFrameRef = useRef<HTMLIFrameElement | null>(null);
  const frameLoadCleanupRef = useRef<(() => void) | null>(null);
  const documentCleanupRef = useRef<(() => void) | null>(null);
  const readingModeCleanupRef = useRef<(() => void) | null>(null);
  const darkModeCleanupRef = useRef<(() => void) | null>(null);
  const annotationMatchCleanupRef = useRef<(() => void) | null>(null);
  const annotationMatchIdRef = useRef(0);
  const frameLoadIdRef = useRef(0);
  const handleFrameLoadRef = useRef<(iframe: HTMLIFrameElement) => Promise<void>>(async () => undefined);

  const livePage = useMemo(
    () => livePages.data?.find((page) => page.id === pageId),
    [livePages.data, pageId],
  );
  const initialStoredTitle = storedPageTitle(initialTitle);
  const persistedTitle = livePage
    ? storedPageTitle(livePage.title)
    : initialStoredTitle;
  const title = persistedTitle || discoveredTitle;
  const titleRef = useRef(title);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    document.title = title || 'Annotated page';
  }, [title]);

  const hasCurrentFrameSource = loadedFrameSource?.requestUrl === iframeUrl;
  const frameSourceUrl = hasCurrentFrameSource
    ? loadedFrameSource.sourceUrl
    : undefined;
  const activeDocument = hasCurrentFrameSource ? snapshot.document : null;
  const activeRoot = hasCurrentFrameSource ? snapshot.root : null;
  const activeReady = hasCurrentFrameSource && snapshot.ready;
  const activeError = hasCurrentFrameSource ? snapshot.error : '';

  const setReadingMode = useCallback((enabled: boolean) => {
    setReadingModeState(enabled);
  }, []);

  const setDarkMode = useCallback((enabled: boolean) => {
    setDarkModeState(enabled);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(READING_MODE_STORAGE_KEY, readingMode ? 'true' : 'false');
    } catch {}
  }, [readingMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DARK_MODE_STORAGE_KEY, darkMode ? 'true' : 'false');
    } catch {}
  }, [darkMode]);

  useEffect(() => {
    if (!darkMode) return;

    const root = document.documentElement;
    const previousTheme = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'dark');

    return () => {
      if (previousTheme === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previousTheme);
    };
  }, [darkMode]);

  useEffect(() => {
    readingModeCleanupRef.current?.();
    readingModeCleanupRef.current = null;

    if (!readingMode || !activeDocument || !activeRoot) return;

    const cleanup = applyReadingMode(activeDocument, activeRoot);
    readingModeCleanupRef.current = cleanup;

    return () => {
      if (readingModeCleanupRef.current === cleanup) {
        readingModeCleanupRef.current = null;
        cleanup();
      }
    };
  }, [activeDocument, activeRoot, readingMode]);

  useEffect(() => {
    darkModeCleanupRef.current?.();
    darkModeCleanupRef.current = null;

    if (!darkMode || !activeDocument || !activeRoot) return;

    const cleanup = applyFrameDarkMode(activeDocument, activeRoot);
    darkModeCleanupRef.current = cleanup;

    return () => {
      if (darkModeCleanupRef.current === cleanup) {
        darkModeCleanupRef.current = null;
        cleanup();
      }
    };
  }, [activeDocument, activeRoot, darkMode]);

  const disposeAnnotationMatching = useCallback(() => {
    annotationMatchIdRef.current++;
    annotationMatchCleanupRef.current?.();
    annotationMatchCleanupRef.current = null;
  }, []);

  const disposeReadingMode = useCallback(() => {
    readingModeCleanupRef.current?.();
    readingModeCleanupRef.current = null;
  }, []);

  const disposeDarkMode = useCallback(() => {
    darkModeCleanupRef.current?.();
    darkModeCleanupRef.current = null;
  }, []);

  const disposeDocumentSession = useCallback(() => {
    disposeAnnotationMatching();
    disposeDarkMode();
    disposeReadingMode();
    documentCleanupRef.current?.();
    documentCleanupRef.current = null;
  }, [disposeAnnotationMatching, disposeDarkMode, disposeReadingMode]);

  const clearDocumentSnapshot = useCallback((error = '') => {
    disposeDocumentSession();
    setSnapshot((previous) => ({
      ...previous,
      document: null,
      root: null,
      ready: false,
      error,
    }));
  }, [disposeDocumentSession]);

  useEffect(() => {
    let cancelled = false;

    frameLoadIdRef.current++;
    disposeDocumentSession();

    async function loadFrameSource() {
      try {
        // The worker captures iframe requests, including scripts, CSS imports,
        // fonts, and dynamic images. There is no separate HTML fetch, so the
        // first visit no longer downloads the page twice.
        await ensureFrameCacheReady();
        if (!cancelled) setLoadedFrameSource({ requestUrl: iframeUrl, sourceUrl: iframeUrl });
      } catch (error) {
        if (!cancelled) {
          setSnapshot((previous) => ({
            ...previous,
            document: null,
            root: null,
            ready: false,
            error: error instanceof Error ? error.message : 'Failed to prepare the page frame.',
          }));
        }
      }
    }

    void loadFrameSource();
    return () => { cancelled = true; };
  }, [disposeDocumentSession, iframeUrl]);

  const handleFrameLoad = useCallback(async (iframe: HTMLIFrameElement) => {
    const doc = iframe.contentDocument;
    if (!iframe.getAttribute('src') || !doc) return;

    const loadId = ++frameLoadIdRef.current;
    clearDocumentSnapshot('');

    const prepared = await prepareFrameDocument(iframe);
    const stale = () => (
      frameLoadIdRef.current !== loadId
      || attachedFrameRef.current !== iframe
      || iframe.contentDocument !== doc
    );

    if ('error' in prepared) {
      if (prepared.error && !stale()) {
        setSnapshot((previous) => ({
          ...previous,
          frame: iframe,
          document: null,
          root: null,
          ready: false,
          error: prepared.error,
        }));
      }
      return;
    }

    if (stale()) {
      prepared.cleanup();
      return;
    }

    const preparedTitle = prepared.title.trim();
    const page = await ensurePage(pageUrl, titleRef.current || preparedTitle, runtime);

    if (stale()) {
      prepared.cleanup();
      return;
    }

    const storedTitle = storedPageTitle(page.title);
    if (shouldAdoptPreparedPageTitle(storedTitle, preparedTitle)) {
      setDiscoveredTitle(preparedTitle);
    }

    if (preparedTitle && !storedTitle) {
      if (page.title !== preparedTitle) {
        await updatePageRow(String(page.id), {
          title: preparedTitle,
          updated_at: syncTimestamp(),
        }, runtime);
      }
    }

    if (stale()) {
      prepared.cleanup();
      return;
    }

    documentCleanupRef.current = prepared.cleanup;
    setSnapshot({
      frame: iframe,
      document: prepared.document,
      root: prepared.root,
      ready: true,
      error: '',
    });
  }, [clearDocumentSnapshot, pageUrl, runtime]);

  useEffect(() => {
    handleFrameLoadRef.current = handleFrameLoad;
  }, [handleFrameLoad]);

  const attachFrame = useCallback<RefCallback<HTMLIFrameElement>>((frame) => {
    if (attachedFrameRef.current === frame) return;

    frameLoadCleanupRef.current?.();
    frameLoadCleanupRef.current = null;
    attachedFrameRef.current = frame;
    frameLoadIdRef.current++;
    disposeDocumentSession();

    if (!frame) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }

    setSnapshot({
      frame,
      document: null,
      root: null,
      ready: false,
      error: '',
    });

    const onLoad = () => {
      void handleFrameLoadRef.current(frame);
    };
    frame.addEventListener('load', onLoad);
    frameLoadCleanupRef.current = () => frame.removeEventListener('load', onLoad);

    if (frame.getAttribute('src')) {
      void handleFrameLoadRef.current(frame);
    }
  }, [disposeDocumentSession]);

  useEffect(() => {
    const doc = snapshot.document;
    if (!doc || !onExternalHref) return;
    return startExternalLinkInterceptor(doc, onExternalHref, { sourcePageUrl: pageUrl });
  }, [onExternalHref, pageUrl, snapshot.document]);

  useEffect(() => {
    return () => {
      frameLoadCleanupRef.current?.();
      frameLoadCleanupRef.current = null;
      disposeDocumentSession();
    };
  }, [disposeDocumentSession]);

  const reportFrameError = useCallback((message = 'Failed to load page') => {
    frameLoadIdRef.current++;
    clearDocumentSnapshot(message);
  }, [clearDocumentSnapshot]);

  const reloadFrame = useCallback(async () => {
    frameLoadIdRef.current++;
    clearDocumentSnapshot('');

    const frame = attachedFrameRef.current;
    if (!frame) return;

    try {
      await refreshFrameBundle(iframeUrl, frame);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reload page';
      setSnapshot((previous) => ({ ...previous, ready: false, error: message }));
    }
  }, [clearDocumentSnapshot, iframeUrl]);

  const openInAnnotator = useCallback(async (href: string) => {
    const normalized = normalizeUrl(href);
    await ensurePage(normalized, '', runtime);

    const url = new URL(normalized);
    const website = await getOrCreateWebsite(url.origin, runtime);
    await ensureWebsiteAvailableForRoute(website);
    const pathname = url.pathname === '/' ? '' : url.pathname;
    window.location.href = `/${website.id}${pathname}${url.search}`;
  }, [runtime]);

  const openOriginal = useCallback((href: string) => {
    window.open(href, '_blank', 'noopener');
  }, []);

  const applyAnnotations = useCallback(async (annotations: Annotation[]) => {
    const root = activeRoot;
    if (!root) return;
    const contentRoot = root;

    disposeAnnotationMatching();
    if (annotations.length === 0) return;

    const matchId = ++annotationMatchIdRef.current;
    const loadId = frameLoadIdRef.current;
    let failed = annotations;
    let lastFailures: AnnotationHighlightFailure[] = [];
    let observer: MutationObserver | null = null;
    let retryTimer: number | null = null;
    let finalIdleTimer: number | null = null;
    let maxTimer: number | null = null;
    let activeMatch: Promise<void> | null = null;
    let finalized = false;
    let disposed = false;

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const clearFinalIdleTimer = () => {
      if (finalIdleTimer !== null) {
        window.clearTimeout(finalIdleTimer);
        finalIdleTimer = null;
      }
    };

    const clearMaxTimer = () => {
      if (maxTimer !== null) {
        window.clearTimeout(maxTimer);
        maxTimer = null;
      }
    };

    const cleanup = () => {
      disposed = true;
      observer?.disconnect();
      observer = null;
      clearRetryTimer();
      clearFinalIdleTimer();
      clearMaxTimer();
      if (annotationMatchCleanupRef.current === cleanup) {
        annotationMatchCleanupRef.current = null;
      }
    };

    const isCurrent = () => (
      !disposed
      && annotationMatchIdRef.current === matchId
      && frameLoadIdRef.current === loadId
      && contentRoot.isConnected
    );

    const observe = () => {
      if (!observer || !isCurrent() || failed.length === 0) return;

      try {
        observer.observe(contentRoot, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: MATCH_MUTATION_ATTRIBUTES,
        });
      } catch (error) {
        console.warn('Annotation recovery observer failed:', error);
        void finalize();
      }
    };

    async function runMatch() {
      if (!isCurrent() || failed.length === 0) return;
      if (activeMatch) return activeMatch;

      activeMatch = (async () => {
        observer?.disconnect();

        const result = await applyAnnotationHighlights(
          failed,
          contentRoot,
          runtime as AppSyncRuntime,
          { logFailures: false },
        );
        if (!isCurrent()) return;

        lastFailures = result.failed;
        failed = result.failed.map(({ annotation }) => annotation);

        if (failed.length === 0) {
          cleanup();
          return;
        }

        observe();
      })();

      try {
        await activeMatch;
      } finally {
        activeMatch = null;
      }
    }

    function scheduleFinalIdle() {
      if (!isCurrent() || finalized) return;
      clearFinalIdleTimer();
      finalIdleTimer = window.setTimeout(() => {
        finalIdleTimer = null;
        void finalize();
      }, MATCH_FINAL_IDLE_MS);
    }

    function scheduleRetry() {
      if (!isCurrent() || finalized || failed.length === 0) return;

      clearRetryTimer();
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void runMatch();
      }, MATCH_RETRY_DEBOUNCE_MS);
      scheduleFinalIdle();
    }

    async function finalize() {
      if (!isCurrent() || finalized) return;
      finalized = true;
      clearRetryTimer();
      clearFinalIdleTimer();

      await runMatch();
      if (!isCurrent()) return;

      reportUnmatchedAnnotations(lastFailures);
      cleanup();
    }

    annotationMatchCleanupRef.current = cleanup;

    await runMatch();
    if (!isCurrent() || failed.length === 0) return;

    observer = new MutationObserver((mutations) => {
      if (!isCurrent() || failed.length === 0) return;
      if (mutations.some(isMeaningfulAnnotationMutation)) scheduleRetry();
    });
    observe();
    scheduleFinalIdle();
    maxTimer = window.setTimeout(() => {
      maxTimer = null;
      void finalize();
    }, MATCH_MAX_DURATION_MS);
  }, [activeRoot, disposeAnnotationMatching, runtime]);

  const removeHighlight = useCallback((id: string) => {
    if (activeRoot) removeHighlights(activeRoot, id);
  }, [activeRoot]);

  const updateHighlightColor = useCallback((id: string, color: string) => {
    if (!activeRoot) return;
    const escaped = escapeAttrValue(id);
    const spans = activeRoot.querySelectorAll<HTMLSpanElement>(
      `span.highlighted-text[data-highlight-id="${escaped}"]`,
    );
    spans.forEach((span) => {
      span.style.backgroundColor = color;
    });
  }, [activeRoot]);

  const scrollToHighlight = useCallback((id: string) => {
    if (!activeRoot) return;

    try {
      const escaped = escapeAttrValue(id);
      const spans = activeRoot.querySelectorAll<HTMLSpanElement>(`[data-highlight-id="${escaped}"]`);
      const span = spans[0] ?? null;
      if (span) span.scrollIntoView({ behavior: "instant", block: "center" });
    } catch {
      // ignore
    }
  }, [activeRoot]);

  const getHighlightRect = useCallback((id: string): DOMRect | null => {
    if (!activeDocument) return null;

    try {
      const rect = highlightBoundingRect(id, activeDocument);
      const iframeBounds = attachedFrameRef.current?.getBoundingClientRect();
      const left = rect.left + (iframeBounds?.left ?? 0);
      const top = rect.top + (iframeBounds?.top ?? 0);
      const translated = new DOMRect(left, top, rect.width, rect.height);

      if (iframeBounds && (
        translated.bottom < iframeBounds.top
        || translated.top > iframeBounds.bottom
        || translated.right < iframeBounds.left
        || translated.left > iframeBounds.right
      )) {
        return null;
      }

      return translated;
    } catch {
      return null;
    }
  }, [activeDocument]);

  return useMemo(() => ({
    frame: snapshot.frame,
    document: activeDocument,
    root: activeRoot,
    ready: activeReady,
    error: activeError,
    title,
    framePath: framePathFromUrl(iframeUrl),
    frameSourceUrl,
    attachFrame,
    reportFrameError,
    reloadFrame,
    openInAnnotator,
    openOriginal,
    readingMode,
    setReadingMode,
    darkMode,
    setDarkMode,
    applyAnnotations,
    removeHighlight,
    updateHighlightColor,
    scrollToHighlight,
    getHighlightRect,
  }), [
    snapshot.frame,
    activeDocument,
    activeRoot,
    activeReady,
    activeError,
    title,
    iframeUrl,
    frameSourceUrl,
    attachFrame,
    reportFrameError,
    reloadFrame,
    openInAnnotator,
    openOriginal,
    readingMode,
    setReadingMode,
    darkMode,
    setDarkMode,
    applyAnnotations,
    removeHighlight,
    updateHighlightColor,
    scrollToHighlight,
    getHighlightRect,
  ]);
}
