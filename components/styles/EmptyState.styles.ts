const emptyStateStyles = {
  container: (mode: 'compact' | 'card'): React.CSSProperties => ({
    margin: mode === 'compact' ? 'var(--ds-space-2) 0' : 'var(--ds-space-4) 0',
    padding: mode === 'compact' ? '2.25rem 1.25rem' : 'clamp(3rem, 8vw, 5rem) 1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    border: '1px dashed var(--ds-color-border-strong)',
    borderRadius: 'var(--ds-radius-xl)',
    color: 'var(--ds-color-text-secondary)',
    background: 'linear-gradient(145deg, var(--ds-color-blue-50), var(--ds-color-surface))',
    textAlign: 'center' as const,
  }),

  icon: {
    width: 42,
    height: 42,
    marginBottom: 'var(--ds-space-3)',
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: 'var(--ds-radius-xl)',
    color: 'var(--ds-color-primary)',
    background: 'var(--ds-color-surface)',
    boxShadow: 'var(--ds-shadow-md)',
    transform: 'rotate(-4deg)',
  },

  title: {
    margin: 0,
    color: 'var(--ds-color-text)',
    fontSize: 'var(--ds-font-size-sm)',
    fontWeight: 'var(--ds-font-weight-bold)',
  },

  description: {
    maxWidth: '14rem',
    margin: 'var(--ds-space-1) 0 0',
    fontSize: 'var(--ds-font-size-xs)',
    lineHeight: 'var(--ds-line-height-relaxed)',
  },
};

export default emptyStateStyles;
