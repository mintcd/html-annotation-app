"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, ChevronDown, ChevronRight } from '../app/icons';
import { useClient, useMobile } from "../hooks";
import { deletePage as deletePageAPI, deleteAnnotation as deleteAnnotationAPI, updateAnnotation as updateAnnotationAPI, createPage } from '../utils/api.client';
import PromptBox from './PromptBox';
import AnnotationList from './AnnotationList';
import styles from '../styles/Dashboard.styles';
import { normalizeUrl } from '../utils/url';
import { loadAnnotations } from "@/utils/annotations";


interface AnnotationPage {
  url: string;
  filename: string;
  timestamp: string;
  title?: string;
  count: number;
  annotations: AnnotationItem[];
  blobUrl: string;
  uploadedAt: string;
}


async function navigateToPage(rawUrl: string): Promise<void> {
  const u = new URL(rawUrl);
  const res = await fetch('/api/websites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: u.origin }),
  });

  if (!res.ok) throw new Error('Failed to register website');
  const website: { id: string } = await res.json();
  window.location.href = `/${website.id}${u.pathname}${u.search}${u.hash}`;
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isClient = useClient();
  const { isMobile } = useMobile();
  const [annotationPages, setAnnotationPages] = useState<AnnotationPage[]>([]);

  // Delete and edit state
  const [deletingPages, setDeletingPages] = useState<Set<string>>(new Set());
  const [editingComment, setEditingComment] = useState<{ pageUrl: string; annotationId: string; comment: string } | null>(null);

  // Prompt state
  const [deletePagePrompt, setDeletePagePrompt] = useState<{ pageUrl: string; filename: string } | null>(null);
  const [deleteAnnotationPrompt, setDeleteAnnotationPrompt] = useState<{ pageUrl: string; annotationId: string } | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadAnnotationPages = async () => {
      const annotationPages = await loadAnnotations();
      setAnnotationPages(annotationPages);
    };
    loadAnnotationPages();
  }, []);

  // Create a map of URL to AnnotationPage from local state
  const pagesByUrl = useMemo(() => {
    const map: Record<string, AnnotationPage> = {};
    annotationPages.forEach(page => {
      const normalizedUrl = normalizeUrl(page.url);
      map[normalizedUrl] = page;
    });
    return map;
  }, [annotationPages]);

  // Filter by search query
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return annotationPages;

    const query = searchQuery.toLowerCase();

    return annotationPages.filter(page => {
      // Check if URL matches
      if (page.url.toLowerCase().includes(query)) return true;

      // Check if any annotation text or comment matches
      return page.annotations.some(ann =>
        ann.text?.toLowerCase().includes(query) ||
        ann.comment?.toLowerCase().includes(query)
      );
    });
  }, [annotationPages, searchQuery]);

  // Group pages by their origin + directory path (so folders reflect fetch location)
  const groupedByFolder = useMemo(() => {
    const map: Record<string, { origin: string; dirPath: string; pages: AnnotationPage[] }> = {};

    filteredPages.forEach(page => {
      try {
        const u = new URL(page.url);
        const pathname = u.pathname || '/';

        // Remove trailing slash for consistent splitting
        const trimmed = pathname.replace(/\/$/, '');
        const segments = trimmed.split('/').filter(Boolean); // ['entries','slug'] or ['graphics.html']

        // Parent directory: drop the last segment (the page slug). If no parent, use '/'
        const dir = segments.length > 1 ? `/${segments.slice(0, -1).join('/')}/` : '/';

        const key = `${u.origin}${dir}`;

        if (!map[key]) map[key] = { origin: u.origin, dirPath: dir, pages: [] };
        map[key].pages.push(page);
      } catch (err) {
        // fallback: group by raw url origin-less
        const key = '/';
        if (!map[key]) map[key] = { origin: '', dirPath: '/', pages: [] };
        map[key].pages.push(page);
      }
    });

    // Convert to sorted array: sort by origin then path
    const groups = Object.keys(map).map(k => ({ key: k, ...map[k] }));
    groups.sort((a, b) => {
      if (a.origin !== b.origin) return a.origin.localeCompare(b.origin);
      return a.dirPath.localeCompare(b.dirPath);
    });

    // Sort pages inside each group alphabetically by url
    groups.forEach(g => g.pages.sort((x, y) => x.url.localeCompare(y.url)));

    return groups;
  }, [filteredPages]);

  const flattenedUrls = groupedByFolder.flatMap(g => g.pages.map(p => normalizeUrl(p.url)));
  const displayedNormalizedUrl = selectedUrl || flattenedUrls[0];
  const displayedPage = displayedNormalizedUrl ? pagesByUrl[displayedNormalizedUrl] : null;
  const displayedUrl = displayedPage ? displayedPage.url : null;

  const totalAnnotations = annotationPages.reduce((sum, page) => sum + page.annotations.length, 0);
  const totalUrls = annotationPages.length;
  const annotationsRef = useRef<HTMLDivElement | null>(null);
  const [enterUrl, setEnterUrl] = useState('');


  function toggleFolder(key: string) {
    setOpenFolders(prev => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }

  async function deletePage(pageUrl: string, filename: string) {
    setDeletePagePrompt({ pageUrl, filename });
  }

  async function confirmDeletePage() {
    if (!deletePagePrompt) return;

    const { pageUrl, filename } = deletePagePrompt;
    setDeletePagePrompt(null);

    // Store the page for potential restoration if deletion fails
    const pageToDelete = annotationPages.find(page => page.url === pageUrl);
    if (!pageToDelete) return;

    // Immediately remove from local state for instant UI feedback
    setAnnotationPages(prev => prev.filter(page => page.url !== pageUrl));

    // If the deleted page was currently selected, clear selection
    if (selectedUrl === pageUrl) {
      setSelectedUrl(null);
    }

    setDeletingPages(prev => new Set(prev).add(pageUrl));

    try {
      await deletePageAPI(pageUrl);
    } catch (error) {
      // Restore the page in local state since deletion failed
      setAnnotationPages(prev => [...prev, pageToDelete].sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      ));
    } finally {
      setDeletingPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageUrl);
        return newSet;
      });
    }
  }

  async function deleteAnnotation(pageUrl: string, annotationId: string) {
    setDeleteAnnotationPrompt({ pageUrl, annotationId });
  }

  async function confirmDeleteAnnotation() {
    if (!deleteAnnotationPrompt) return;

    const { pageUrl, annotationId } = deleteAnnotationPrompt;
    setDeleteAnnotationPrompt(null);

    // Find the annotation to delete for potential restoration if deletion fails
    const pageToUpdate = annotationPages.find(page => page.url === pageUrl);
    const annotationToDelete = pageToUpdate?.annotations.find(ann => ann.id === annotationId);
    if (!pageToUpdate || !annotationToDelete) {
      alert('Annotation not found');
      return;
    }

    // Immediately update local state for instant UI feedback
    setAnnotationPages(prev => prev.map(page =>
      page.url === pageUrl
        ? {
          ...page,
          annotations: page.annotations.filter(ann => ann.id !== annotationId),
          count: page.annotations.filter(ann => ann.id !== annotationId).length
        }
        : page
    ));

    try {
      // Delete the annotation using the API
      await deleteAnnotationAPI(annotationId);
    } catch (error) {
      // Restore the annotation in local state since deletion failed
      setAnnotationPages(prev => prev.map(page =>
        page.url === pageUrl
          ? {
            ...page,
            annotations: [...page.annotations, annotationToDelete].sort((a, b) => (a.id > b.id ? 1 : -1)),
            count: page.annotations.length + 1
          }
          : page
      ));
      alert(`Error deleting annotation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  function startEditingComment(pageUrl: string, annotationId: string, currentComment: string = '') {
    setEditingComment({ pageUrl, annotationId, comment: currentComment });
  }

  function cancelEditingComment() {
    setEditingComment(null);
  }

  async function saveComment() {
    if (!editingComment) return;

    // Store the current comment for potential restoration if save fails
    const pageToUpdate = annotationPages.find(page => page.url === editingComment.pageUrl);
    const annotationToUpdate = pageToUpdate?.annotations.find(ann => ann.id === editingComment.annotationId);
    const oldComment = annotationToUpdate?.comment;

    // Immediately update local state for instant UI feedback
    setAnnotationPages(prev => prev.map(page =>
      page.url === editingComment.pageUrl
        ? {
          ...page,
          annotations: page.annotations.map(ann =>
            ann.id === editingComment.annotationId
              ? { ...ann, comment: editingComment.comment.trim() || undefined }
              : ann
          )
        }
        : page
    ));

    // Clear editing state immediately for better UX
    setEditingComment(null);

    try {
      // Find the annotation to get its text
      const annotation = pageToUpdate?.annotations.find(ann => ann.id === editingComment.annotationId);
      if (!annotation) {
        alert('Annotation not found');
        return;
      }

      // Update the annotation using the API
      await updateAnnotationAPI(editingComment.annotationId, annotation.text, annotation.html);
    } catch (error) {
      // Restore the old comment in local state since save failed
      setAnnotationPages(prev => prev.map(page =>
        page.url === editingComment.pageUrl
          ? {
            ...page,
            annotations: page.annotations.map(ann =>
              ann.id === editingComment.annotationId
                ? { ...ann, comment: oldComment }
                : ann
            )
          }
          : page
      ));
      alert(`Error saving comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function saveAndNavigateToPage(rawUrl: string) {
    const normalized = normalizeUrl(rawUrl);
    await createPage({ url: normalized })
    navigateToPage(normalized);
  }

  return (
    <div style={styles.container(isMobile)}>
      {/* Mobile backdrop */}
      {isClient && isMobile && sidebarOpen && (
        <div
          style={styles.mobileBackdrop}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - URL List */}
      {isClient && isMobile ? (
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={styles.mobileSidebar}
            >
              <div style={styles.sidebarContainer}>
                {/* Header */}
                <div style={styles.sidebarHeader}>
                  <div style={styles.sidebarHeaderContent}>
                    <div>
                      <h1 style={styles.sidebarTitle}>My Annotations</h1>
                      <p style={styles.sidebarStats}>
                        {totalAnnotations} annotation{totalAnnotations !== 1 ? 's' : ''} across {totalUrls} page{totalUrls !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      style={styles.closeButton}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      aria-label="Close sidebar"
                    >
                      <svg style={{ width: '1.5rem', height: '1.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Enter URL */}
                <div style={styles.enterUrlSection}>
                  <div style={styles.enterUrlContainer}>
                    <input
                      type="url"
                      placeholder="Enter URL to annotate"
                      value={enterUrl}
                      onChange={(e) => setEnterUrl(e.target.value)}
                      style={styles.urlInput}
                      onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'}
                      onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveAndNavigateToPage(enterUrl);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveAndNavigateToPage(enterUrl)}
                      style={styles.annotateButton}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1D4ED8'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                    >
                      Annotate
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div style={styles.searchSection}>
                  {isClient ? (
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search annotations..."
                      style={styles.searchInput}
                      onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'}
                      onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                    />
                  ) : (
                    // Render a non-interactive placeholder on the server to avoid
                    // hydration mismatches caused by browser extensions injecting
                    // attributes (e.g. Microsoft Editor's `data-ms-editor`). The
                    // real input is mounted on the client only.
                    <div aria-hidden style={styles.searchInput} />
                  )}
                </div>

                {/* URL List */}
                <div style={styles.urlListContainer}>
                  {flattenedUrls.length === 0 ? (
                    <div style={styles.noAnnotations}>
                      {searchQuery ? "No matches found" : "No annotations yet"}
                    </div>
                  ) : (
                    <div style={styles.urlListPadding}>
                      {groupedByFolder.map(group => (
                        <div key={group.key} style={styles.folderGroup}>
                          <div style={styles.folderHeader}>
                            <button
                              type="button"
                              onClick={() => toggleFolder(group.key)}
                              style={styles.folderButton}
                            >
                              {(() => {
                                const isOpen = openFolders[group.key] ?? true;
                                return (
                                  <>
                                    <span style={{ color: '#6B7280' }}>{isOpen ? <ChevronDown /> : <ChevronRight />}</span>
                                    <span style={{ color: '#D97706' }}><Folder /></span>
                                    <span style={styles.folderPath}>{group.origin}{group.dirPath}</span>
                                  </>
                                );
                              })()}
                            </button>
                          </div>

                          <AnimatePresence initial={false}>
                            {(openFolders[group.key] ?? true) && (
                              <motion.div
                                key={`pages-${group.key}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                style={{ overflow: 'hidden' }}
                                layout
                              >
                                {group.pages.map(page => {
                                  const url = page.url;
                                  const count = page.annotations.length || 0;
                                  const normalizedUrl = normalizeUrl(url);
                                  const isSelected = normalizedUrl === selectedUrl;

                                  return (
                                    <button
                                      key={url}
                                      onClick={() => {
                                        setSelectedUrl(normalizedUrl);
                                        if (isClient && isMobile) setSidebarOpen(false);
                                      }}
                                      style={styles.pageButton(isSelected)}
                                      onMouseEnter={(e) => {
                                        if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB';
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                      }}
                                    >
                                      <div style={styles.pageContent}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={styles.pageButtonTitle}>
                                            {page?.title ?? url}
                                          </div>
                                        </div>
                                        <span style={styles.annotationCount}>
                                          {count}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      ) : (
        <aside style={{ ...styles.sidebarContainer, ...styles.desktopSidebar }}>
          {/* Header */}
          <div style={styles.sidebarHeader}>
            <div style={styles.sidebarHeaderContent}>
              <div>
                <p style={styles.sidebarStats}>
                  {totalAnnotations} annotation{totalAnnotations !== 1 ? 's' : ''} across {totalUrls} page{totalUrls !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Enter URL */}
          <div style={styles.enterUrlSection}>
            <div style={styles.enterUrlContainer}>
              <input
                type="url"
                placeholder="Enter URL to annotate"
                value={enterUrl}
                onChange={(e) => setEnterUrl(e.target.value)}
                style={styles.urlInput}
                onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'}
                onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveAndNavigateToPage(enterUrl);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => saveAndNavigateToPage(enterUrl)}
                style={styles.annotateButton}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1D4ED8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
              >
                Annotate
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={styles.searchSection}>
            {isClient ? (
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search annotations..."
                style={styles.searchInput}
                onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'}
                onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
              />
            ) : (
              <div aria-hidden style={styles.searchInput} />
            )}
          </div>

          {/* URL List */}
          <div style={styles.urlListContainer}>
            {flattenedUrls.length === 0 ? (
              <div style={styles.noAnnotations}>
                {searchQuery ? "No matches found" : "No annotations yet"}
              </div>
            ) : (
              <div style={styles.urlListPadding}>
                {groupedByFolder.map(group => (
                  <div key={group.key} style={styles.folderGroup}>
                    <div style={styles.folderHeader}>
                      <button
                        type="button"
                        onClick={() => toggleFolder(group.key)}
                        style={styles.folderButton}
                      >
                        {(() => {
                          const isOpen = openFolders[group.key] ?? true;
                          return (
                            <>
                              <span style={{ color: '#6B7280' }}>{isOpen ? <ChevronDown /> : <ChevronRight />}</span>
                              <span style={{ color: '#D97706' }}><Folder /></span>
                              <span style={styles.folderPath}>{group.origin}{group.dirPath}</span>
                            </>
                          );
                        })()}
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {(openFolders[group.key] ?? true) && (
                        <motion.div
                          key={`pages-${group.key}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          style={{ overflow: 'hidden' }}
                          layout
                        >
                          {group.pages.map(page => {
                            const url = page.url;
                            const count = page.annotations.length || 0;
                            const normalizedUrl = normalizeUrl(url);
                            const isSelected = normalizedUrl === selectedUrl;

                            return (
                              <button
                                key={url}
                                onClick={() => {
                                  setSelectedUrl(normalizedUrl);
                                  if (isClient && isMobile) setSidebarOpen(false);
                                }}
                                style={styles.pageButton(isSelected)}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <div style={styles.pageContent}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={styles.pageButtonTitle}>
                                      {page?.title ?? url}
                                    </div>
                                  </div>
                                  <span style={styles.annotationCount}>
                                    {count}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Content - Annotation Details */}
      <div style={styles.mainContent}>
        {/* Mobile header with menu button */}
        <div style={styles.mobileHeader}>
          {isMobile && <button
            onClick={() => setSidebarOpen(true)}
            style={styles.menuButton}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Open sidebar"
          >
            <svg style={{ width: '1.5rem', height: '1.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>}
        </div>
        {displayedUrl && displayedPage ? (
          <>
            {/* Page Header */}
            <div style={styles.pageHeader}>
              <div style={styles.pageHeaderContent}>
                <h2 style={styles.pageTitle}>
                  {displayedPage?.title ?? displayedUrl}
                </h2>
                <a
                  href={displayedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.pageUrl}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  {displayedUrl}
                </a>
                <div style={styles.pageMeta}>
                  {displayedPage.annotations.length} annotation{displayedPage.annotations.length !== 1 ? 's' : ''}
                  {' • '}
                  Last updated: {new Date(displayedPage.uploadedAt).toLocaleString()}
                </div>
                {/* Action buttons - Mobile responsive */}
                <div style={styles.actionButtons}>
                  <button
                    onClick={() => saveAndNavigateToPage(displayedUrl)}
                    style={styles.viewPageButton}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1D4ED8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                  >
                    View Page
                  </button>
                  <button
                    onClick={() => deletePage(displayedUrl, displayedPage.filename)}
                    disabled={deletingPages.has(displayedUrl)}
                    style={styles.deletePageButton(deletingPages.has(displayedUrl))}
                    onMouseEnter={(e) => {
                      if (!deletingPages.has(displayedUrl)) e.currentTarget.style.backgroundColor = '#B91C1C';
                    }}
                    onMouseLeave={(e) => {
                      if (!deletingPages.has(displayedUrl)) e.currentTarget.style.backgroundColor = '#DC2626';
                    }}
                  >
                    {deletingPages.has(displayedUrl) ? 'Deleting...' : 'Delete Page'}
                  </button>
                </div>
              </div>
            </div>

            {/* Annotations List */}
            <div ref={/* annotation container for math rendering */ annotationsRef} style={styles.annotationsContainer(isMobile)}>
              <AnnotationList
                mode="card"
                annotations={displayedPage.annotations}
                onDeleteAnnotation={(id: string) => deleteAnnotation(displayedUrl, id)}
                editingComment={editingComment?.pageUrl === displayedUrl ? { annotationId: editingComment.annotationId, comment: editingComment.comment } : null}
                onStartEditingComment={(id: string, comment: string) => startEditingComment(displayedUrl, id, comment)}
                onCancelEditingComment={cancelEditingComment}
                onSaveComment={saveComment}
              />
            </div>
          </>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateContent}>
              <p style={styles.emptyStateTitle}>No annotations to display</p>
              <p style={styles.emptyStateDescription}>
                {searchQuery
                  ? "Try a different search query"
                  : "Start annotating pages to see them here"}
              </p>
              {!searchQuery && (
                <div style={styles.emptyStateForm}>
                  <div style={styles.emptyStateInputRow}>
                    <input
                      type="url"
                      placeholder="Enter URL to annotate"
                      value={enterUrl}
                      onChange={(e) => setEnterUrl(e.target.value)}
                      style={styles.emptyStateUrlInput}
                      onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'}
                      onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveAndNavigateToPage(enterUrl);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveAndNavigateToPage(enterUrl)}
                      style={styles.emptyStateAnnotateButton}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1D4ED8'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                    >
                      Annotate
                    </button>
                  </div>
                  <p style={styles.emptyStateHint}>Press Enter to start annotating</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Page Prompt */}
      {deletePagePrompt && (
        <PromptBox
          message={`Are you sure you want to delete all annotations for "${deletePagePrompt.pageUrl}"? This action cannot be undone.`}
          actions={[
            {
              label: 'Cancel',
              action: () => setDeletePagePrompt(null),
              variant: 'secondary'
            },
            {
              label: 'Delete',
              action: confirmDeletePage,
              variant: 'destructive'
            }
          ]}
          onClose={() => setDeletePagePrompt(null)}
        />
      )}

      {/* Delete Annotation Prompt */}
      {deleteAnnotationPrompt && (
        <PromptBox
          message="Are you sure you want to delete this annotation? This action cannot be undone."
          actions={[
            {
              label: 'Cancel',
              action: () => setDeleteAnnotationPrompt(null),
              variant: 'secondary'
            },
            {
              label: 'Delete',
              action: confirmDeleteAnnotation,
              variant: 'destructive'
            }
          ]}
          onClose={() => setDeleteAnnotationPrompt(null)}
        />
      )}
    </div>
  );
}
