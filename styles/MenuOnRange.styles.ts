import { useMobile, useElementWidth } from "../hooks";
import { toTopWindowRect } from "../utils/highlight";

export default function useMenuOnRangeStyles(ref: React.RefObject<HTMLElement | null>, range: Range | null) {
  const { isMobile } = useMobile();
  const menuWidth = useElementWidth(ref, range);
  // Convert range rect into top-level window coordinates so fixed overlays
  // remain positioned correctly even when the annotated content is inside
  // an <iframe> or the page is zoomed on mobile browsers.
  const position = range ? (() => {
    try {
      const r = range.getBoundingClientRect();
      const doc = (range.startContainer && (range.startContainer as Node).ownerDocument) ?? document;
      const topRect = toTopWindowRect(r, doc);
      return {
        top: topRect.bottom + 10,
        left: topRect.left + (topRect.width / 2) - (menuWidth / 2),
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