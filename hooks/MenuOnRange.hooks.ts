import { useEffect, useState, useCallback, useRef } from "react";
import { useMobile } from ".";
import { cleanedHtml, createTextAnchor, highlightRange, rangeToHtml } from "../utils/dom";
import { useAnnotationContext } from "../context/Annotator.context";
import { useAnnotatorOverlayOptional } from "../context/AnnotatorOverlay.context";

// Small debounce hook used to create a stable debounced callback
function useDebouncedCallback<T extends (...args: unknown[]) => void>(fn: T, delay = 100) {
  const timer = useRef<number | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => fnRef.current(...args), delay) as unknown as number;
  }, [delay]);
}

export function useSelection(menuRef: React.RefObject<HTMLElement | null>) {
  const [range, setRange] = useState<Range | null>(null);
  const { isMobile } = useMobile();
  const { contentRef, iframeRef, iframeReady, addAnnotation, currentHighlightColor } = useAnnotationContext();
  const overlay = useAnnotatorOverlayOptional();

  const updateRange = useCallback((nextRange: Range | null) => {
    setRange(nextRange);
    if (nextRange) overlay?.showSelection();
    else if (overlay?.contextual.type === 'selection') overlay.clearContextual();
  }, [overlay]);

  const visibleRange = overlay
    ? overlay.contextual.type === 'selection' ? range : null
    : range;

  const finalizeFromSelection = useCallback(() => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (
      overlay?.contextual.type === 'resize'
      || iframeDoc?.documentElement.dataset.annotationResizeId
    ) return;

    const iframeWin = iframeRef.current?.contentWindow;
    const sel = iframeWin?.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      updateRange(null);
      return;
    }

    const r = sel.getRangeAt(0).cloneRange();
    if (!iframeDoc) {
      console.log("No iframe document found for selection");
      return
    };

    const root = r.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (r.commonAncestorContainer as Element)
      : r.commonAncestorContainer.parentElement;

    if (!(root && iframeDoc.contains(root))) {
      updateRange(null);
      return;
    }

    updateRange(r);
  }, [iframeRef, overlay?.contextual.type, updateRange]);

  // Debounced fallback used for selection handle drags on mobile
  const debouncedFinalize = useDebouncedCallback(finalizeFromSelection as (...args: unknown[]) => void, 100);

  // While selection is changing, hide the menu immediately
  const handleSelectionChanging = useCallback(() => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (
      overlay?.contextual.type === 'resize'
      || iframeDoc?.documentElement.dataset.annotationResizeId
    ) return;
    updateRange(null);
  }, [iframeRef, overlay?.contextual.type, updateRange]);

  const handlePointerUp = useCallback(() => {
    finalizeFromSelection();
  }, [finalizeFromSelection]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const target = e.target as Element;
    if (menuRef.current && menuRef.current.contains(target)) {
      return;
    }
    updateRange(null);
  }, [menuRef, updateRange]);

  useEffect(() => {
    if (!iframeReady) return;
    const iDoc = iframeRef.current?.contentDocument;
    if (!iDoc) return;

    iDoc.addEventListener('pointerdown', handlePointerDown as EventListener, { capture: true });
    if (isMobile) {
      iDoc.addEventListener('selectionchange', debouncedFinalize);
      iDoc.addEventListener('selectionchange', handleSelectionChanging);
    } else {
      iDoc.addEventListener('pointerup', handlePointerUp as EventListener, { capture: true });
    }

    return () => {
      iDoc.removeEventListener('pointerdown', handlePointerDown as EventListener, { capture: true });
      if (isMobile) {
        iDoc.removeEventListener('selectionchange', debouncedFinalize);
        iDoc.removeEventListener('selectionchange', handleSelectionChanging);
      } else {
        iDoc.removeEventListener('pointerup', handlePointerUp as EventListener, { capture: true });
      }
    };
  }, [iframeReady, iframeRef, isMobile, handlePointerUp, handlePointerDown, debouncedFinalize, handleSelectionChanging]);


  const highlight = async () => {
    if (!range) return;

    const { html } = cleanedHtml(rangeToHtml(range));
    // Capture a durable anchor before highlightRange splits and wraps text
    // nodes. This makes the first reload use the fast position path.
    const position = contentRef.current
      ? createTextAnchor(contentRef.current, range) ?? undefined
      : undefined;
    // Range#toString() can include MathJax's visual, assistive, and TeX source
    // text. Prefer the anchor's canonical, single-representation quote.
    const text = position?.exact ?? range.toString();

    const container = iframeRef.current;
    const iframeDoc = container?.contentDocument;
    const startEl =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;
    const endEl =
      range.endContainer.nodeType === Node.ELEMENT_NODE
        ? (range.endContainer as Element)
        : range.endContainer.parentElement;
    if (!iframeDoc || !startEl || !endEl || !iframeDoc.contains(startEl) || !iframeDoc.contains(endEl)) {
      return;
    }

    // Hide the live selection to avoid flicker while mutating DOM
    const iframeWin = iframeRef.current?.contentWindow;
    const sel = (iframeWin ?? window).getSelection();
    if (sel) sel.removeAllRanges();
    // Create annotation and get temp ID immediately
    const { tempId, promise } = await addAnnotation({
      text,
      html,
      color: currentHighlightColor,
      position,
    });

    // Highlight with temp ID immediately
    highlightRange(range, currentHighlightColor, tempId);
    updateRange(null);

    // Update highlight IDs when server responds with real ID
    promise.then(serverId => {
      if (serverId !== tempId) {
        // Update all spans with temp ID to use server ID.
        // Use iframeDoc (the iframe's content document) rather than container
        // (the <iframe> element), because querySelectorAll on an <iframe> element
        // does not search inside its content document.
        const spans = iframeDoc.querySelectorAll<HTMLSpanElement>(
          `span.highlighted-text[data-highlight-id="${tempId}"]`
        );
        spans.forEach(span => {
          span.setAttribute('data-highlight-id', serverId);
        });
      }
    }).catch(error => {
      console.error('Failed to update highlight ID:', error);
    });
  };

  return { range: visibleRange, highlight };
}

export function usePosition(menuRef: React.RefObject<HTMLElement | null>) {

}

