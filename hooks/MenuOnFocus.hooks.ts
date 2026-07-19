"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnotationContext } from "../contexts/Annotator.context";
import { useAnnotatorOverlayOptional } from "../contexts/AnnotatorOverlay.context";

export function useActiveAnnotationId() {
  const [activeAnnotationId, setFocusedId] = useState<string | null>(null);
  const focusedIdRef = useRef<string | null>(null);
  const { session } = useAnnotationContext();
  const overlay = useAnnotatorOverlayOptional();

  const updateFocusedId = useCallback((id: string | null) => {
    focusedIdRef.current = id;
    setFocusedId(id);
    if (id) overlay?.showHighlight(id);
    else overlay?.clearContextual();
  }, [overlay]);

  const overlayAnnotationId = overlay && 'annotationId' in overlay.contextual
    ? overlay.contextual.annotationId
    : null;
  const visibleAnnotationId = overlay
    ? overlayAnnotationId === activeAnnotationId ? activeAnnotationId : null
    : activeAnnotationId;

  useEffect(() => {
    if (!session.ready) return;
    const iDoc = session.document;
    if (!iDoc) return;

    const handleInteraction = (e: Event) => {
      const target = e.target as Element;

      // Native selection handles are used to resize an existing annotation on
      // coarse-pointer devices. Their pointerup can land outside the original
      // highlight, so keep the focused menu open while that managed selection
      // is active.
      if (
        (
          (overlay?.contextual.type === 'resize'
            && overlay.contextual.annotationId === focusedIdRef.current)
          || iDoc.documentElement.dataset.annotationResizeId === focusedIdRef.current
        )
      ) {
        const selection = iDoc.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          return;
        }
      }

      const activeSelection = iDoc.getSelection();
      if (activeSelection && activeSelection.rangeCount > 0 && !activeSelection.isCollapsed) {
        return;
      }

      // Don't handle clicks on the menu itself
      if (target.closest('[role="toolbar"][aria-label="Highlight actions"]')) {
        return;
      }

      // Check if clicked element is a highlighted span
      if (target.matches?.('span.highlighted-text[data-highlight-id]')) {
        const span = target as HTMLSpanElement;
        const id = span.dataset.highlightId;
        if (id) {
          const currentId = overlay
            ? overlayAnnotationId === focusedIdRef.current ? focusedIdRef.current : null
            : focusedIdRef.current;
          updateFocusedId(currentId === id ? null : id);
          return;
        }
      }

      // Check if clicked inside a highlighted span (for nested elements)
      const highlightedSpan = target.closest?.('span.highlighted-text[data-highlight-id]');
      if (highlightedSpan) {
        const span = highlightedSpan as HTMLSpanElement;
        const id = span.dataset.highlightId;
        if (id) {
          const currentId = overlay
            ? overlayAnnotationId === focusedIdRef.current ? focusedIdRef.current : null
            : focusedIdRef.current;
          updateFocusedId(currentId === id ? null : id);
          return;
        }
      }

      // Click/touch outside any highlight - close menu
      updateFocusedId(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        updateFocusedId(null);
      }
    };

    iDoc.addEventListener('pointerup', handleInteraction);
    iDoc.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      iDoc.removeEventListener('pointerup', handleInteraction);
      iDoc.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [session.document, session.ready, overlay, overlayAnnotationId, updateFocusedId]);

  return { activeAnnotationId: visibleAnnotationId, setFocusedId: updateFocusedId };
}
