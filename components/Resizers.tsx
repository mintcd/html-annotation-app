"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnnotationContext } from '../context/Annotator.context';
import { useAnnotatorOverlayOptional } from '../context/AnnotatorOverlay.context';
import { Save, Times } from '../app/icons';
import { Button } from '../design-system/button';
import { useCoarsePointer } from '../hooks';
import sticksStyles from '../styles/Sticks.styles';
import {
  cleanedHtml,
  createTextAnchor,
  createTextIndex,
  getRange,
  highlightRange,
  rangeToHtml,
  removeHighlights,
} from '../utils/dom';

type Boundary = 'start' | 'end';

type Props = {
  annotationId: string;
  onResize?: () => void;
};

type Endpoint = {
  x: number;
  top: number;
  height: number;
};

type EndpointGeometry = {
  start: Endpoint;
  end: Endpoint;
};

type DragState = {
  boundary: Boundary;
  pointerId: number;
  baseRange: Range;
};

type UserSelectSnapshot = Array<{
  element: HTMLElement;
  value: string;
}>;

const STICK_WIDTH = 1.5;

function selectorForHighlight(id: string, doc: Document): string {
  const escaped = doc.defaultView?.CSS?.escape
    ? doc.defaultView.CSS.escape(id)
    : id.replace(/["\\]/g, '\\$&');
  return `span.highlighted-text[data-highlight-id="${escaped}"]`;
}

function getHighlightRange(doc: Document, annotationId: string): Range | null {
  const spans = doc.querySelectorAll<HTMLSpanElement>(
    selectorForHighlight(annotationId, doc),
  );
  if (spans.length === 0) return null;

  const first = spans[0];
  const last = spans[spans.length - 1];
  const range = doc.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.childNodes.length);
  return range.collapsed ? null : range;
}

function rangeInsideRoot(range: Range, root: HTMLElement): boolean {
  return root.contains(range.startContainer) && root.contains(range.endContainer);
}

function getSelectedRange(iframe: HTMLIFrameElement, root: HTMLElement): Range | null {
  const selection = iframe.contentWindow?.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!rangeInsideRoot(range, root)) return null;
  return range.cloneRange();
}

function replaceFrameSelection(iframe: HTMLIFrameElement, range: Range | null): boolean {
  const selection = iframe.contentWindow?.getSelection();
  if (!selection) return false;

  selection.removeAllRanges();
  if (range) selection.addRange(range.cloneRange());
  return !range || selection.rangeCount > 0;
}

function boundaryEndpoint(range: Range, boundary: Boundary, doc: Document): Endpoint | null {
  const collapsed = range.cloneRange();
  collapsed.collapse(boundary === 'start');
  const collapsedRect = collapsed.getBoundingClientRect();

  if (
    Number.isFinite(collapsedRect.left)
    && Number.isFinite(collapsedRect.top)
    && collapsedRect.height > 0
  ) {
    return {
      x: collapsedRect.left,
      top: collapsedRect.top,
      height: collapsedRect.height,
    };
  }

  const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0);
  if (rects.length === 0) return null;

  const rect = boundary === 'start' ? rects[0] : rects[rects.length - 1];
  const container = boundary === 'start' ? range.startContainer : range.endContainer;
  const element = container.nodeType === Node.ELEMENT_NODE
    ? container as Element
    : container.parentElement;
  const direction = element ? doc.defaultView?.getComputedStyle(element).direction : 'ltr';
  const x = boundary === 'start'
    ? direction === 'rtl' ? rect.right : rect.left
    : direction === 'rtl' ? rect.left : rect.right;

  return { x, top: rect.top, height: rect.height };
}

function translateEndpoint(endpoint: Endpoint, iframe: HTMLIFrameElement): Endpoint {
  const frameRect = iframe.getBoundingClientRect();
  const viewportWidth = iframe.contentWindow?.innerWidth || iframe.clientWidth || frameRect.width;
  const viewportHeight = iframe.contentWindow?.innerHeight || iframe.clientHeight || frameRect.height;
  const scaleX = viewportWidth > 0 ? frameRect.width / viewportWidth : 1;
  const scaleY = viewportHeight > 0 ? frameRect.height / viewportHeight : 1;

  return {
    x: frameRect.left + endpoint.x * scaleX,
    top: frameRect.top + endpoint.top * scaleY,
    height: endpoint.height * scaleY,
  };
}

function geometryForRange(range: Range, doc: Document, iframe: HTMLIFrameElement): EndpointGeometry | null {
  const start = boundaryEndpoint(range, 'start', doc);
  const end = boundaryEndpoint(range, 'end', doc);
  if (!start || !end) return null;

  return {
    start: translateEndpoint(start, iframe),
    end: translateEndpoint(end, iframe),
  };
}

function caretRangeFromParentPoint(
  clientX: number,
  clientY: number,
  iframe: HTMLIFrameElement,
  root: HTMLElement,
): Range | null {
  const doc = iframe.contentDocument;
  if (!doc) return null;

  const frameRect = iframe.getBoundingClientRect();
  if (
    clientX < frameRect.left
    || clientX > frameRect.right
    || clientY < frameRect.top
    || clientY > frameRect.bottom
    || frameRect.width <= 0
    || frameRect.height <= 0
  ) return null;

  const viewportWidth = iframe.contentWindow?.innerWidth || iframe.clientWidth || frameRect.width;
  const viewportHeight = iframe.contentWindow?.innerHeight || iframe.clientHeight || frameRect.height;
  const x = (clientX - frameRect.left) * (viewportWidth / frameRect.width);
  const y = (clientY - frameRect.top) * (viewportHeight / frameRect.height);
  const caretDocument = doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  let range: Range | null = null;
  try {
    if (caretDocument.caretPositionFromPoint) {
      const position = caretDocument.caretPositionFromPoint(x, y);
      if (position) {
        range = doc.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    } else if (caretDocument.caretRangeFromPoint) {
      range = caretDocument.caretRangeFromPoint(x, y)?.cloneRange() ?? null;
    }
  } catch {
    return null;
  }

  if (!range || !rangeInsideRoot(range, root)) return null;
  return range;
}

function sameAnchor(left: TextAnchor | null, right: TextAnchor | null): boolean {
  return Boolean(
    left
    && right
    && left.start === right.start
    && left.end === right.end,
  );
}

function disableUserSelection(documents: Document[]): UserSelectSnapshot {
  const elements = new Set<HTMLElement>();
  documents.forEach((doc) => {
    if (doc.documentElement) elements.add(doc.documentElement);
    if (doc.body) elements.add(doc.body);
  });

  return Array.from(elements, (element) => {
    const value = element.style.userSelect;
    element.style.userSelect = 'none';
    return { element, value };
  });
}

function restoreUserSelection(snapshot: UserSelectSnapshot | null): void {
  snapshot?.forEach(({ element, value }) => {
    element.style.userSelect = value;
  });
}

export default function Resizers({ annotationId, onResize }: Props) {
  const {
    annotations,
    contentRef,
    iframeReady,
    iframeRef,
    updateAnnotation,
  } = useAnnotationContext();
  const overlay = useAnnotatorOverlayOptional();
  const contextual = overlay?.contextual;
  const showHighlight = overlay?.showHighlight;
  const { isCoarsePointer: coarse, isResolved: pointerCapabilityResolved } = useCoarsePointer();
  const nativeResizeActive = Boolean(
    coarse
    && contextual?.type === 'resize'
    && contextual.annotationId === annotationId,
  );
  const [geometry, setGeometry] = useState<EndpointGeometry | null>(null);
  const [dragging, setDragging] = useState<Boundary | null>(null);
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const [nativeSelectionReady, setNativeSelectionReady] = useState(false);
  const annotationsRef = useRef(annotations);
  const pendingRangeRef = useRef<Range | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const userSelectSnapshotRef = useRef<UserSelectSnapshot | null>(null);
  const pointerMoveFrameRef = useRef<number | null>(null);
  const measureFrameRef = useRef<number | null>(null);
  const onResizeFrameRef = useRef<number | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const virtualDragMarkerRef = useRef(false);
  const commitVersionRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  const currentRange = useCallback((): Range | null => {
    const root = contentRef.current;
    if (!root) return null;

    const doc = root.ownerDocument;
    const highlighted = getHighlightRange(doc, annotationId);
    if (highlighted) return highlighted;

    const annotation = annotationsRef.current.find(({ id }) => id === annotationId);
    if (!annotation) return null;
    try {
      return getRange(root, annotation.text, annotation.position).range;
    } catch {
      return null;
    }
  }, [annotationId, contentRef]);

  const measure = useCallback(() => {
    const root = contentRef.current;
    const iframe = iframeRef.current;
    if (!root || !iframe) {
      setGeometry(null);
      return;
    }

    const range = pendingRangeRef.current ?? currentRange();
    if (!range || !rangeInsideRoot(range, root)) {
      setGeometry(null);
      return;
    }

    const next = geometryForRange(range, root.ownerDocument, iframe);
    setGeometry((previous) => {
      if (
        previous
        && next
        && previous.start.x === next.start.x
        && previous.start.top === next.start.top
        && previous.start.height === next.start.height
        && previous.end.x === next.end.x
        && previous.end.top === next.end.top
        && previous.end.height === next.end.height
      ) return previous;
      return next;
    });
  }, [contentRef, currentRange, iframeRef]);

  const scheduleMeasure = useCallback(() => {
    if (measureFrameRef.current !== null) return;
    measureFrameRef.current = window.requestAnimationFrame(() => {
      measureFrameRef.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    scheduleMeasure();
  }, [annotations, annotationId, scheduleMeasure]);

  useEffect(() => {
    if (!iframeReady) return;

    const iframe = iframeRef.current;
    const root = contentRef.current;
    const iframeWindow = iframe?.contentWindow;
    const iframeDocument = iframe?.contentDocument;
    const visualViewport = window.visualViewport;
    const onViewportChange = () => scheduleMeasure();
    const onScroll = () => {
      scheduleMeasure();
      if (dragRef.current) return;

      setHiddenOnScroll(true);
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollTimeoutRef.current = null;
        setHiddenOnScroll(false);
        scheduleMeasure();
      }, 150);
    };

    iframeWindow?.addEventListener('scroll', onScroll, { passive: true });
    iframeDocument?.addEventListener('scroll', onScroll, { passive: true, capture: true });
    iframeWindow?.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onViewportChange);
    visualViewport?.addEventListener('resize', onViewportChange);
    visualViewport?.addEventListener('scroll', onViewportChange);

    const resizeObserver = iframe && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(onViewportChange)
      : null;
    if (iframe && resizeObserver) resizeObserver.observe(iframe);
    if (root && resizeObserver) resizeObserver.observe(root);

    return () => {
      iframeWindow?.removeEventListener('scroll', onScroll);
      iframeDocument?.removeEventListener('scroll', onScroll, true);
      iframeWindow?.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onViewportChange);
      visualViewport?.removeEventListener('resize', onViewportChange);
      visualViewport?.removeEventListener('scroll', onViewportChange);
      resizeObserver?.disconnect();
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [contentRef, iframeReady, iframeRef, scheduleMeasure]);

  const commitRange = useCallback((candidate: Range): Range | null => {
    const root = contentRef.current;
    const iframe = iframeRef.current;
    const annotation = annotationsRef.current.find(({ id }) => id === annotationId);
    if (!root || !iframe || !annotation || candidate.collapsed || !rangeInsideRoot(candidate, root)) {
      return null;
    }

    let position: TextAnchor | null = null;
    let previousPosition: TextAnchor | null = null;
    try {
      const index = createTextIndex(root);
      const candidatePosition = createTextAnchor(root, candidate, index);
      if (candidatePosition) {
        const canonical = getRange(root, candidatePosition.exact, candidatePosition, index);
        position = canonical.resolvedPosition ?? candidatePosition;
      }
      const highlighted = getHighlightRange(root.ownerDocument, annotationId);
      previousPosition = highlighted ? createTextAnchor(root, highlighted, index) : null;
    } catch {
      return null;
    }

    if (!position) return null;
    if (sameAnchor(position, previousPosition)) {
      return getHighlightRange(root.ownerDocument, annotationId);
    }

    removeHighlights(root, annotationId);

    let html: string;
    let updatedRange: Range | null;
    try {
      const reconstructed = getRange(root, position.exact, position);
      const cleanRange = reconstructed.range;
      position = reconstructed.resolvedPosition ?? position;
      html = cleanedHtml(rangeToHtml(cleanRange)).html;
      highlightRange(cleanRange, annotation.color, annotationId);
      updatedRange = getHighlightRange(root.ownerDocument, annotationId);
      if (!updatedRange) throw new Error('The resized range could not be highlighted');
    } catch (error) {
      // The new anchor was created from this same document, but restore the old
      // visual highlight if a dynamic page mutation made reconstruction fail.
      removeHighlights(root, annotationId);
      if (previousPosition) {
        try {
          const rollback = getRange(root, previousPosition.exact, previousPosition).range;
          highlightRange(rollback, annotation.color, annotationId);
        } catch {
          // There is no safe DOM rollback left; persistence is intentionally
          // skipped so a reload can reconstruct the last saved annotation.
        }
      }
      console.error('Failed to resize annotation:', error);
      scheduleMeasure();
      return null;
    }

    annotationsRef.current = annotationsRef.current.map((item) => item.id === annotationId
      ? { ...item, text: position.exact, html, position }
      : item);
    const committedVersion = ++commitVersionRef.current;
    const savedPosition = position;
    const persistence = updateAnnotation({
      id: annotationId,
      text: savedPosition.exact,
      html,
      position: savedPosition,
    });
    void persistence.then((saved) => {
      if (
        saved
        || commitVersionRef.current !== committedVersion
        || !previousPosition
      ) return;

      const latestRoot = contentRef.current;
      const latestIframe = iframeRef.current;
      if (
        !latestRoot
        || !latestRoot.isConnected
        || latestIframe?.contentDocument !== latestRoot.ownerDocument
      ) return;

      try {
        const index = createTextIndex(latestRoot);
        const latestRange = getHighlightRange(latestRoot.ownerDocument, annotationId);
        const latestPosition = latestRange
          ? createTextAnchor(latestRoot, latestRange, index)
          : null;
        if (!sameAnchor(latestPosition, savedPosition)) return;

        removeHighlights(latestRoot, annotationId);
        const restored = getRange(
          latestRoot,
          previousPosition.exact,
          previousPosition,
        ).range;
        const latestAnnotation = annotationsRef.current.find(({ id }) => id === annotationId);
        highlightRange(restored, latestAnnotation?.color ?? annotation.color, annotationId);
        annotationsRef.current = annotationsRef.current.map((item) => item.id === annotationId
          ? {
            ...item,
            text: annotation.text,
            html: annotation.html,
            position: annotation.position ?? previousPosition,
          }
          : item);
        void updateAnnotation({
          id: annotationId,
          text: annotation.text,
          html: annotation.html ?? null,
          position: annotation.position ?? previousPosition,
        });
        if (mountedRef.current) {
          scheduleMeasure();
          onResize?.();
        }
      } catch (error) {
        console.error('Failed to roll back annotation resize:', error);
      }
    });

    scheduleMeasure();
    if (onResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(onResizeFrameRef.current);
    }
    onResizeFrameRef.current = window.requestAnimationFrame(() => {
      onResizeFrameRef.current = null;
      onResize?.();
    });
    return updatedRange;
  }, [annotationId, contentRef, iframeRef, onResize, scheduleMeasure, updateAnnotation]);

  const updateCandidateAtPoint = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const root = contentRef.current;
    const iframe = iframeRef.current;
    if (!drag || !root || !iframe) return;

    const caret = caretRangeFromParentPoint(clientX, clientY, iframe, root);
    if (!caret) return;

    let candidate: Range;
    try {
      const fixed = drag.baseRange.cloneRange();
      fixed.collapse(drag.boundary === 'end');
      const comparison = caret.compareBoundaryPoints(Range.START_TO_START, fixed);
      if (
        (drag.boundary === 'start' && comparison >= 0)
        || (drag.boundary === 'end' && comparison <= 0)
      ) return;

      candidate = root.ownerDocument.createRange();
      if (drag.boundary === 'start') {
        candidate.setStart(caret.startContainer, caret.startOffset);
        candidate.setEnd(drag.baseRange.endContainer, drag.baseRange.endOffset);
      } else {
        candidate.setStart(drag.baseRange.startContainer, drag.baseRange.startOffset);
        candidate.setEnd(caret.startContainer, caret.startOffset);
      }
      if (candidate.collapsed) return;
    } catch {
      return;
    }

    pendingRangeRef.current = candidate;
    replaceFrameSelection(iframe, candidate);
    measure();
  }, [contentRef, iframeRef, measure]);

  const queuePointerUpdate = useCallback((clientX: number, clientY: number) => {
    latestPointerRef.current = { x: clientX, y: clientY };
    if (pointerMoveFrameRef.current !== null) return;

    pointerMoveFrameRef.current = window.requestAnimationFrame(() => {
      pointerMoveFrameRef.current = null;
      const point = latestPointerRef.current;
      if (point) updateCandidateAtPoint(point.x, point.y);
    });
  }, [updateCandidateAtPoint]);

  const finishPointerDrag = useCallback((commit: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (pointerMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerMoveFrameRef.current);
      pointerMoveFrameRef.current = null;
    }

    const candidate = pendingRangeRef.current?.cloneRange() ?? null;
    dragRef.current = null;
    latestPointerRef.current = null;
    restoreUserSelection(userSelectSnapshotRef.current);
    userSelectSnapshotRef.current = null;
    setDragging(null);

    const iframe = iframeRef.current;
    if (nativeResizeActive) {
      const staged = commit && candidate ? candidate : drag.baseRange.cloneRange();
      pendingRangeRef.current = staged;
      if (iframe) replaceFrameSelection(iframe, staged);
    } else {
      if (iframe) replaceFrameSelection(iframe, null);
      pendingRangeRef.current = null;
      if (commit && candidate) commitRange(candidate);
    }

    if (virtualDragMarkerRef.current) {
      const doc = iframe?.contentDocument;
      if (doc?.documentElement.dataset.annotationResizeId === annotationId) {
        delete doc.documentElement.dataset.annotationResizeId;
      }
      virtualDragMarkerRef.current = false;
    }
    scheduleMeasure();
  }, [annotationId, commitRange, iframeRef, nativeResizeActive, scheduleMeasure]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, boundary: Boundary) => {
    if ((event.pointerType === 'mouse' && event.button !== 0) || dragRef.current) return;

    const root = contentRef.current;
    const iframe = iframeRef.current;
    const range = currentRange();
    if (!root || !iframe || !range) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      boundary,
      pointerId: event.pointerId,
      baseRange: range.cloneRange(),
    };
    pendingRangeRef.current = range.cloneRange();
    const markerElement = root.ownerDocument.documentElement;
    if (!markerElement.dataset.annotationResizeId) {
      markerElement.dataset.annotationResizeId = annotationId;
      virtualDragMarkerRef.current = true;
    }
    userSelectSnapshotRef.current = disableUserSelection([document, root.ownerDocument]);
    setDragging(boundary);
  }, [annotationId, contentRef, currentRange, iframeRef]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    queuePointerUpdate(event.clientX, event.clientY);
  }, [queuePointerUpdate]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    updateCandidateAtPoint(event.clientX, event.clientY);
    finishPointerDrag(true);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [finishPointerDrag, updateCandidateAtPoint]);

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    finishPointerDrag(false);
  }, [finishPointerDrag]);

  const handleLostPointerCapture = useCallback(() => {
    if (dragRef.current) finishPointerDrag(false);
  }, [finishPointerDrag]);

  useEffect(() => {
    if (!dragging) return;
    const cancel = () => finishPointerDrag(false);
    window.addEventListener('blur', cancel);
    return () => window.removeEventListener('blur', cancel);
  }, [dragging, finishPointerDrag]);

  useEffect(() => {
    if (
      !pointerCapabilityResolved
      || coarse
      || contextual?.type !== 'resize'
      || contextual.annotationId !== annotationId
    ) return;
    showHighlight?.(annotationId);
  }, [annotationId, coarse, contextual, pointerCapabilityResolved, showHighlight]);

  useEffect(() => {
    if (!nativeResizeActive || !iframeReady) return;

    const root = contentRef.current;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const initialRange = currentRange();
    if (!root || !iframe || !doc || !initialRange) {
      const resetFrame = window.requestAnimationFrame(() => setNativeSelectionReady(false));
      return () => window.cancelAnimationFrame(resetFrame);
    }

    let disposed = false;
    let readyFrame: number | null = null;
    doc.documentElement.dataset.annotationResizeId = annotationId;
    pendingRangeRef.current = initialRange.cloneRange();
    const selectionEstablished = replaceFrameSelection(iframe, initialRange);
    readyFrame = window.requestAnimationFrame(() => {
      readyFrame = null;
      if (!disposed) setNativeSelectionReady(selectionEstablished);
    });
    scheduleMeasure();

    const handleSelectionChange = () => {
      const selected = getSelectedRange(iframe, root);
      if (!selected) return;
      pendingRangeRef.current = selected;
      scheduleMeasure();
    };

    doc.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      disposed = true;
      if (readyFrame !== null) window.cancelAnimationFrame(readyFrame);
      doc.removeEventListener('selectionchange', handleSelectionChange);
      if (doc.documentElement.dataset.annotationResizeId === annotationId) {
        delete doc.documentElement.dataset.annotationResizeId;
      }
      replaceFrameSelection(iframe, null);
      pendingRangeRef.current = null;
      scheduleMeasure();
    };
  }, [
    annotationId,
    contentRef,
    currentRange,
    iframeReady,
    iframeRef,
    nativeResizeActive,
    scheduleMeasure,
  ]);

  const finishNativeResize = useCallback((save: boolean) => {
    const root = contentRef.current;
    const iframe = iframeRef.current;
    if (!root || !iframe) return;

    const selected = getSelectedRange(iframe, root);
    const candidate = selected ?? pendingRangeRef.current?.cloneRange() ?? null;
    if (save && candidate) commitRange(candidate);

    replaceFrameSelection(iframe, null);
    pendingRangeRef.current = null;
    showHighlight?.(annotationId);
    scheduleMeasure();
  }, [annotationId, commitRange, contentRef, iframeRef, scheduleMeasure, showHighlight]);

  useEffect(() => {
    mountedRef.current = true;
    const iframe = iframeRef.current;
    return () => {
      mountedRef.current = false;
      if (pointerMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerMoveFrameRef.current);
      }
      if (measureFrameRef.current !== null) {
        window.cancelAnimationFrame(measureFrameRef.current);
      }
      if (onResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(onResizeFrameRef.current);
      }
      if (iframe) replaceFrameSelection(iframe, null);
      const doc = iframe?.contentDocument;
      if (virtualDragMarkerRef.current && doc?.documentElement.dataset.annotationResizeId === annotationId) {
        delete doc.documentElement.dataset.annotationResizeId;
      }
      dragRef.current = null;
      pendingRangeRef.current = null;
      latestPointerRef.current = null;
      restoreUserSelection(userSelectSnapshotRef.current);
    };
  }, [annotationId, iframeRef]);

  const overlayAllowsResize = !contextual
    || contextual.type === 'highlight'
    || contextual.type === 'resize';
  if (!pointerCapabilityResolved || !overlayAllowsResize) return null;

  const sharedPointerProps = {
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onLostPointerCapture: handleLostPointerCapture,
  };

  const handles = geometry && (!hiddenOnScroll || dragging) ? (
    <>
      <div
        {...sharedPointerProps}
        className="start-stick"
        aria-label="Resize highlight start"
        title="Drag to resize the start of this highlight"
        style={sticksStyles.stick(
          geometry.start.top,
          geometry.start.x,
          geometry.start.height,
        )}
        onPointerDown={(event) => handlePointerDown(event, 'start')}
      >
        <div style={sticksStyles.line(geometry.start.height, STICK_WIDTH)} />
        <div style={sticksStyles.knob('top', geometry.start.height)} />
      </div>
      <div
        {...sharedPointerProps}
        className="end-stick"
        aria-label="Resize highlight end"
        title="Drag to resize the end of this highlight"
        style={sticksStyles.stick(
          geometry.end.top,
          geometry.end.x,
          geometry.end.height,
        )}
        onPointerDown={(event) => handlePointerDown(event, 'end')}
      >
        <div style={sticksStyles.line(geometry.end.height, STICK_WIDTH)} />
        <div style={sticksStyles.knob('bottom', geometry.end.height)} />
      </div>
    </>
  ) : null;

  if (coarse) {
    if (!nativeResizeActive) return null;
    return (
      <>
        {!nativeSelectionReady && handles}
        <div
          role="toolbar"
          aria-label="Mobile highlight resize actions"
          style={sticksStyles.mobileActions}
        >
          <span style={sticksStyles.mobileHint}>
            Adjust the selection handles, then save.
          </span>
          <Button
            variant="ghost"
            size="small"
            leadingIcon={<Times size={12} aria-hidden="true" />}
            onClick={() => finishNativeResize(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="small"
            leadingIcon={<Save size={12} aria-hidden="true" />}
            onClick={() => finishNativeResize(true)}
          >
            Done
          </Button>
        </div>
      </>
    );
  }

  return handles;
}
