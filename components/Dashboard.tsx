"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiLayers,
  FiLock,
  FiLogIn,
  FiMenu,
  FiUser,
  FiUserPlus,
} from 'react-icons/fi';
import { useMobile } from "../hooks";
import ActionDialog from './ActionDialog';
import { dashboardCss } from './styles/Dashboard.styles';
import { normalizeUrl } from '../core/utils/url';
import DashboardControls from "./dashboard/DashboardControls";
import PageDetail from "./dashboard/PageDetail";
import PageLibrary from "./dashboard/PageLibrary";
import type { AnnotationPage, EditingCommentState } from "./dashboard/types";
import { toAbsoluteUrl } from "./dashboard/utils";
import {
  deleteAnnotationRow,
  deletePageRow,
  ensurePage,
  ensureWebsiteAvailableForRoute,
  findWebsiteByOrigin,
  getOrCreateWebsite,
  normalizeAnnotationRow,
  syncTimestamp,
  updateAnnotationRow,
  type AppSyncRuntime,
  useSyncRows,
  useSyncRuntime,
  useSyncStatus,
} from '../core/persistence';
import { deleteFrameBundle } from '../core/frame/cache';

async function navigateToPage(
  rawUrl: string,
  runtime: AppSyncRuntime,
): Promise<void> {
  const absoluteUrl = toAbsoluteUrl(rawUrl);
  if (!absoluteUrl) throw new Error('Please enter a valid URL');

  const u = new URL(absoluteUrl);
  const website = await getOrCreateWebsite(u.origin, runtime);
  await ensureWebsiteAvailableForRoute(website);
  window.location.href = `/${website.id}${u.pathname}${u.search}${u.hash}`;
}

export default function Dashboard() {
  const sync = useSyncStatus();

  if (!sync.sessionReady) {
    return <DashboardSessionLoading />;
  }

  if (!sync.session.authenticated) {
    return <AuthDashboard sync={sync} />;
  }

  return <AuthenticatedDashboard />;
}

type DashboardSync = ReturnType<typeof useSyncStatus>;

function DashboardSessionLoading() {
  return (
    <div className="dashboard-shell dashboard-auth-shell">
      <style>{dashboardCss}</style>
      <main className="dashboard-auth-main">
        <section className="dashboard-auth-panel" aria-busy="true">
          <div className="dashboard-auth-brand">
            <span className="dashboard-brand-mark" aria-hidden="true">
              <FiLayers />
            </span>
            <div>
              <h1 className="dashboard-auth-title">Annotation Studio</h1>
              <p className="dashboard-auth-subtitle">Opening session</p>
            </div>
          </div>
          <p className="dashboard-auth-status">Loading...</p>
        </section>
      </main>
    </div>
  );
}

function AuthDashboard({ sync }: { sync: DashboardSync }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setAuthError(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : `Authentication failed with HTTP ${response.status}`,
        );
      }
      await sync.refreshSession();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dashboard-shell dashboard-auth-shell">
      <style>{dashboardCss}</style>
      <main className="dashboard-auth-main">
        <section className="dashboard-auth-panel">
          <div className="dashboard-auth-brand">
            <span className="dashboard-brand-mark" aria-hidden="true">
              <FiLayers />
            </span>
            <div>
              <h1 className="dashboard-auth-title">Annotation Studio</h1>
              <p className="dashboard-auth-subtitle">Account</p>
            </div>
          </div>

          <div className="dashboard-auth-tabs" role="tablist" aria-label="Account mode">
            <button
              type="button"
              className={`dashboard-auth-tab${mode === 'login' ? ' is-selected' : ''}`}
              onClick={() => {
                setMode('login');
                setAuthError(null);
              }}
              aria-selected={mode === 'login'}
              role="tab"
            >
              <FiLogIn aria-hidden="true" />
              Login
            </button>
            <button
              type="button"
              className={`dashboard-auth-tab${mode === 'signup' ? ' is-selected' : ''}`}
              onClick={() => {
                setMode('signup');
                setAuthError(null);
              }}
              aria-selected={mode === 'signup'}
              role="tab"
            >
              <FiUserPlus aria-hidden="true" />
              Sign up
            </button>
          </div>

          <form className="dashboard-auth-form" onSubmit={submitAuth}>
            <label className="dashboard-auth-field">
              <span>Username</span>
              <span className="dashboard-auth-input-row">
                <FiUser aria-hidden="true" />
                <input
                  className="dashboard-input"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </span>
            </label>

            <label className="dashboard-auth-field">
              <span>Password</span>
              <span className="dashboard-auth-input-row">
                <FiLock aria-hidden="true" />
                <input
                  className="dashboard-input"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </span>
            </label>

            {authError && (
              <p className="dashboard-auth-error" role="alert">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="dashboard-button dashboard-button-primary"
              disabled={submitting}
            >
              {mode === 'login' ? <FiLogIn aria-hidden="true" /> : <FiUserPlus aria-hidden="true" />}
              {submitting ? 'Working...' : mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function AuthenticatedDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const { isMobile } = useMobile();
  const sync = useSyncStatus();
  const runtime = useSyncRuntime();
  const pages = useSyncRows('pages');
  const annotations = useSyncRows('annotations');

  const annotationPages = useMemo<AnnotationPage[]>(() => {
    const annotationRows = (annotations.data ?? []).map((row) =>
      normalizeAnnotationRow(row as unknown as Record<string, unknown>),
    );

    return (pages.data ?? []).map((page) => {
      const pageAnnotations = annotationRows.filter((annotation) =>
        annotation.page_id === page.id || annotation.page_id === page.url,
      );
      return {
        url: page.url,
        filename: `${page.id}.json`,
        timestamp: page.created_at,
        title: page.title || undefined,
        count: pageAnnotations.length,
        annotations: pageAnnotations,
        blobUrl: '',
        uploadedAt: page.updated_at,
      };
    }).sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  }, [annotations.data, pages.data]);

  const dataError = pages.error || annotations.error;

  const [deletingPages, setDeletingPages] = useState<Set<string>>(new Set());
  const [editingComment, setEditingComment] = useState<EditingCommentState | null>(null);
  const [deletePagePrompt, setDeletePagePrompt] = useState<{
    pageUrl: string;
    filename: string;
  } | null>(null);
  const [deleteAnnotationPrompt, setDeleteAnnotationPrompt] = useState<{
    pageUrl: string;
    annotationId: string;
  } | null>(null);
  const [enterUrl, setEnterUrl] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const pagesByUrl = useMemo(() => {
    const map: Record<string, AnnotationPage> = {};
    annotationPages.forEach((page) => {
      map[normalizeUrl(page.url)] = page;
    });
    return map;
  }, [annotationPages]);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return annotationPages;

    const query = searchQuery.toLowerCase();
    return annotationPages.filter((page) => {
      if (page.title?.toLowerCase().includes(query)) return true;
      if (page.url.toLowerCase().includes(query)) return true;

      return page.annotations.some((annotation) =>
        annotation.text?.toLowerCase().includes(query)
        || annotation.comment?.toLowerCase().includes(query),
      );
    });
  }, [annotationPages, searchQuery]);

  const selectedPage = selectedUrl ? pagesByUrl[selectedUrl] ?? null : null;
  const totalAnnotations = annotationPages.reduce(
    (sum, page) => sum + page.annotations.length,
    0,
  );
  const totalUrls = annotationPages.length;
  const syncStatus = String(sync.status ?? 'ready');
  const normalizedSyncStatus = syncStatus.toLowerCase();
  const syncTone = /error|failed|offline/.test(normalizedSyncStatus)
    ? 'is-error'
    : /sync|push|pull|connect|load/.test(normalizedSyncStatus)
      ? 'is-busy'
      : '';

  function deletePage(pageUrl: string, filename: string) {
    setDeletePagePrompt({ pageUrl, filename });
  }

  async function confirmDeletePage() {
    if (!deletePagePrompt) return;

    const { pageUrl } = deletePagePrompt;
    setDeletePagePrompt(null);

    const pageToDelete = annotationPages.find((page) => page.url === pageUrl);
    const pageRow = (pages.data ?? []).find((page) => page.url === pageUrl);
    if (!pageToDelete || !pageRow) return;

    if (selectedUrl === normalizeUrl(pageUrl)) setSelectedUrl(null);
    setDeletingPages((previous) => new Set(previous).add(pageUrl));

    try {
      for (const annotation of pageToDelete.annotations) {
        await deleteAnnotationRow(annotation.id, runtime);
      }
      await deletePageRow(pageRow.id, runtime);

      try {
        const sourceUrl = new URL(pageUrl);
        const website = await findWebsiteByOrigin(sourceUrl.origin, runtime);
        if (website) {
          const pathname = sourceUrl.pathname === '/' ? '' : sourceUrl.pathname;
          await deleteFrameBundle(`/frame/${website.id}${pathname}${sourceUrl.search}`);
        }
      } catch (cacheError) {
        // The synced page deletion is authoritative. A cache cleanup failure
        // should not make the user repeat it.
        console.warn('Failed to remove the saved page bundle', cacheError);
      }
    } catch (error) {
      alert(`Error deleting page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingPages((previous) => {
        const next = new Set(previous);
        next.delete(pageUrl);
        return next;
      });
    }
  }

  function deleteAnnotation(pageUrl: string, annotationId: string) {
    setDeleteAnnotationPrompt({ pageUrl, annotationId });
  }

  async function confirmDeleteAnnotation() {
    if (!deleteAnnotationPrompt) return;

    const { pageUrl, annotationId } = deleteAnnotationPrompt;
    setDeleteAnnotationPrompt(null);

    const pageToUpdate = annotationPages.find((page) => page.url === pageUrl);
    const annotationToDelete = pageToUpdate?.annotations.find(
      (annotation) => annotation.id === annotationId,
    );
    if (!pageToUpdate || !annotationToDelete) {
      alert('Annotation not found');
      return;
    }

    try {
      await deleteAnnotationRow(annotationId, runtime);
    } catch (error) {
      alert(`Error deleting annotation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  function startEditingComment(
    pageUrl: string,
    annotationId: string,
    currentComment = '',
  ) {
    setEditingComment({ pageUrl, annotationId, comment: currentComment });
  }

  function cancelEditingComment() {
    setEditingComment(null);
  }

  async function saveComment() {
    if (!editingComment) return;

    const edit = editingComment;
    setEditingComment(null);

    try {
      await updateAnnotationRow(edit.annotationId, {
        comment: edit.comment.trim() || null,
        updated_at: syncTimestamp(),
      }, runtime);
    } catch (error) {
      alert(`Error saving comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function saveAndNavigateToPage(rawUrl: string) {
    try {
      const absoluteUrl = toAbsoluteUrl(rawUrl);
      if (!absoluteUrl) throw new Error('Please enter a valid URL');
      const normalized = normalizeUrl(absoluteUrl);

      await ensurePage(normalized, '', runtime);
      await navigateToPage(normalized, runtime);
    } catch (error) {
      alert(`Error opening page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const handleAnnotateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveAndNavigateToPage(enterUrl);
  };

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError(null);

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      });

      const body = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : `Logout failed with HTTP ${response.status}`,
        );
      }

      await sync.refreshSession();
      setSidebarOpen(false);
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Unable to log out');
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    if (selectedUrl && !pages.loading && !annotations.loading && !selectedPage) {
      setSelectedUrl(null);
    }
  }, [annotations.loading, pages.loading, selectedPage, selectedUrl]);

  const controlPanel = (
    <DashboardControls
      isMobile={isMobile}
      totalAnnotations={totalAnnotations}
      totalUrls={totalUrls}
      enterUrl={enterUrl}
      searchQuery={searchQuery}
      searchInputRef={searchInputRef}
      syncStatus={syncStatus}
      syncTone={syncTone}
      userId={String(sync.session.userId)}
      signingOut={signingOut}
      signOutError={signOutError}
      onAnnotateSubmit={handleAnnotateSubmit}
      onEnterUrlChange={setEnterUrl}
      onSearchQueryChange={setSearchQuery}
      onSignOut={() => void signOut()}
      onClose={() => setSidebarOpen(false)}
    />
  );

  return (
    <div className="dashboard-shell">
      <style>{dashboardCss}</style>

      {dataError && (
        <div className="dashboard-error" role="alert">
          <strong>Local data is unavailable.</strong>{' '}
          {String(dataError)}
        </div>
      )}

      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <>
            <motion.button
              type="button"
              className="dashboard-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              aria-label="Close controls"
            />
            <motion.aside
              className="dashboard-sidebar dashboard-mobile-sidebar"
              initial={{ x: '-100%', opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0.6 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            >
              {controlPanel}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {!isMobile && <aside className="dashboard-sidebar">{controlPanel}</aside>}

      <main className="dashboard-main">
        {isMobile && (
          <header className="dashboard-mobile-header">
            <button
              type="button"
              className="dashboard-icon-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open dashboard controls"
            >
              <FiMenu />
            </button>
            <span className="dashboard-mobile-title">Annotation Studio</span>
            <span style={{ width: '2.35rem' }} aria-hidden="true" />
          </header>
        )}

        {selectedPage ? (
          <PageDetail
            page={selectedPage}
            deleting={deletingPages.has(selectedPage.url)}
            editingComment={editingComment}
            onBack={() => setSelectedUrl(null)}
            onOpenAnnotator={(pageUrl) => void saveAndNavigateToPage(pageUrl)}
            onDeletePage={deletePage}
            onDeleteAnnotation={deleteAnnotation}
            onStartEditingComment={startEditingComment}
            onCancelEditingComment={cancelEditingComment}
            onSaveComment={saveComment}
          />
        ) : (
          <PageLibrary
            pages={filteredPages}
            totalAnnotations={totalAnnotations}
            totalUrls={totalUrls}
            searchQuery={searchQuery}
            loading={pages.loading || annotations.loading}
            enterUrl={enterUrl}
            onAnnotateSubmit={handleAnnotateSubmit}
            onEnterUrlChange={setEnterUrl}
            onSelectPage={(normalizedUrl) => {
              setSelectedUrl(normalizedUrl);
              setSidebarOpen(false);
            }}
          />
        )}
      </main>

      {deletePagePrompt && (
        <ActionDialog
          message={`Are you sure you want to delete all annotations for "${deletePagePrompt.pageUrl}"? This action cannot be undone.`}
          actions={[
            { label: 'Cancel', action: () => setDeletePagePrompt(null), variant: 'secondary' },
            { label: 'Delete', action: confirmDeletePage, variant: 'destructive' },
          ]}
          onClose={() => setDeletePagePrompt(null)}
        />
      )}

      {deleteAnnotationPrompt && (
        <ActionDialog
          message="Are you sure you want to delete this annotation? This action cannot be undone."
          actions={[
            { label: 'Cancel', action: () => setDeleteAnnotationPrompt(null), variant: 'secondary' },
            { label: 'Delete', action: confirmDeleteAnnotation, variant: 'destructive' },
          ]}
          onClose={() => setDeleteAnnotationPrompt(null)}
        />
      )}
    </div>
  );
}
