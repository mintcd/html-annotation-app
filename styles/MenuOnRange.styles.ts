import { useMobile, useElementWidth } from "../hooks";
import { useAnnotationContext } from "../context/Annotator.context";

export default function useMenuOnRangeStyles(ref: React.RefObject<HTMLElement | null>, range: Range | null) {
  const { isMobile } = useMobile();
  const menuWidth = useElementWidth(ref, range);
  const { iframeRef } = useAnnotationContext();

  const position = range ? (() => {
    try {
      const rec = range.getBoundingClientRect();
      // If selection comes from inside an iframe, range rect is relative to
      // the iframe's viewport. Translate into the parent viewport by adding
      // the iframe element's bounding rect so the fixed menu lines up.
      const iframeEl = iframeRef?.current;
      if (iframeEl) {
        const iframeRect = iframeEl.getBoundingClientRect();
        return {
          top: iframeRect.top + rec.bottom + 10,
          left: iframeRect.left + rec.left + (rec.width / 2) - (menuWidth / 2),
        };
      }
      return {
        top: rec.bottom + 10,
        left: rec.left + (rec.width / 2) - (menuWidth / 2),
      };
    } catch (err) {
      return { top: 0, left: 0 };
    }
  })() : { top: 0, left: 0 };
  return {
    menuContainer: {
      position: 'fixed' as const,
      zIndex: 100,
      display: 'flex',
      gap: '0.5rem',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.1)',
      borderRadius: '0.75rem',
      background: 'linear-gradient(to bottom right, white, #F9FAFB)',
      border: '1px solid #D1D5DB',
      backdropFilter: 'blur(4px)',
      cursor: 'pointer',
      color: '#4B5563',
      fontSize: isMobile ? '1rem' : '0.875rem',
      fontWeight: 500,
      padding: isMobile ? '0.5rem 0.75rem' : '0.4rem 0.6rem',
      ...position,
    }
  };
}