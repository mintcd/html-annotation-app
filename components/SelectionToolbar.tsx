"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Highlighter } from "../app/icons";
import { Button } from "./design-system/button";
import useMenuStyles from "./styles/MenuOnRange.styles";
import { useAnnotationContext } from "../contexts/Annotator.context";
import { useDebouncedCallback, useMobile } from "@/hooks";
import { useAnnotatorOverlayOptional } from "@/contexts/AnnotatorOverlay.context";
import { cleanHtml, convertRangeToHtml, createTextAnchor, highlightRange } from "@/core/annotation/dom";

export default function SelectionToolbar() {
  const { currentHighlightColor } = useAnnotationContext();
  const menuRef = useRef<HTMLButtonElement>(null);
  const { range, createHighlight } = useAnnotationSelection(menuRef);
  const styles = useMenuStyles(menuRef, range);

  return (
    range &&
    <Button
      variant="primary"
      size="small"
      onClick={createHighlight}
      ref={menuRef}
      onMouseDown={(e) => e.preventDefault()}
      style={styles.menuContainer}
      aria-label="Highlight selected text"
      leadingIcon={(
        <span style={styles.colorPreview(currentHighlightColor)} aria-hidden="true">
          <Highlighter size={15} color="currentColor" />
        </span>
      )}
    >
      Highlight
    </Button>
  );
}

function rangeInsideRoot(range: Range, root: HTMLElement): boolean {
  return root.contains(range.startContainer) && root.contains(range.endContainer);
}

export function useAnnotationSelection(menuRef: React.RefObject<HTMLElement | null>) {
  const [range, setRange] = useState<Range | null>(null);
  const { isMobile } = useMobile();
  const { session, addAnnotation, currentHighlightColor } = useAnnotationContext();
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
    const iframeDoc = session.document;
    if (
      overlay?.contextual.type === 'resize'
      || iframeDoc?.documentElement.dataset.annotationResizeId
    ) return;

    const iframeWin = session.frame?.contentWindow;
    const sel = iframeWin?.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      updateRange(null);
      return;
    }

    const r = sel.getRangeAt(0).cloneRange();
    const contentRoot = session.root;
    if (!iframeDoc || !contentRoot) {
      console.log("No iframe document or content root found for selection");
      updateRange(null);
      return
    };

    if (!rangeInsideRoot(r, contentRoot)) {
      updateRange(null);
      return;
    }

    updateRange(r);
  }, [session.document, session.frame, session.root, overlay?.contextual.type, updateRange]);

  // Debounced fallback used for selection handle drags on mobile
  const debouncedFinalize = useDebouncedCallback(finalizeFromSelection as (...args: unknown[]) => void, 100);

  // While selection is changing, hide the menu immediately
  const handleSelectionChanging = useCallback(() => {
    const iframeDoc = session.document;
    if (
      overlay?.contextual.type === 'resize'
      || iframeDoc?.documentElement.dataset.annotationResizeId
    ) return;
    updateRange(null);
  }, [session.document, overlay?.contextual.type, updateRange]);

  const handlePointerUp = useCallback(() => {
    window.requestAnimationFrame(finalizeFromSelection);
  }, [finalizeFromSelection]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const target = e.target as Element;
    if (menuRef.current && menuRef.current.contains(target)) {
      return;
    }
    updateRange(null);
  }, [menuRef, updateRange]);

  useEffect(() => {
    if (!session.ready) return;
    const iDoc = session.document;
    if (!iDoc) return;

    iDoc.addEventListener('pointerdown', handlePointerDown as EventListener, { capture: true });
    iDoc.addEventListener('pointerup', handlePointerUp as EventListener, { capture: true });
    if (isMobile) {
      iDoc.addEventListener('selectionchange', debouncedFinalize);
      iDoc.addEventListener('selectionchange', handleSelectionChanging);
    }

    return () => {
      iDoc.removeEventListener('pointerdown', handlePointerDown as EventListener, { capture: true });
      iDoc.removeEventListener('pointerup', handlePointerUp as EventListener, { capture: true });
      if (isMobile) {
        iDoc.removeEventListener('selectionchange', debouncedFinalize);
        iDoc.removeEventListener('selectionchange', handleSelectionChanging);
      }
    };
  }, [session.document, session.ready, isMobile, handlePointerUp, handlePointerDown, debouncedFinalize, handleSelectionChanging]);


  async function createHighlight() {
    if (!range) return;
    const contentRoot = session.root;
    if (!contentRoot || !rangeInsideRoot(range, contentRoot)) {
      updateRange(null);
      return;
    }

    const { html } = cleanHtml(convertRangeToHtml(range));
    // Capture a durable anchor before highlightRange splits and wraps text
    // nodes. This makes the first reload use the fast position path.
    const position = createTextAnchor(contentRoot, range);
    if (!position) {
      updateRange(null);
      return;
    }

    // Range#toString() can include MathJax's visual, assistive, and TeX source
    // text. Use the anchor's canonical, single-representation quote.
    const text = position.exact;

    const iframeDoc = session.document;
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

    // Hide the live selection to avoid flicker while mutating DOM.
    const iframeWin = session.frame?.contentWindow;
    const sel = (iframeWin ?? window).getSelection();
    if (sel) sel.removeAllRanges();

    const annotation = await addAnnotation({
      text,
      html,
      color: currentHighlightColor,
      position,
    }).catch(() => null);
    if (!annotation) {
      updateRange(null);
      return;
    }

    highlightRange(range, currentHighlightColor, annotation.id);
    updateRange(null);
  };

  return { range: visibleRange, createHighlight };
}

