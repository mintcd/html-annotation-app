interface ViewportInfo {
  layoutHeight: number;
  offsetTop: number;
  visualHeight: number;
  visualWidth: number;
  offsetLeft: number;
  layoutWidth?: number;
}

const colorPickerStyles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 10,
    width: '100%',
    height: '100%',
    padding: 0,
    border: 0,
    background: 'transparent',
    cursor: 'default',
  },

  panel: (
    viewportInfo: ViewportInfo,
    anchorRect: { top: number; left: number; right: number; bottom: number; width: number; height: number } | null | undefined,
    isMobile: boolean,
  ): React.CSSProperties => {
    const visualViewport = typeof window !== 'undefined' ? window.visualViewport : null;
    const viewportLeft = viewportInfo.visualWidth > 0 ? viewportInfo.offsetLeft : (visualViewport?.offsetLeft ?? 0);
    const viewportTop = viewportInfo.visualHeight > 0 ? viewportInfo.offsetTop : (visualViewport?.offsetTop ?? 0);
    const viewportWidth = viewportInfo.visualWidth > 0
      ? viewportInfo.visualWidth
      : (visualViewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0));
    const viewportHeight = viewportInfo.visualHeight > 0
      ? viewportInfo.visualHeight
      : (visualViewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0));
    const margin = 12;
    const gap = 10;
    const width = Math.min(isMobile ? 260 : 232, Math.max(0, viewportWidth - (margin * 2)));
    const estimatedHeight = isMobile ? 128 : 112;
    const preferredTop = anchorRect
      ? anchorRect.bottom + gap
      : viewportTop + viewportHeight - estimatedHeight - margin;
    const top = anchorRect && preferredTop + estimatedHeight > viewportTop + viewportHeight - margin
      ? Math.max(viewportTop + margin, anchorRect.top - estimatedHeight - gap)
      : Math.min(
        Math.max(preferredTop, viewportTop + margin),
        Math.max(viewportTop + margin, viewportTop + viewportHeight - estimatedHeight - margin),
      );
    const preferredLeft = anchorRect
      ? anchorRect.left + (anchorRect.width / 2) - (width / 2)
      : viewportLeft + (viewportWidth / 2) - (width / 2);
    const left = Math.min(
      Math.max(preferredLeft, viewportLeft + margin),
      Math.max(viewportLeft + margin, viewportLeft + viewportWidth - width - margin),
    );

    return {
      position: 'fixed' as const,
      zIndex: 11,
      top,
      left,
      width,
      boxSizing: 'border-box',
      padding: 'var(--ds-space-3)',
      border: '1px solid rgba(217, 226, 239, 0.94)',
      borderRadius: 'var(--ds-radius-xl)',
      color: 'var(--ds-color-text)',
      background: 'rgba(255, 255, 255, 0.98)',
      boxShadow: '0 18px 46px rgba(21, 32, 51, 0.2)',
      backdropFilter: 'blur(20px)',
      fontFamily: 'var(--ds-font-family-sans)',
    };
  },

  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 'var(--ds-space-2)',
    marginBottom: 'var(--ds-space-3)',
  },

  title: {
    color: 'var(--ds-color-text)',
    fontSize: 'var(--ds-font-size-xs)',
    fontWeight: 'var(--ds-font-weight-bold)',
  },

  hint: {
    color: 'var(--ds-color-text-tertiary)',
    fontSize: '0.625rem',
  },

  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 'var(--ds-space-2)',
    alignItems: 'center',
    justifyItems: 'center',
  },

  colorButton: (color: string, isSelected: boolean, isActive: boolean, isMobile: boolean): React.CSSProperties => ({
    width: isMobile ? 42 : 36,
    height: isMobile ? 42 : 36,
    maxWidth: '100%',
    padding: 0,
    border: `3px solid ${isSelected ? 'var(--ds-color-primary)' : 'var(--ds-color-surface)'}`,
    borderRadius: 'var(--ds-radius-full)',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--ds-color-slate-900)',
    background: color,
    boxShadow: isSelected
      ? isActive
        ? '0 0 0 2px var(--ds-color-surface), 0 0 0 5px var(--ds-color-focus)'
        : '0 0 0 2px var(--ds-color-surface), 0 0 0 4px var(--ds-color-primary)'
      : isActive
        ? '0 0 0 3px rgba(96, 165, 250, 0.38)'
        : '0 1px 3px rgba(21, 32, 51, 0.2)',
    transform: isActive && !isSelected ? 'translateY(-1px) scale(1.04)' : 'none',
    transition: 'transform var(--ds-motion-fast) var(--ds-ease-standard), box-shadow var(--ds-motion-fast) var(--ds-ease-standard)',
    WebkitTapHighlightColor: 'transparent',
    outline: 'none',
  }),

  checkmark: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 18,
    height: 18,
    borderRadius: 'var(--ds-radius-full)',
    color: 'white',
    background: 'rgba(21, 32, 51, 0.66)',
    boxShadow: '0 1px 2px rgba(21, 32, 51, 0.2)',
    fontSize: '0.6875rem',
    fontWeight: 'var(--ds-font-weight-bold)',
    lineHeight: 1,
  },

  emptyState: {
    margin: 0,
    padding: 'var(--ds-space-3)',
    border: '1px dashed var(--ds-color-border)',
    borderRadius: 'var(--ds-radius-lg)',
    color: 'var(--ds-color-text-secondary)',
    background: 'var(--ds-color-surface-subtle)',
    fontSize: 'var(--ds-font-size-xs)',
    lineHeight: 'var(--ds-line-height-normal)',
  },
};

export default colorPickerStyles;
