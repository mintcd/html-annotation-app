"use client";

import type { ChangeEvent } from "react";
import {
  FiArrowRight,
  FiClock,
  FiFileText,
  FiLayers,
  FiSearch,
} from "react-icons/fi";
import { normalizeUrl } from "../../core/utils/url";
import type { AnnotationPage } from "./types";
import { formatUpdatedAt, getPageLocation, groupPagesBySite } from "./utils";

type PageLibraryProps = {
  pages: AnnotationPage[];
  totalAnnotations: number;
  totalUrls: number;
  searchQuery: string;
  loading: boolean;
  enterUrl: string;
  onAnnotateSubmit: (event: ChangeEvent<HTMLFormElement>) => void;
  onEnterUrlChange: (value: string) => void;
  onSelectPage: (normalizedUrl: string) => void;
};

export default function PageLibrary({
  pages,
  totalAnnotations,
  totalUrls,
  searchQuery,
  loading,
  enterUrl,
  onAnnotateSubmit,
  onEnterUrlChange,
  onSelectPage,
}: PageLibraryProps) {
  const groups = groupPagesBySite(pages);
  const hasPages = pages.length > 0;

  return (
    <section className="dashboard-library-view" aria-label="All annotated pages">
      <div className="dashboard-library-view-inner">
        <header className="dashboard-library-hero">
          <p className="dashboard-eyebrow">
            <FiLayers aria-hidden="true" />
            Library
          </p>
          <h2 className="dashboard-library-title">All pages</h2>
          <p className="dashboard-library-summary">
            {searchQuery
              ? `${pages.length} result${pages.length === 1 ? "" : "s"} matching "${searchQuery}"`
              : `${totalUrls} page${totalUrls === 1 ? "" : "s"} with ${totalAnnotations} highlight${totalAnnotations === 1 ? "" : "s"}`}
          </p>
          <div className="dashboard-meta-row">
            <span className="dashboard-meta-chip">
              <FiFileText aria-hidden="true" />
              {totalUrls} page{totalUrls === 1 ? "" : "s"}
            </span>
            <span className="dashboard-meta-chip">
              <FiLayers aria-hidden="true" />
              {totalAnnotations} annotation{totalAnnotations === 1 ? "" : "s"}
            </span>
          </div>
        </header>

        {!hasPages ? (
          <LibraryEmptyState
            searchQuery={searchQuery}
            loading={loading}
            enterUrl={enterUrl}
            onAnnotateSubmit={onAnnotateSubmit}
            onEnterUrlChange={onEnterUrlChange}
          />
        ) : (
          <div className="dashboard-page-groups">
            {groups.map((group) => (
              <section key={group.key} className="dashboard-site-section">
                <div className="dashboard-site-heading">
                  <h3 className="dashboard-site-title">{group.label}</h3>
                  <span className="dashboard-site-count">
                    {group.pages.length} page{group.pages.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="dashboard-page-grid">
                  {group.pages.map((page) => {
                    const location = getPageLocation(page.url);
                    const title = page.title || location.host;
                    const normalizedUrl = normalizeUrl(page.url);

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
                            <FiFileText />
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
  "searchQuery" | "loading" | "enterUrl" | "onAnnotateSubmit" | "onEnterUrlChange"
>;

function LibraryEmptyState({
  searchQuery,
  loading,
  enterUrl,
  onAnnotateSubmit,
  onEnterUrlChange,
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

        {!searchQuery && !loading && (
          <form className="dashboard-empty-form" onSubmit={onAnnotateSubmit}>
            <input
              type="url"
              className="dashboard-input"
              placeholder="https://example.com/article"
              value={enterUrl}
              onChange={(event) => onEnterUrlChange(event.target.value)}
              aria-label="URL to annotate"
            />
            <button type="submit" className="dashboard-button dashboard-button-primary">
              Start annotating
              <FiArrowRight aria-hidden="true" />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
