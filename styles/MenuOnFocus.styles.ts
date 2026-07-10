import { useMobile } from "../hooks";
import { useElementWidth } from "../hooks";

function getViewport() {
  const visualViewport = typeof window !== 'undefined' ? window.visualViewport : null;
  const left = visualViewport?.offsetLeft ?? 0;
  const top = visualViewport?.offsetTop ?? 0;
  const width = visualViewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
  const height = visualViewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function clampedPosition(
  anchor: DOMRect,
  elementWidth: number,
  elementHeight: number,
  gap: number,
) {
  const viewport = getViewport();
  const margin = 12;
  const below = anchor.bottom + gap;
  const above = anchor.top - elementHeight - gap;

  return {
    top: below + elementHeight <= viewport.bottom - margin
      ? below
      : Math.max(viewport.top + margin, above),
    left: Math.min(
      Math.max(anchor.left + (anchor.width / 2) - (elementWidth / 2), viewport.left + margin),
      Math.max(viewport.left + margin, viewport.right - elementWidth - margin),
    ),
  };
}

export default function useMenuOnFocusStyles(
  ref: React.RefObject<HTMLElement | null>,
  rect: DOMRect | null,
  textareaFocus: boolean,
  commentAnchor: DOMRect | null,
) {
  const { isMobile } = useMobile();
  const menuWidth = useElementWidth(ref, rect);
  const viewport = getViewport();
  const estimatedMenuWidth = menuWidth || (isMobile ? 170 : 150);
  const menuHeight = isMobile ? 58 : 50;
  const commentWidth = Math.min(320, Math.max(240, viewport.width - 24));
  const commentHeight = 174;

  const position = rect
    ? clampedPosition(rect, estimatedMenuWidth, menuHeight, 10)
    : { top: 0, left: 0 };
  const commentPosition = commentAnchor
    ? clampedPosition(commentAnchor, commentWidth, commentHeight, 10)
    : rect
      ? clampedPosition(rect, commentWidth, commentHeight, menuHeight + 18)
      : { top: 0, left: 0 };

  return {
    controlSize: (isMobile ? 'large' : 'medium') as 'large' | 'medium',

    menuContainer: {
      position: 'fixed' as const,
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? 6 : 4,
      padding: isMobile ? 6 : 5,
      border: '1px solid rgba(217, 226, 239, 0.9)',
      borderRadius: 'var(--ds-radius-xl)',
      color: 'var(--ds-color-text-secondary)',
      background: 'rgba(255, 255, 255, 0.96)',
      boxShadow: '0 16px 42px rgba(21, 32, 51, 0.18)',
      backdropFilter: 'blur(20px)',
      fontFamily: 'var(--ds-font-family-sans)',
      ...position,
    },

    iconWrap: {
      position: 'relative' as const,
      display: 'inline-grid',
      placeItems: 'center',
    },

    commentIndicator: {
      position: 'absolute' as const,
      top: -4,
      right: -5,
      width: 7,
      height: 7,
      border: '1.5px solid var(--ds-color-surface)',
      borderRadius: 'var(--ds-radius-full)',
      background: 'var(--ds-color-primary)',
    },

    highlightIcon: (color: string): React.CSSProperties => ({
      display: 'inline-grid',
      placeItems: 'center',
      paddingBottom: 2,
      color: 'var(--ds-color-text-secondary)',
      boxShadow: `inset 0 -3px 0 ${color}`,
    }),

    separator: {
      width: 1,
      height: isMobile ? 28 : 24,
      margin: '0 1px',
      background: 'var(--ds-color-border)',
    },

    commentInputContainer: {
      position: 'fixed' as const,
      zIndex: 2,
      width: commentWidth,
      boxSizing: 'border-box' as const,
      border: '1px solid rgba(217, 226, 239, 0.92)',
      borderRadius: 'var(--ds-radius-xl)',
      color: 'var(--ds-color-text)',
      background: 'rgba(255, 255, 255, 0.98)',
      boxShadow: '0 20px 48px rgba(21, 32, 51, 0.2)',
      backdropFilter: 'blur(20px)',
      padding: 'var(--ds-space-3)',
      fontFamily: 'var(--ds-font-family-sans)',
      ...commentPosition,
    },

    commentHeader: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 'var(--ds-space-2)',
      marginBottom: 'var(--ds-space-2)',
    },

    commentLabel: {
      color: 'var(--ds-color-text)',
      fontSize: 'var(--ds-font-size-xs)',
      fontWeight: 'var(--ds-font-weight-bold)',
    },

    commentHint: {
      color: 'var(--ds-color-text-tertiary)',
      fontSize: '0.625rem',
    },

    commentTextarea: {
      display: 'block',
      width: '100%',
      height: isMobile ? 84 : 78,
      boxSizing: 'border-box' as const,
      padding: 'var(--ds-space-3)',
      paddingRight: 44,
      border: `1px solid ${textareaFocus ? 'var(--ds-color-focus)' : 'var(--ds-color-border)'}`,
      borderRadius: 'var(--ds-radius-lg)',
      outline: 'none',
      color: 'var(--ds-color-text)',
      background: 'var(--ds-color-slate-25)',
      boxShadow: textareaFocus ? 'var(--ds-focus-ring)' : 'inset 0 1px 2px rgba(21, 32, 51, 0.04)',
      fontFamily: 'inherit',
      fontSize: 'var(--ds-font-size-sm)',
      lineHeight: 'var(--ds-line-height-normal)',
      resize: 'none',
    },

    saveCommentButton: {
      position: 'absolute' as const,
      right: 18,
      bottom: 42,
      borderRadius: 'var(--ds-radius-md)',
    },

    saveHint: {
      display: 'block',
      marginTop: 'var(--ds-space-2)',
      color: 'var(--ds-color-text-tertiary)',
      fontSize: '0.625rem',
      textAlign: 'right' as const,
    },
  };
}

