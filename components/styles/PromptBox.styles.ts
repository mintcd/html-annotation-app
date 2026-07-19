const promptBoxStyles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 'var(--ds-z-modal)',
    display: 'grid',
    placeItems: 'center',
    padding: 'var(--ds-space-4)',
    fontFamily: 'var(--ds-font-family-sans)',
  },

  overlay: {
    position: 'absolute' as const,
    inset: 0,
    width: '100%',
    height: '100%',
    padding: 0,
    border: 0,
    background: 'rgba(12, 20, 36, 0.42)',
    backdropFilter: 'blur(5px)',
    cursor: 'default',
  },

  modal: {
    position: 'relative' as const,
    zIndex: 1,
    width: 'min(28rem, calc(100dvw - 2rem))',
    maxHeight: 'calc(100dvh - 2rem)',
    overflowY: 'auto' as const,
    border: '1px solid rgba(217, 226, 239, 0.88)',
    borderRadius: 'var(--ds-radius-2xl)',
    color: 'var(--ds-color-text)',
    background: 'rgba(255, 255, 255, 0.96)',
    boxShadow: 'var(--ds-shadow-lg)',
    backdropFilter: 'blur(22px)',
  },

  content: {
    padding: 'var(--ds-space-6)',
  },

  message: {
    color: 'var(--ds-color-text-secondary)',
    fontSize: 'var(--ds-font-size-sm)',
    lineHeight: 'var(--ds-line-height-relaxed)',
    overflowWrap: 'anywhere' as const,
  },

  actions: {
    marginTop: 'var(--ds-space-6)',
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-end',
    gap: 'var(--ds-space-2)',
  },
};

export default promptBoxStyles;
