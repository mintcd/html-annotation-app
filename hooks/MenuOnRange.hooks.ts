import { useEffect, useState, useCallback, useRef } from "react";
import { useMobile } from ".";
import { cleanedHtml, highlightRange, rangeToHtml } from "../utils/dom";
import { useAnnotationContext } from "../context/Annotator.context";

// Small debounce hook used to create a stable debounced callback
function useDebouncedCallback<T extends (...args: unknown[]) => void>(fn: T, delay = 100) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => fn(...args), delay) as unknown as number;
  }, [fn, delay]);
}

export function useSelection(menuRef: React.RefObject<HTMLElement | null>) {
  const [range, setRange] = useState<Range | null>(null);
  const { isMobile } = useMobile();
  const { iframeRef, iframeReady, addAnnotation, currentHighlightColor } = useAnnotationContext();

  const finalizeFromSelection = useCallback(() => {
    const iframeWin = iframeRef.current?.contentWindow;
    const sel = iframeWin?.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setRange(null);
      return;
    }

    const r = sel.getRangeAt(0).cloneRange();
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) {
      console.log("No iframe document found for selection");
      return
    };

    const root = r.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (r.commonAncestorContainer as Element)
      : r.commonAncestorContainer.parentElement;

    if (!(root && iframeDoc.contains(root))) {
      setRange(null);
      return;
    }

    setRange(r);
  }, [iframeRef]);

  // Debounced fallback used for selection handle drags on mobile
  const debouncedFinalize = useDebouncedCallback(finalizeFromSelection as (...args: unknown[]) => void, 100);

  // While selection is changing, hide the menu immediately
  const handleSelectionChanging = useCallback(() => {
    setRange(null);
  }, []);

  const handlePointerUp = useCallback(() => {
    finalizeFromSelection();
  }, [finalizeFromSelection]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const target = e.target as Element;
    if (menuRef.current && menuRef.current.contains(target)) {
      return;
    }
    setRange(null);
  }, [menuRef]);

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
  }, [iframeReady, isMobile, handlePointerUp, handlePointerDown, debouncedFinalize, handleSelectionChanging]);


  const highlight = async () => {
    if (!range) return;

    const text = range.toString();
    const { html } = cleanedHtml(rangeToHtml(range));

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
    const { tempId, promise } = await addAnnotation(text, html, currentHighlightColor);

    // Highlight with temp ID immediately
    highlightRange(range, currentHighlightColor, tempId);
    setRange(null);

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

  return { range, highlight };
}

export function usePosition(menuRef: React.RefObject<HTMLElement | null>) {

}

