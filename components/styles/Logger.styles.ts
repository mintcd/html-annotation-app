type LoggerStyles = {
  container: React.CSSProperties;
  titleStrong: React.CSSProperties;
  sectionHeader: React.CSSProperties;
  loadingSignal: React.CSSProperties;
  code: React.CSSProperties;
  errorMessage: React.CSSProperties;
  rangeSection: React.CSSProperties;
  rangeResultsContainer: React.CSSProperties;
  rangeResultHeader: React.CSSProperties;
  rangeResultStatus: React.CSSProperties;
  rangeResultStrong: (success: boolean) => React.CSSProperties;
  rangeSnippet: React.CSSProperties;
  rangeMessage: React.CSSProperties;
  actionMessage: React.CSSProperties;
  actionButtons: React.CSSProperties;
  reloadButton: React.CSSProperties;
  removeButton: React.CSSProperties;
};

const loggerStyles: LoggerStyles = {
  container: {
    maxWidth: '360px',
    maxHeight: '700px',
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    padding: '2rem',
    border: '1px solid #D1D5DB',
    transition: 'all 500ms ease-in-out'
  },

  titleStrong: {
    wordBreak: 'break-all' as const
  },


  sectionHeader: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center'
  },

  loadingSignal: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.875rem',
    color: '#4B5563',
  },

  code: {
    padding: '0.25rem 0.5rem',
    marginLeft: '0.5rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    width: '100%'
  },


  errorMessage: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.875rem',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    padding: '0.5rem',
    borderRadius: '0.25rem',
    transition: 'all 300ms'
  },

  rangeSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: '0.5rem',
    padding: '1rem',
    borderLeft: '4px solid #10B981',
    transition: 'all 300ms'
  },

  rangeResultsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem'
  },

  rangeResultHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '0.25rem'
  },

  rangeResultStatus: {
    marginRight: '0.5rem'
  },

  rangeResultStrong: (success: boolean): React.CSSProperties => ({
    fontSize: '0.875rem',
    ...(success ? { color: '#047857' } : { color: '#B91C1C' })
  }),

  rangeSnippet: {
    fontSize: '0.75rem',
    color: '#4B5563',
    fontStyle: 'italic',
    marginBottom: '0.25rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },

  rangeMessage: {
    fontSize: '0.75rem',
    color: '#6B7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },

  actionMessage: {
    fontSize: '0.875rem',
    color: '#A16207',
    marginBottom: '0.5rem'
  },

  actionButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },

  reloadButton: {
    padding: '0.25rem 0.75rem',
    fontSize: '0.875rem',
    backgroundColor: '#2563EB',
    color: 'white',
    borderRadius: '0.25rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 200ms'
  },

  removeButton: {
    padding: '0.25rem 0.75rem',
    fontSize: '0.875rem',
    backgroundColor: '#DC2626',
    color: 'white',
    borderRadius: '0.25rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 200ms'
  }
};

export default loggerStyles;