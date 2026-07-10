import { useLayoutEffect, useState } from "react";
import { useMobile, useElementWidth } from "../hooks";
import { useAnnotationContext } from "../context/Annotator.context";

export default function useMenuOnRangeStyles(ref: React.RefObject<HTMLElement | null>, range: Range | null) {
  const { isMobile } = useMobile();
  const menuWidth = useElementWidth(ref, range);
  const { iframeRef } = useAnnotationContext();
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!range) return;

    const updatePosition = () => {
      try {
        const rect = range.getBoundingClientRect();
        const iframeEl = iframeRef?.current;
        const iframeRect = iframeEl?.getBoundingClientRect();
        const anchor = {
          top: rect.top + (iframeRect?.top ?? 0),
          bottom: rect.bottom + (iframeRect?.top ?? 0),
          left: rect.left + (iframeRect?.left ?? 0),
          width: rect.width,
        };

        const visualViewport = window.visualViewport;
        const viewportLeft = visualViewport?.offsetLeft ?? 0;
        const viewportTop = visualViewport?.offsetTop ?? 0;
        const viewportWidth = visualViewport?.width ?? window.innerWidth;
        const viewportHeight = visualViewport?.height ?? window.innerHeight;
        const viewportRight = viewportLeft + viewportWidth;
        const viewportBottom = viewportTop + viewportHeight;
        const gap = 10;
        const margin = 12;
        const estimatedWidth = menuWidth || (isMobile ? 126 : 112);
        const estimatedHeight = isMobile ? 42 : 36;
        const below = anchor.bottom + gap;
        const above = anchor.top - estimatedHeight - gap;

        setPosition({
          top: below + estimatedHeight <= viewportBottom - margin
            ? below
            : Math.max(viewportTop + margin, above),
          left: Math.min(
            Math.max(anchor.left + (anchor.width / 2) - (estimatedWidth / 2), viewportLeft + margin),
            Math.max(viewportLeft + margin, viewportRight - estimatedWidth - margin),
          ),
        });
      } catch {
        setPosition({ top: 0, left: 0 });
      }
    };

    const iframeWindow = iframeRef.current?.contentWindow;
    const visualViewport = window.visualViewport;
    updatePosition();
    iframeWindow?.addEventListener('scroll', updatePosition, { passive: true });
    iframeWindow?.addEventListener('resize', updatePosition);
    window.addEventListener('resize', updatePosition);
    visualViewport?.addEventListener('resize', updatePosition);
    visualViewport?.addEventListener('scroll', updatePosition);

    return () => {
      iframeWindow?.removeEventListener('scroll', updatePosition);
      iframeWindow?.removeEventListener('resize', updatePosition);
      window.removeEventListener('resize', updatePosition);
      visualViewport?.removeEventListener('resize', updatePosition);
      visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [iframeRef, isMobile, menuWidth, range]);

  return {
    menuContainer: {
      position: 'fixed' as const,
      zIndex: 1,
      borderRadius: 'var(--ds-radius-full)',
      border: '1px solid rgba(255, 255, 255, 0.25)',
      background: 'linear-gradient(145deg, var(--ds-color-blue-500), var(--ds-color-blue-700))',
      boxShadow: '0 12px 30px rgba(37, 99, 235, 0.3)',
      backdropFilter: 'blur(18px)',
      WebkitTapHighlightColor: 'transparent',
      ...(isMobile ? {
        minHeight: 42,
        padding: '0 var(--ds-space-4) 0 var(--ds-space-2)',
        fontSize: 'var(--ds-font-size-sm)',
      } : {
        minHeight: 36,
        padding: '0 var(--ds-space-3) 0 6px',
      }),
      ...position,
    },

    colorPreview: (color: string): React.CSSProperties => ({
      width: isMobile ? 30 : 26,
      height: isMobile ? 30 : 26,
      display: 'inline-grid',
      placeItems: 'center',
      borderRadius: 'var(--ds-radius-full)',
      color: 'white',
      background: 'rgba(255, 255, 255, 0.14)',
      boxShadow: `inset 0 -3px 0 ${color}, 0 0 0 1px rgba(255, 255, 255, 0.12)`,
    }),
  };
}
