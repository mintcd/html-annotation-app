"use client";

import Image from "next/image";
import { useRef, useState, ChangeEvent, type RefObject } from "react";
import {
  FiArrowRight,
  FiClock,
  FiFileText,
  FiLayers,
  FiLogOut,
  FiSearch,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import { normalizeUrl } from "../../core/utils/url";
import type { AnnotationPage } from "./types";
import { formatUpdatedAt, getPageLocation, groupPagesBySite } from "./utils";
import { useClickOutside } from "@/hooks";

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
  onAnnotateSubmit: (event: ChangeEvent<HTMLFormElement>) => void;
  onEnterUrlChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSignOut: () => void;
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
  onAnnotateSubmit,
  onEnterUrlChange,
  onSearchQueryChange,
  onSignOut,
  onSelectPage,
}: PageLibraryProps) {
  const groups = groupPagesBySite(pages);
  const hasPages = pages.length > 0;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [failedLogoSrcs, setFailedLogoSrcs] = useState<Set<string>>(new Set());

  const settingsMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(settingsMenuRef as RefObject<HTMLDivElement>, () => setSettingsOpen(false));

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
                <div ref={settingsMenuRef} className="dashboard-settings-menu" role="menu">
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
                    role="menuitem"
                  >
                    <FiLogOut aria-hidden="true" />
                    <span>{signingOut ? "Logging out" : "Logout"}</span>
                  </button>
                  {signOutError && (
                    <p className="dashboard-sign-out-error dashboard-settings-error" role="alert">
                      {signOutError}
                    </p>
                  )}
                </div>
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
