import { findBestContentNode } from '../../annotation/dom';

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
const FRAME_CLEANUP_DEBOUNCE_MS = 250;

export type PreparedFrameDocument = {
  document: Document;
  root: HTMLElement;
  title: string;
  cleanup: () => void;
};

export function framePathFromUrl(iframeUrl: string): string {
  const parts = iframeUrl.replace(/^\/+frame\//, '').split('?')[0].split('/');
  return parts.slice(1).join('/');
}

export async function prepareFrameDocument(iframe: HTMLIFrameElement): Promise<PreparedFrameDocument | { error: string }> {
  const doc = iframe.contentDocument;
  if (!iframe.getAttribute('src') || !doc) return { error: '' };

  const frameError = doc
    .querySelector<HTMLMetaElement>('meta[name="frame-error"]')
    ?.content.trim();
  if (frameError) return { error: frameError };

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

  const root = doc.body ? findBestContentNode(doc.body) : doc.documentElement;
  const cleanup = startFrameDocumentPostprocessing(doc, root);

  return {
    document: doc,
    root,
    title: doc.title.trim(),
    cleanup,
  };
}

export function startExternalLinkInterceptor(
  doc: Document,
  onExternalHref: (href: string) => void,
): () => void {
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

  doc.addEventListener('click', handleClick);
  return () => doc.removeEventListener('click', handleClick);
}

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

function startFrameDocumentPostprocessing(doc: Document, target: HTMLElement): () => void {
  let cleaning = false;
  let cleanupTimer: number | null = null;

  const runCleanup = () => {
    if (cleaning) return;
    cleaning = true;
    cleanupFrameDocument(doc, target);
    cleaning = false;
  };

  const scheduleCleanup = () => {
    if (cleaning || cleanupTimer !== null) return;
    cleanupTimer = window.setTimeout(() => {
      cleanupTimer = null;
      runCleanup();
    }, FRAME_CLEANUP_DEBOUNCE_MS);
  };

  runCleanup();

  const observer = new MutationObserver(() => {
    scheduleCleanup();
  });

  try {
    observer.observe(target, { childList: true, subtree: true, attributes: true, characterData: true });
  } catch {
    observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  }

  const timeouts = [200, 800, 2000].map((delay) => (
    window.setTimeout(runCleanup, delay)
  ));

  return () => {
    observer.disconnect();
    if (cleanupTimer !== null) window.clearTimeout(cleanupTimer);
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  };
}
