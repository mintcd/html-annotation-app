"use client";

import Image from "next/image";
import { FormEvent, forwardRef, useEffect, useRef, useState, type RefObject } from "react";
import {
  FiArrowRight,
  FiCheck,
  FiClock,
  FiEdit2,
  FiFileText,
  FiLayers,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import { normalizeUrl } from "../../core/utils/url";
import { normalizeHexColor } from "../../core/persistence";
import type { AnnotationPage } from "./types";
import { formatUpdatedAt, getPageLocation, groupPagesBySite } from "./utils";
import { useClickOutside } from "@/hooks";

const SETTINGS_COLOR_GRID = [
  '#fff475',
  '#fbbc04',
  '#f28b82',
  '#ff6b6b',
  '#fdcfe8',
  '#e6c9ff',
  '#cbf0f8',
  '#87ceeb',
  '#aecbfa',
  '#a7ffeb',
  '#90ee90',
  '#ccff90',
  '#d7aefb',
  '#fdd663',
  '#d3d3d3',
  '#b0bec5',
] as const;

const DEFAULT_DRAFT_COLOR = '#87ceeb';

type PageLibraryProps = {
  pages: AnnotationPage[];
  totalAnnotations: number;
  totalUrls: number;
  searchQuery: string;
  loading: boolean;
  enterUrl: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  syncStatus: string;
  syncTone: string;
  accountLabel: string;
  signingOut: boolean;
  signOutError: string | null;
  highlightColors: HighlightColor[];
  highlightColorsLoading: boolean;
  highlightColorError: string | null;
  onAnnotateSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEnterUrlChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSignOut: () => void;
  onSaveHighlightColor: (input: HighlightColor, previousColor?: string) => Promise<void>;
  onDeleteHighlightColor: (color: string) => Promise<void>;
  onSelectPage: (normalizedUrl: string) => void;
};

export default function PageLibrary({
  pages,
  totalAnnotations,
  totalUrls,
  searchQuery,
  loading,
  enterUrl,
  searchInputRef,
  syncStatus,
  syncTone,
  accountLabel,
  signingOut,
  signOutError,
  highlightColors,
  highlightColorsLoading,
  highlightColorError,
  onAnnotateSubmit,
  onEnterUrlChange,
  onSearchQueryChange,
  onSignOut,
  onSaveHighlightColor,
  onDeleteHighlightColor,
  onSelectPage,
}: PageLibraryProps) {
  const groups = groupPagesBySite(pages);
  const hasPages = pages.length > 0;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [failedLogoSrcs, setFailedLogoSrcs] = useState<Set<string>>(new Set());

  const settingsWindowRef = useRef<HTMLDivElement>(null);
  useClickOutside(settingsWindowRef as RefObject<HTMLDivElement>, () => setSettingsOpen(false));

  useEffect(() => {
    if (!settingsOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [settingsOpen]);

  const markLogoFailed = (src: string) => {
    setFailedLogoSrcs((previous) => new Set(previous).add(src));
  };

  return (
    <section className="dashboard-library-view" aria-label="All annotated pages">
      <div className="dashboard-library-view-inner">
        <header className="dashboard-library-hero">
          <div className="dashboard-library-topbar">
            <div className="dashboard-library-brand">
              <span className="dashboard-brand-mark" aria-hidden="true">
                <FiLayers />
              </span>
              <div>
                <h1 className="dashboard-library-title">All pages</h1>
                <p className="dashboard-library-summary">
                  {searchQuery
                    ? `${pages.length} result${pages.length === 1 ? "" : "s"} matching "${searchQuery}"`
                    : `${totalUrls} page${totalUrls === 1 ? "" : "s"} with ${totalAnnotations} highlight${totalAnnotations === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>

            <div className="dashboard-settings">
              <button
                type="button"
                className="dashboard-icon-button dashboard-settings-button"
                onClick={() => setSettingsOpen((open) => !open)}
                aria-label="Open settings"
                aria-expanded={settingsOpen}
                title="Settings"
              >
                <FiSettings />
              </button>

              {settingsOpen && (
                <DashboardSettingsWindow
                  ref={settingsWindowRef}
                  accountLabel={accountLabel}
                  signingOut={signingOut}
                  signOutError={signOutError}
                  highlightColors={highlightColors}
                  highlightColorsLoading={highlightColorsLoading}
                  highlightColorError={highlightColorError}
                  onClose={() => setSettingsOpen(false)}
                  onSignOut={onSignOut}
                  onSaveHighlightColor={onSaveHighlightColor}
                  onDeleteHighlightColor={onDeleteHighlightColor}
                />
              )}
            </div>
          </div>

          <div className="dashboard-library-controls">
            <form className="dashboard-url-form dashboard-library-url-form" onSubmit={onAnnotateSubmit}>
              <input
                id="dashboard-url-input"
                type="url"
                className="dashboard-input dashboard-url-input"
                placeholder="Paste a website or document URL"
                value={enterUrl}
                onChange={(event) => onEnterUrlChange(event.target.value)}
                aria-label="URL to annotate"
              />
              <button type="submit" className="dashboard-submit-button" aria-label="Open URL in annotator">
                <FiArrowRight />
              </button>
            </form>

            <label className="dashboard-search dashboard-library-search">
              <FiSearch aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                className="dashboard-input"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search pages and notes"
                aria-label="Search annotations"
              />
            </label>

            <div className={`dashboard-sync dashboard-library-sync ${syncTone}`} title={`Sync status: ${syncStatus}`}>
              <span className="dashboard-sync-state">
                <span className="dashboard-sync-dot" aria-hidden="true" />
                <span className="dashboard-sync-copy">
                  <span className="dashboard-sync-label">Sync · {syncStatus}</span>
                </span>
              </span>
            </div>
          </div>
        </header>

        {!hasPages ? (
          <LibraryEmptyState
            searchQuery={searchQuery}
            loading={loading}
          />
        ) : (
          <div className="dashboard-page-groups">
            {groups.map((group) => (
              <section key={group.key} className="dashboard-site-section">
                <div className="dashboard-site-heading">
                  <span className="dashboard-site-label">
                    {group.logoSrc && !failedLogoSrcs.has(group.logoSrc) ? (
                      <Image
                        className="dashboard-site-logo"
                        src={group.logoSrc}
                        alt=""
                        width={22}
                        height={22}
                        loading="lazy"
                        unoptimized
                        onError={() => markLogoFailed(group.logoSrc as string)}
                      />
                    ) : (
                      <span className="dashboard-site-logo dashboard-site-logo-fallback" aria-hidden="true">
                        <FiFileText />
                      </span>
                    )}
                    <h3 className="dashboard-site-title">{group.label}</h3>
                  </span>
                  <span className="dashboard-site-count">
                    {group.pages.length} page{group.pages.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="dashboard-page-grid">
                  {group.pages.map((page) => {
                    const location = getPageLocation(page.url);
                    const title = page.title || page.siteTitle || location.host;
                    const normalizedUrl = normalizeUrl(page.url);
                    const showLogo = page.siteLogoSrc && !failedLogoSrcs.has(page.siteLogoSrc);
                    const notePreview = page.pageNote?.content.replace(/\s+/g, " ").trim();

                    return (
                      <button
                        key={page.url}
                        type="button"
                        className="dashboard-page-card"
                        onClick={() => onSelectPage(normalizedUrl)}
                        aria-label={`Open annotations for ${title}`}
                      >
                        <span className="dashboard-page-card-top">
                          <span className="dashboard-page-card-icon" aria-hidden="true">
                            {showLogo ? (
                              <Image
                                className="dashboard-page-card-logo"
                                src={page.siteLogoSrc as string}
                                alt=""
                                width={20}
                                height={20}
                                loading="lazy"
                                unoptimized
                                onError={() => markLogoFailed(page.siteLogoSrc as string)}
                              />
                            ) : (
                              <FiFileText />
                            )}
                          </span>
                          <span className="dashboard-page-card-count">
                            {page.annotations.length}
                          </span>
                        </span>
                        <span className="dashboard-page-card-title">{title}</span>
                        <span className="dashboard-page-card-url" title={page.url}>
                          {location.path}
                        </span>
                        {notePreview && (
                          <span className="dashboard-page-card-note">
                            {notePreview}
                          </span>
                        )}
                        <span className="dashboard-page-card-footer">
                          <span className="dashboard-page-card-date">
                            <FiClock aria-hidden="true" />
                            {formatUpdatedAt(page.uploadedAt)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type DashboardSettingsWindowProps = Pick<
  PageLibraryProps,
  | "accountLabel"
  | "signingOut"
  | "signOutError"
  | "highlightColors"
  | "highlightColorsLoading"
  | "highlightColorError"
  | "onSignOut"
  | "onSaveHighlightColor"
  | "onDeleteHighlightColor"
> & {
  onClose: () => void;
};

const DashboardSettingsWindow = forwardRef<HTMLDivElement, DashboardSettingsWindowProps>(
  function DashboardSettingsWindow({
    accountLabel,
    signingOut,
    signOutError,
    highlightColors,
    highlightColorsLoading,
    highlightColorError,
    onClose,
    onSignOut,
    onSaveHighlightColor,
    onDeleteHighlightColor,
  }, ref) {
    const [draftColor, setDraftColor] = useState(DEFAULT_DRAFT_COLOR);
    const [draftSemantics, setDraftSemantics] = useState('');
    const [editingColor, setEditingColor] = useState<string | null>(null);
    const [busyColor, setBusyColor] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const normalizedDraftColor = normalizeHexColor(draftColor);
    const previewColor = normalizedDraftColor ?? DEFAULT_DRAFT_COLOR;
    const isEditing = editingColor !== null;
    const deleteDisabled = highlightColors.length <= 1 || busyColor !== null;

    function resetDraft() {
      setDraftColor(DEFAULT_DRAFT_COLOR);
      setDraftSemantics('');
      setEditingColor(null);
      setFormError(null);
    }

    function editColor(color: HighlightColor) {
      setDraftColor(color.color);
      setDraftSemantics(color.semantics);
      setEditingColor(color.color);
      setFormError(null);
    }

    async function submitColor(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();

      const color = normalizeHexColor(draftColor);
      const semantics = draftSemantics.trim();
      if (!color) {
        setFormError('Enter a valid hex color.');
        return;
      }
      if (!semantics) {
        setFormError('Enter color semantics.');
        return;
      }
      if (
        highlightColors.some((item) =>
          item.color === color && item.color !== editingColor,
        )
      ) {
        setFormError('That color already exists.');
        return;
      }

      setBusyColor(editingColor ?? color);
      setFormError(null);
      try {
        await onSaveHighlightColor({ color, semantics }, editingColor ?? undefined);
        resetDraft();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Unable to save color.');
      } finally {
        setBusyColor(null);
      }
    }

    async function deleteColor(color: string) {
      if (deleteDisabled) return;

      setBusyColor(color);
      setFormError(null);
      try {
        await onDeleteHighlightColor(color);
        if (editingColor === color) resetDraft();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Unable to delete color.');
      } finally {
        setBusyColor(null);
      }
    }

    return (
      <>
        <button
          type="button"
          className="dashboard-settings-scrim"
          aria-label="Close settings"
          onClick={onClose}
        />
        <div
          ref={ref}
          className="dashboard-settings-window"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-settings-title"
        >
          <header className="dashboard-settings-window-header">
            <div>
              <h2 id="dashboard-settings-title" className="dashboard-settings-window-title">Settings</h2>
              <p className="dashboard-settings-window-subtitle">Dashboard</p>
            </div>
            <button
              type="button"
              className="dashboard-icon-button dashboard-settings-close"
              onClick={onClose}
              aria-label="Close settings"
              title="Close"
            >
              <FiX aria-hidden="true" />
            </button>
          </header>

          <section className="dashboard-settings-account" aria-label="Account">
            <div className="dashboard-settings-user">
              <FiUser aria-hidden="true" />
              <span>
                <span className="dashboard-settings-label">Signed in</span>
                <span className="dashboard-settings-value">{accountLabel}</span>
              </span>
            </div>
            <button
              type="button"
              className="dashboard-sign-out dashboard-settings-logout"
              onClick={onSignOut}
              disabled={signingOut}
            >
              <FiLogOut aria-hidden="true" />
              <span>{signingOut ? "Logging out" : "Logout"}</span>
            </button>
            {signOutError && (
              <p className="dashboard-sign-out-error dashboard-settings-error" role="alert">
                {signOutError}
              </p>
            )}
          </section>

          <section className="dashboard-settings-colors" aria-labelledby="dashboard-settings-colors-title">
            <div className="dashboard-settings-section-heading">
              <h3 id="dashboard-settings-colors-title">Highlight colors</h3>
              <span>{highlightColors.length}</span>
            </div>

            <div className="dashboard-settings-color-list" aria-busy={highlightColorsLoading}>
              {highlightColorsLoading ? (
                <p className="dashboard-settings-muted">Loading colors...</p>
              ) : highlightColors.length === 0 ? (
                <p className="dashboard-settings-muted">No colors saved.</p>
              ) : (
                highlightColors.map((color) => (
                  <div key={color.color} className="dashboard-settings-color-row">
                    <span
                      className="dashboard-settings-color-swatch"
                      style={{ backgroundColor: color.color }}
                      aria-hidden="true"
                    />
                    <span className="dashboard-settings-color-copy">
                      <span className="dashboard-settings-color-name">{color.semantics}</span>
                      <span className="dashboard-settings-color-hex">{color.color}</span>
                    </span>
                    <button
                      type="button"
                      className="dashboard-icon-button dashboard-settings-row-action"
                      onClick={() => editColor(color)}
                      disabled={busyColor !== null}
                      aria-label={`Edit ${color.semantics}`}
                      title="Edit"
                    >
                      <FiEdit2 aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="dashboard-icon-button dashboard-settings-row-action"
                      onClick={() => void deleteColor(color.color)}
                      disabled={deleteDisabled}
                      aria-label={`Delete ${color.semantics}`}
                      title={highlightColors.length <= 1 ? 'Keep at least one color' : 'Delete'}
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form className="dashboard-settings-color-form" onSubmit={(event) => void submitColor(event)}>
              <div className="dashboard-settings-picker-grid" role="grid" aria-label="Color choices">
                {SETTINGS_COLOR_GRID.map((color) => {
                  const isSelected = normalizedDraftColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      className={`dashboard-settings-picker-swatch${isSelected ? ' is-selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setDraftColor(color)}
                      aria-label={`Choose ${color}`}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <FiCheck aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              <div className="dashboard-settings-color-fields">
                <label className="dashboard-settings-field dashboard-settings-color-field">
                  <span>Color</span>
                  <span className="dashboard-settings-hex-row">
                    <input
                      type="color"
                      className="dashboard-settings-native-color"
                      value={previewColor}
                      onChange={(event) => setDraftColor(event.target.value)}
                      aria-label="Pick highlight color"
                    />
                    <input
                      className="dashboard-input dashboard-settings-hex-input"
                      value={draftColor}
                      onChange={(event) => setDraftColor(event.target.value)}
                      onBlur={() => {
                        if (normalizedDraftColor) setDraftColor(normalizedDraftColor);
                      }}
                      placeholder="#87ceeb"
                      spellCheck={false}
                      aria-invalid={normalizedDraftColor === null}
                    />
                  </span>
                </label>

                <label className="dashboard-settings-field">
                  <span>Semantics</span>
                  <input
                    className="dashboard-input dashboard-settings-text-input"
                    value={draftSemantics}
                    onChange={(event) => setDraftSemantics(event.target.value)}
                    placeholder="Reference"
                  />
                </label>
              </div>

              {(formError || highlightColorError) && (
                <p className="dashboard-settings-error" role="alert">
                  {formError || highlightColorError}
                </p>
              )}

              <div className="dashboard-settings-actions">
                {isEditing && (
                  <button
                    type="button"
                    className="dashboard-button dashboard-button-secondary"
                    onClick={resetDraft}
                    disabled={busyColor !== null}
                  >
                    <FiX aria-hidden="true" />
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="dashboard-button dashboard-button-primary"
                  disabled={busyColor !== null}
                >
                  {isEditing ? <FiCheck aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
                  {busyColor !== null ? 'Saving' : isEditing ? 'Save color' : 'Add color'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </>
    );
  },
);

type LibraryEmptyStateProps = Pick<
  PageLibraryProps,
  "searchQuery" | "loading"
>;

function LibraryEmptyState({
  searchQuery,
  loading,
}: LibraryEmptyStateProps) {
  return (
    <section className="dashboard-empty">
      <div className="dashboard-empty-card">
        <div className="dashboard-empty-visual" aria-hidden="true">
          {searchQuery ? <FiSearch /> : <FiFileText />}
        </div>
        <h2 className="dashboard-empty-title">
          {searchQuery ? "Nothing found" : "No annotated pages yet"}
        </h2>
        <p className="dashboard-empty-description">
          {searchQuery
            ? `No page, highlight, or note matches "${searchQuery}".`
            : loading
              ? "Loading your annotation library..."
              : "Add a page to begin."}
        </p>
      </div>
    </section>
  );
}
