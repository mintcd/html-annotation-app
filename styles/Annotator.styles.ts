export default {
  promptTitle: {
    color: 'var(--ds-color-text)',
    fontSize: 'var(--ds-font-size-lg)',
    fontWeight: 'var(--ds-font-weight-bold)',
    letterSpacing: '-0.025em',
  },

  promptDescription: {
    marginTop: 'var(--ds-space-2)',
    color: 'var(--ds-color-text-secondary)',
    fontSize: 'var(--ds-font-size-sm)',
    lineHeight: 'var(--ds-line-height-relaxed)',
  },

  externalUrl: {
    display: 'block',
    maxHeight: '5rem',
    marginTop: 'var(--ds-space-3)',
    padding: 'var(--ds-space-2) var(--ds-space-3)',
    overflow: 'auto',
    border: '1px solid var(--ds-color-border)',
    borderRadius: 'var(--ds-radius-lg)',
    color: 'var(--ds-color-primary)',
    background: 'var(--ds-color-primary-soft)',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: '0.6875rem',
    fontStyle: 'normal',
    overflowWrap: 'anywhere' as const,
  },

  errorToast: {
    position: 'fixed' as const,
    right: '1rem',
    bottom: '1rem',
    zIndex: 'var(--ds-z-toast)',
    width: 'min(22rem, calc(100vw - 2rem))',
    padding: 'var(--ds-space-3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--ds-space-3)',
    border: '1px solid rgba(190, 18, 60, 0.18)',
    borderRadius: 'var(--ds-radius-xl)',
    color: 'var(--ds-color-danger)',
    background: 'rgba(255, 241, 243, 0.96)',
    boxShadow: 'var(--ds-shadow-lg)',
    backdropFilter: 'blur(18px)',
    fontFamily: 'var(--ds-font-family-sans)',
  },

  errorCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },

  errorTitle: {
    fontSize: 'var(--ds-font-size-xs)',
    fontWeight: 'var(--ds-font-weight-bold)',
  },

  errorDescription: {
    color: 'var(--ds-color-text-secondary)',
    fontSize: '0.6875rem',
    lineHeight: 'var(--ds-line-height-normal)',
  },
} as const;
