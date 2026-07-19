import { CSSProperties } from 'react';

export default {
  container: (isMobile: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    height: '100vh',
    backgroundColor: '#F9FAFB',
    position: 'relative',
  }),

  mobileBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 40,
  },

  mobileSidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    width: '100%',
    maxHeight: '85vh',
    overflow: 'auto',
  },

  sidebarContainer: {
    borderRight: '1px solid',
    backgroundColor: 'white',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
  },

  desktopSidebar: {
    width: '20rem',
  },

  sidebarHeader: {
    padding: '1rem',
    borderBottom: '1px solid',
  },

  sidebarHeaderContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sidebarTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#1F2937',
  },

  sidebarStats: {
    fontSize: '0.875rem',
    color: '#4B5563',
    marginTop: '0.25rem',
  },

  closeButton: {
    padding: '0.5rem',
    borderRadius: '0.375rem',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },

  closeButtonHover: {
    backgroundColor: '#F3F4F6',
  },

  enterUrlSection: {
    padding: '1rem',
    borderBottom: '1px solid',
  },

  enterUrlContainer: {
    display: 'flex',
    gap: '0.5rem',
  },

  urlInput: {
    flex: 1,
    borderRadius: '0.375rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
  },

  urlInputFocus: {
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  },

  annotateButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    backgroundColor: '#2563EB',
    color: 'white',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    border: 'none',
    cursor: 'pointer',

  },

  annotateButtonHover: {
    backgroundColor: '#1D4ED8',
  },

  searchSection: {
    padding: '1rem',
    borderBottom: '1px solid',
  },

  searchInput: {
    width: '100%',
    borderRadius: '0.375rem',
    border: '1px solid #D1D5DB',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
  },

  searchInputFocus: {
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  },

  urlListContainer: {
    flex: 1,
    overflowY: 'auto',
  },

  urlListPadding: {
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
  },

  noAnnotations: {
    padding: '1rem',
    textAlign: 'center',
    color: '#6B7280',
  },

  folderGroup: {
    marginBottom: '0.5rem',
  },

  folderHeader: {
    padding: '0.5rem 1rem',
    fontSize: '0.75rem',
    color: '#6B7280',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  folderButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textAlign: 'left',
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },

  folderPath: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  pageButton: (isSelected: boolean): CSSProperties => ({
    width: '100%',
    padding: '0.75rem 1rem',
    textAlign: 'left',
    transition: 'background-color 200ms',
    backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
    borderLeft: isSelected ? '4px solid #3B82F6' : '4px solid transparent',
    // Avoid using the shorthand `border` when also setting `borderLeft`.
    // Setting the other sides explicitly prevents style conflicts during re-renders.
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    cursor: 'pointer',
  }),

  pageButtonHover: {
    backgroundColor: '#F9FAFB',
  },

  pageContent: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },

  pageButtonTitle: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#111827',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  annotationCount: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.5rem',
    height: '1.5rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    borderRadius: '9999px',
  },

  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  mobileHeader: {
    backgroundColor: 'white',
    padding: '0.75rem 1rem',
    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  menuButton: {
    padding: '0.5rem',
    borderRadius: '0.375rem',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },

  menuButtonHover: {
    backgroundColor: '#F3F4F6',
  },

  pageHeader: {
    backgroundColor: 'white',
    padding: '1rem 1.5rem',
    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)',
  },

  pageHeaderContent: {
    flex: 1,
    minWidth: 0,
  },

  pageTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '0.25rem',
  },

  pageUrl: {
    fontSize: '0.875rem',
    color: '#2563EB',
    textDecoration: 'none',
  },

  pageUrlHover: {
    textDecoration: 'underline',
  },

  pageMeta: {
    marginTop: '0.5rem',
    fontSize: '0.75rem',
    color: '#6B7280',
  },

  actionButtons: {
    marginTop: '0.75rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },

  viewPageButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.375rem 0.625rem',
    backgroundColor: '#2563EB',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 500,
    borderRadius: '0.375rem',
  },

  viewPageButtonHover: {
    backgroundColor: '#1D4ED8',
  },

  deletePageButton: (disabled: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.375rem 0.625rem',
    backgroundColor: '#DC2626',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 500,
    borderRadius: '0.375rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }),

  deletePageButtonHover: {
    backgroundColor: '#B91C1C',
  },

  annotationsContainer: (isMobile: boolean): CSSProperties => ({
    flex: 1,
    overflowY: 'auto',
    padding: isMobile ? '1rem' : '1.5rem',
  }),

  annotationsWrapper: {
    maxWidth: '56rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },

  annotationCard: (isMobile: boolean): CSSProperties => ({
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    border: '1px solid #E5E7EB',
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
    padding: isMobile ? '1rem' : '1.25rem',
    transition: 'box-shadow 200ms',
  }),

  annotationCardHover: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',

  annotationContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },

  colorIndicator: (color: string): CSSProperties => ({
    width: '0.25rem',
    height: '100%',
    borderRadius: '9999px',
    flexShrink: 0,
    marginTop: '0.25rem',
    backgroundColor: color || '#ffff00',
  }),

  annotationText: (color: string, isMobile: boolean): CSSProperties => ({
    color: '#111827',
    marginBottom: '0.5rem',
    lineHeight: 1.625,
    fontSize: isMobile ? '0.875rem' : '1rem',
    backgroundColor: color ? `rgba(${[color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map(x => parseInt(x, 16)).join(', ')}, 0.2)` : 'rgba(255,255,0,0.2)',
    padding: isMobile ? '6px 10px' : '8px 12px',
    borderRadius: '4px',
    borderLeft: `3px solid ${color}`,
  }),

  commentSection: {
    marginTop: '0.75rem',
    paddingLeft: '0.75rem',
    borderLeft: '2px solid #D1D5DB',
  },

  commentText: {
    fontSize: '0.875rem',
    color: '#374151',
    fontStyle: 'italic',
  },

  editCommentContainer: {
    display: 'flex',
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
    resize: 'none',
  },

  commentTextareaFocus: {
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  },

  commentButtons: {
    display: 'flex',
    flexDirection: 'column',
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
    display: 'flex',
    gap: '0.5rem',
  },

  editCommentButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    borderRadius: '0.375rem',
    border: 'none',
    cursor: 'pointer',
  },

  editCommentButtonHover: {
    backgroundColor: '#BFDBFE',
  },

  deleteAnnotationButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    borderRadius: '0.375rem',
    border: 'none',
    cursor: 'pointer',
  },

  deleteAnnotationButtonHover: {
    backgroundColor: '#FECACA',
  },

  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6B7280',
    padding: '1rem',
  },

  emptyStateContent: {
    textAlign: 'center',
  },

  emptyStateTitle: {
    fontSize: '1.125rem',
    fontWeight: 500,
  },

  emptyStateDescription: {
    fontSize: '0.875rem',
    marginTop: '0.5rem',
  },

  emptyStateHint: {
    fontSize: '0.75rem',
    color: '#6B7280',
    marginTop: '0.5rem',
    textAlign: 'center',
  },

  emptyStateForm: {
    marginTop: '1.5rem',
    width: '100%',
    maxWidth: '28rem',
  },

  emptyStateInputRow: {
    display: 'flex',
    gap: '0.5rem',
  },

  emptyStateUrlInput: {
    flex: 1,
    borderRadius: '0.375rem',
    border: '1px solid #D1D5DB',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
  },

  emptyStateAnnotateButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    backgroundColor: '#2563EB',
    color: 'white',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    border: 'none',
    cursor: 'pointer',
  },
} as Styles