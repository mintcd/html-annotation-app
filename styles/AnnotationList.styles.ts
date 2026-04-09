const annotationListStyles = {
  container: {
    overflowY: 'auto' as const,
    padding: '0.5rem',
    touchAction: 'pan-y',
    // Allow natural scroll chaining so parent scroll can continue when
    // the inner list is at its scroll edge (prevents "pointer inside list disables scroll").
    overscrollBehavior: 'auto',
  },

  annotationsWrapper: {
    maxWidth: '56rem',
    margin: '0 auto',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '1rem',
  },

  annotationItem: (hover: boolean, focus: boolean): React.CSSProperties => ({
    borderRadius: '0.5rem',
    border: `1px solid ${hover ? '#93c5fd' : '#e5e7eb'}`,
    background: 'linear-gradient(to bottom right, white, #f9fafb)',
    padding: '0.5rem 0.75rem',
    textAlign: 'left',
    boxShadow: focus ? '0 0 0 2px #3b82f6' : (hover ? '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.05)' : '0 1px 2px 0 rgba(0,0,0,0.05)'),
    outline: 'none',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '0.25rem',
  }),

  colorIndicator: (color?: string): React.CSSProperties => ({
    marginTop: '0.25rem',
    display: 'inline-block' as const,
    height: '0.625rem',
    width: '0.625rem',
    borderRadius: '9999px',
    flexShrink: 0,
    backgroundColor: color ?? "#87ceeb",
    willChange: "auto" as const
  }),

  contentContainer: {
    display: 'flex' as const,
    alignItems: 'flex-start' as const,
    gap: '0.5rem'
  },

  comment: {
    marginTop: '0.25rem',
    fontSize: '0.75rem',
    color: '#4b5563',
    display: '-webkit-box' as const,
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden' as const
  },

  actionButtons: (hover: boolean): React.CSSProperties => ({
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '0.25rem',
    opacity: hover ? 1 : 0,
    transition: 'opacity 0.2s'
  }),

  deleteAnnotationButton: (hover: boolean): React.CSSProperties => ({
    color: hover ? '#b91c1c' : '#ef4444',
    padding: '0.25rem',
    borderRadius: '0.25rem',
    transition: 'color 0.2s'
  }),

  editCommentButton: (hover: boolean): React.CSSProperties => ({
    color: hover ? '#1d4ed8' : '#3b82f6',
    padding: '0.25rem',
    borderRadius: '0.25rem',
    transition: 'color 0.2s'
  }),

  deleteCommentButton: (hover: boolean): React.CSSProperties => ({
    color: hover ? '#c2410c' : '#f97316',
    padding: '0.25rem',
    borderRadius: '0.25rem',
    transition: 'color 0.2s'
  }),

  // Card mode styles (for Dashboard)
  annotationCard: (isMobile: boolean): React.CSSProperties => ({
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    border: '1px solid #E5E7EB',
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
    padding: isMobile ? '1rem' : '1.25rem',
    transition: 'box-shadow 200ms',
  }),

  annotationCardHover: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',

  annotationContent: {
    display: 'flex' as const,
    alignItems: 'flex-start' as const,
    gap: '0.75rem'
  },

  cardColorIndicator: (color: string): React.CSSProperties => ({
    width: '0.25rem',
    height: '100%',
    borderRadius: '9999px',
    flexShrink: 0,
    marginTop: '0.25rem',
    backgroundColor: color || '#ffff00',
  }),

  annotationText: (color: string, isMobile: boolean): React.CSSProperties => ({
    color: '#111827',
    marginBottom: '0.5rem',
    lineHeight: 1.625,
    fontSize: isMobile ? '0.875rem' : '1rem',
    backgroundColor: color ? `rgba(${[color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map(x => parseInt(x, 16)).join(', ')}, 0.2)` : 'rgba(255,255,0,0.2)',
    padding: isMobile ? '6px 10px' : '8px 12px',
    borderRadius: '4px',
    borderLeft: `3px solid ${color}`,
  }),

  cardCommentSection: {
    marginTop: '0.75rem',
    paddingLeft: '0.75rem',
    borderLeft: '2px solid #D1D5DB',
  },

  cardCommentText: {
    fontSize: '0.875rem',
    color: '#374151',
    fontStyle: 'italic',
  },

  editCommentContainer: {
    display: 'flex' as const,
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },

  commentTextarea: {
    flex: 1,
    minHeight: '60px',
    borderRadius: '0.375rem',
    border: '1px solid #D1D5DB',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
    resize: 'none' as const,
  },

  commentTextareaFocus: {
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  },

  commentButtons: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },

  saveButton: {
    padding: '0.5rem',
    backgroundColor: '#059669',
    color: 'white',
    borderRadius: '0.375rem',
    border: 'none',
    cursor: 'pointer',
  },

  saveButtonHover: {
    backgroundColor: '#047857',
  },

  cancelButton: {
    padding: '0.5rem',
    backgroundColor: '#4B5563',
    color: 'white',
    borderRadius: '0.375rem',
    border: 'none',
    cursor: 'pointer',
  },

  cancelButtonHover: {
    backgroundColor: '#374151',
  },

  annotationActions: {
    marginTop: '0.75rem',
    display: 'flex' as const,
    gap: '0.5rem',
  },

  editCommentButtonCard: {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: '0.25rem',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    borderRadius: '0.375rem',
    border: 'none',
    cursor: 'pointer',
  },

  editCommentButtonCardHover: {
    backgroundColor: '#BFDBFE',
  },

  deleteAnnotationButtonCard: {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: '0.25rem',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    borderRadius: '0.375rem',
    border: 'none',
    cursor: 'pointer',
  },

  deleteAnnotationButtonCardHover: {
    backgroundColor: '#FECACA',
  }
};

export default annotationListStyles;