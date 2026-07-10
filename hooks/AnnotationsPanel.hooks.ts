import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react';


type UseResizeConfig = {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  disabled?: boolean;
  elementRef?: RefObject<HTMLElement>;
};

type UseResizeReturn = {
  width: number;
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  // Expose setter for programmatic width changes
  setWidth?: (w: number) => void;
};

function getInitialWidth(
  initialWidth: number,
  minWidth: number,
  maxWidth: number,
  storageKey?: string,
) {
  if (!storageKey || typeof window === 'undefined') return initialWidth;

  try {
    const savedWidth = window.localStorage.getItem(storageKey);
    if (!savedWidth) return initialWidth;

    const parsed = Number.parseInt(savedWidth, 10);
    return Number.isFinite(parsed) && parsed >= minWidth && parsed <= maxWidth
      ? parsed
      : initialWidth;
  } catch {
    return initialWidth;
  }
}

export function useResizablePanelWidth({
  initialWidth = 320,
  minWidth = 240,
  maxWidth = 560,
  storageKey,
  disabled = false,
  elementRef,
}: UseResizeConfig = {}): UseResizeReturn {
  const [width, setWidthState] = useState<number>(() => (
    getInitialWidth(initialWidth, minWidth, maxWidth, storageKey)
  ));

  // Refs for drag state
  const dragging = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const startW = useRef<number>(0);

  // Save width to localStorage when it changes
  useEffect(() => {
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      // Ignore localStorage errors
    }
  }, [width, storageKey]);

  // Attach pointer event listeners to the element if ref provided
  useEffect(() => {
    if (!elementRef?.current || disabled) return;

    const element = elementRef.current;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;

      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture may throw in some environments; continue and fall back to window listeners
      }

      // Attach global listeners so dragging continues even if the pointer leaves the small handle
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;

      // Calculate drag delta (dragging left increases width for right-side sidebar)
      const dx = startX.current - e.clientX;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, startW.current + dx));

      if (nextWidth !== width) {
        setWidthState(nextWidth);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragging.current) return;

      dragging.current = false;

      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      // Cleanup global listeners
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    element.addEventListener('pointerdown', handlePointerDown);

    // Keep a cleanup that removes both the element listener and any global listeners
    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [elementRef, disabled, width, minWidth, maxWidth]);

  // Wrapper for setWidth to ensure bounds
  const setWidth = useCallback((newWidth: number) => {
    const constrainedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
    setWidthState(constrainedWidth);
  }, [minWidth, maxWidth]);

  // Pointer event handlers
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;

      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;

      const target = e.currentTarget as HTMLDivElement;
      const pointerId = e.pointerId;

      try {
        target.setPointerCapture(pointerId);
      } catch {
        // ignore
      }

      // Move handler for window events
      const handleMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const dx = startX.current - ev.clientX;
        const nextWidth = Math.min(maxWidth, Math.max(minWidth, startW.current + dx));
        if (nextWidth !== width) setWidthState(nextWidth);
      };

      // Up handler for window events
      const handleUp = (ev: PointerEvent) => {
        if (!dragging.current) return;
        dragging.current = false;
        try {
          target.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [disabled, width, minWidth, maxWidth]
  );

  return {
    width,
    onPointerDown,
    setWidth,
  };
}
