interface ViewportInfo {
  layoutHeight: number;
  offsetTop: number;
  visualHeight: number;
  visualWidth: number;
  offsetLeft: number;
  layoutWidth?: number;
  scale?: number;
}

const sidebarStyles = {
  toggleButton: (isMobile: boolean, _isIOS: boolean, viewportInfo: ViewportInfo): React.CSSProperties => {
    const scale = viewportInfo.scale ?? 1;
    return {
      position: 'fixed',
      zIndex: 9998,
      right: isMobile
        ? Math.max(0, (viewportInfo.layoutWidth ?? viewportInfo.visualWidth) - viewportInfo.offsetLeft - viewportInfo.visualWidth)
        : 0,
      bottom: isMobile
        ? Math.max(0, viewportInfo.layoutHeight - viewportInfo.offsetTop - viewportInfo.visualHeight)
        : 0,
      width: 52,
      height: 52,
      margin: '1rem',
      padding: 0,
      display: 'inline-grid',
      placeItems: 'center',
      border: '1px solid var(--ds-color-border)',
      borderRadius: '1rem',
      color: 'var(--ds-color-text-inverse)',
      background: 'linear-gradient(145deg, var(--ds-color-blue-500), var(--ds-color-blue-700))',
      boxShadow: '0 14px 34px rgba(37, 99, 235, 0.32)',
      backdropFilter: 'blur(18px)',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      ...(isMobile && scale !== 1
        ? { transform: `scale(${1 / scale})`, transformOrigin: 'bottom right' }
        : {}),
    };
  },

  toggleCount: {
    position: 'absolute' as const,
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    padding: '0 5px',
    display: 'inline-grid',
    placeItems: 'center',
    border: '2px solid var(--ds-color-surface)',
    borderRadius: 'var(--ds-radius-full)',
    color: 'var(--ds-color-text)',
    background: 'var(--ds-color-surface)',
    boxShadow: 'var(--ds-shadow-sm)',
    fontSize: '0.625rem',
    fontWeight: 'var(--ds-font-weight-bold)',
    lineHeight: 1,
  },

  mobileBackdrop: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 9997,
    padding: 0,
    border: 0,
    background: 'rgba(12, 20, 36, 0.28)',
    backdropFilter: 'blur(2px)',
    touchAction: 'none',
  },

  sidebarContainer: (isMobile: boolean, viewportInfo: ViewportInfo, width: number): React.CSSProperties => ({
    position: 'fixed',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--ds-color-border)',
    color: 'var(--ds-color-text)',
    background: 'var(--ds-color-surface)',
    boxShadow: isMobile ? '0 -20px 60px rgba(21, 32, 51, 0.18)' : '0 0 50px rgba(21, 32, 51, 0.14)',
    backdropFilter: 'blur(22px)',
    fontFamily: 'var(--ds-font-family-sans)',
    ...(isMobile ? {
      left: viewportInfo.offsetLeft,
      bottom: viewportInfo.layoutHeight - viewportInfo.offsetTop - viewportInfo.visualHeight,
      width: viewportInfo.visualWidth,
      maxWidth: 'none',
      height: viewportInfo.visualHeight * 0.6,
      borderRadius: '1.35rem 1.35rem 0 0',
      touchAction: 'pan-y',
    } : {
      top: 12,
      right: 12,
      bottom: 12,
      width,
      maxWidth: 'min(90vw, 560px)',
      borderRadius: '1.25rem',
    }),
  }),

  mobileGrabber: {
    width: 38,
    height: 4,
    flex: '0 0 auto',
    alignSelf: 'center',
    margin: 'var(--ds-space-2) 0 0',
    borderRadius: 'var(--ds-radius-full)',
    background: 'var(--ds-color-border-strong)',
  },

  headerSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--ds-space-3)',
    padding: 'var(--ds-space-4) var(--ds-space-4) var(--ds-space-3)',
  },

  pageIdentity: {
    minWidth: 0,
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    gap: 'var(--ds-space-3)',
  },

  brandMark: {
    width: 34,
    height: 34,
    flex: '0 0 auto',
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: 'var(--ds-radius-lg)',
    color: 'white',
    background: 'linear-gradient(145deg, var(--ds-color-blue-500), var(--ds-color-blue-700))',
    boxShadow: '0 7px 16px rgba(37, 99, 235, 0.22)',
  },

  pageIdentityText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },

  pageTitle: {
    overflow: 'hidden',
    color: 'var(--ds-color-text)',
    fontSize: 'var(--ds-font-size-sm)',
    fontWeight: 'var(--ds-font-weight-bold)',
    letterSpacing: 0,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },

  pageDetail: {
    overflow: 'hidden',
    color: 'var(--ds-color-text-tertiary)',
    fontSize: '0.6875rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },

  toolbarSection: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--ds-space-2)',
    margin: '0 var(--ds-space-3)',
    padding: 'var(--ds-space-2)',
    border: '1px solid var(--ds-color-border)',
    borderRadius: 'var(--ds-radius-lg)',
    background: 'var(--ds-color-surface-subtle)',
  },

  statsContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--ds-space-1)',
  },

  toolbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--ds-space-1)',
  },

  refreshIcon: {
    display: 'inline-grid',
    placeItems: 'center',
  },

  resizeHandle: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: -5,
    zIndex: 30,
    width: 14,
    display: 'grid',
    placeItems: 'center',
    cursor: 'col-resize',
    touchAction: 'none',
  },

  resizeHandleGrip: {
    width: 3,
    height: 42,
    borderRadius: 'var(--ds-radius-full)',
    background: 'var(--ds-color-blue-300)',
    boxShadow: '0 0 0 3px var(--ds-color-surface)',
  },

  footerHint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--ds-space-3)',
    padding: 'var(--ds-space-3) var(--ds-space-4)',
    borderTop: '1px solid var(--ds-color-border)',
    color: 'var(--ds-color-text-tertiary)',
    background: 'var(--ds-color-surface-subtle)',
    fontSize: '0.625rem',
  },

  shortcut: {
    padding: '2px 6px',
    border: '1px solid var(--ds-color-border)',
    borderRadius: 'var(--ds-radius-sm)',
    color: 'var(--ds-color-text-secondary)',
    background: 'var(--ds-color-surface)',
    boxShadow: 'var(--ds-shadow-sm)',
    fontFamily: 'inherit',
    fontSize: '0.625rem',
  },
};

export default sidebarStyles;
