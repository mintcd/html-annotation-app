import { findBestContentNode } from '../../annotation/dom';
export { applyFrameDarkMode } from '../darkMode';

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
const READING_MODE_STYLE_ID = 'annotation-reading-mode-styles';
const READING_MODE_CLASS = 'annotation-reading-mode';
const READING_MODE_ROOT_ATTRIBUTE = 'data-annotation-reading-root';
const READING_MODE_CSS = `
  html.annotation-reading-mode {
    background: #f7f8fb !important;
  }

  html.annotation-reading-mode body {
    min-height: 100vh !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: clamp(24px, 5vw, 56px) clamp(18px, 5vw, 64px) !important;
    overflow: auto !important;
    color: #111827 !important;
    background: #f7f8fb !important;
  }

  html.annotation-reading-mode [data-annotation-reading-root="true"] {
    width: min(100%, 76ch) !important;
    max-width: 76ch !important;
    box-sizing: border-box !important;
    margin: 0 auto !important;
    color: #111827 !important;
    background: transparent !important;
    font-family: ui-serif, Georgia, "Times New Roman", serif !important;
    font-size: 18px !important;
    line-height: 1.72 !important;
  }

  html.annotation-reading-mode [data-annotation-reading-root="true"] :where(p, li, blockquote) {
    max-width: 76ch !important;
  }

  html.annotation-reading-mode [data-annotation-reading-root="true"] :where(img, video, canvas, svg, iframe) {
    max-width: 100% !important;
    height: auto !important;
  }

  html.annotation-reading-mode [data-annotation-reading-root="true"] :where(pre, table) {
    max-width: 100% !important;
    overflow: auto !important;
  }
`;

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
        box-shadow:
          -1px 0 0 var(--highlight-color, currentColor),
          1px 0 0 var(--highlight-color, currentColor);
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

export function applyReadingMode(doc: Document, contentRoot: HTMLElement): () => void {
  const body = doc.body;
  const html = doc.documentElement;
  if (!body || !html || !body.contains(contentRoot)) return () => undefined;

  const originalBodyChildren = Array.from(body.childNodes);
  const originalParent = contentRoot.parentNode;
  const originalNextSibling = contentRoot.nextSibling;
  const originalRootAttribute = contentRoot.getAttribute(READING_MODE_ROOT_ATTRIBUTE);
  const hadRootAttribute = contentRoot.hasAttribute(READING_MODE_ROOT_ATTRIBUTE);
  const htmlHadClass = html.classList.contains(READING_MODE_CLASS);
  const bodyHadClass = body.classList.contains(READING_MODE_CLASS);

  let style = doc.getElementById(READING_MODE_STYLE_ID) as HTMLStyleElement | null;
  const createdStyle = !style;
  if (!style) {
    style = doc.createElement('style');
    style.id = READING_MODE_STYLE_ID;
    style.textContent = READING_MODE_CSS;
    doc.head.appendChild(style);
  }

  html.classList.add(READING_MODE_CLASS);
  body.classList.add(READING_MODE_CLASS);
  contentRoot.setAttribute(READING_MODE_ROOT_ATTRIBUTE, 'true');

  if (contentRoot !== body) {
    body.replaceChildren(contentRoot);
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;

    try {
      if (contentRoot !== body) {
        if (originalParent && originalParent !== body) {
          contentRoot.remove();
          try {
            originalParent.insertBefore(contentRoot, originalNextSibling);
          } catch {
            originalParent.appendChild(contentRoot);
          }
        }
        body.replaceChildren(...originalBodyChildren);
      }

      if (hadRootAttribute) {
        contentRoot.setAttribute(READING_MODE_ROOT_ATTRIBUTE, originalRootAttribute ?? '');
      } else {
        contentRoot.removeAttribute(READING_MODE_ROOT_ATTRIBUTE);
      }

      if (!htmlHadClass) html.classList.remove(READING_MODE_CLASS);
      if (!bodyHadClass) body.classList.remove(READING_MODE_CLASS);
      if (createdStyle) style?.remove();
    } catch {}
  };
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
