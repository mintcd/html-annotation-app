const pasteHtmlStyles = {
  modal: {
    position: 'relative' as const,
    zIndex: 1,
    width: 'min(44rem, calc(100dvw - 2rem))',
    maxHeight: 'calc(100dvh - 2rem)',
    overflowY: 'auto' as const,
    border: '1px solid rgba(217, 226, 239, 0.9)',
    borderRadius: 'var(--ds-radius-2xl)',
    color: 'var(--ds-color-text)',
    background: 'rgba(255, 255, 255, 0.97)',
    boxShadow: 'var(--ds-shadow-lg)',
    backdropFilter: 'blur(22px)',
    fontFamily: 'var(--ds-font-family-sans)',
  },

  content: {
    padding: 'clamp(1.25rem, 4vw, 2rem)',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--ds-space-3)',
  },

  icon: {
    width: 44,
    height: 44,
    flex: '0 0 auto',
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: 'var(--ds-radius-xl)',
    color: 'white',
    background: 'linear-gradient(145deg, var(--ds-color-blue-500), var(--ds-color-blue-700))',
    boxShadow: 'var(--ds-shadow-primary)',
  },

  title: {
    margin: 0,
    fontSize: 'var(--ds-font-size-lg)',
    fontWeight: 'var(--ds-font-weight-bold)',
    letterSpacing: '-0.025em',
  },

  subtitle: {
    margin: 'var(--ds-space-1) 0 0',
    color: 'var(--ds-color-text-secondary)',
    fontSize: 'var(--ds-font-size-xs)',
    lineHeight: 'var(--ds-line-height-normal)',
  },

  fetchError: {
    marginTop: 'var(--ds-space-4)',
    padding: 'var(--ds-space-2) var(--ds-space-3)',
    border: '1px solid rgba(180, 83, 9, 0.18)',
    borderRadius: 'var(--ds-radius-lg)',
    color: 'var(--ds-color-warning)',
    background: 'var(--ds-color-warning-soft)',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: '0.6875rem',
    overflowWrap: 'anywhere' as const,
  },

  instructions: {
    margin: 'var(--ds-space-5) 0',
    padding: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
    gap: 'var(--ds-space-2)',
    listStyle: 'none',
  },

  instruction: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--ds-space-2)',
    padding: 'var(--ds-space-3)',
    border: '1px solid var(--ds-color-border)',
    borderRadius: 'var(--ds-radius-lg)',
    color: 'var(--ds-color-text-secondary)',
    background: 'var(--ds-color-surface-subtle)',
    fontSize: '0.6875rem',
    lineHeight: 'var(--ds-line-height-normal)',
  },

  stepNumber: {
    width: 20,
    height: 20,
    flex: '0 0 auto',
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: 'var(--ds-radius-full)',
    color: 'var(--ds-color-primary)',
    background: 'var(--ds-color-primary-soft)',
    fontSize: '0.625rem',
    fontWeight: 'var(--ds-font-weight-bold)',
  },

  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--ds-space-2)',
  },

  fieldHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--ds-space-3)',
    color: 'var(--ds-color-text)',
    fontSize: 'var(--ds-font-size-xs)',
    fontWeight: 'var(--ds-font-weight-semibold)',
  },

  characterCount: {
    color: 'var(--ds-color-text-tertiary)',
    fontSize: '0.625rem',
    fontWeight: 'var(--ds-font-weight-regular)',
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box' as const,
    minHeight: '13rem',
    padding: 'var(--ds-space-3)',
    resize: 'vertical' as const,
    border: '1px solid var(--ds-color-border)',
    borderRadius: 'var(--ds-radius-lg)',
    outline: 'none',
    color: 'var(--ds-color-text)',
    background: '#0f172a',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.16)',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: 'var(--ds-font-size-xs)',
    lineHeight: 'var(--ds-line-height-relaxed)',
    WebkitTextFillColor: '#dbeafe',
  },

  saveError: {
    marginTop: 'var(--ds-space-2)',
    padding: 'var(--ds-space-2) var(--ds-space-3)',
    borderRadius: 'var(--ds-radius-md)',
    color: 'var(--ds-color-danger)',
    background: 'var(--ds-color-danger-soft)',
    fontSize: 'var(--ds-font-size-xs)',
  },

  actions: {
    marginTop: 'var(--ds-space-5)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--ds-space-2)',
  },
};

export default pasteHtmlStyles;
