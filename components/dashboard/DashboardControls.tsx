"use client";

import type { ChangeEvent, RefObject } from "react";
import {
  FiArrowRight,
  FiLayers,
  FiLogOut,
  FiSearch,
  FiX,
} from "react-icons/fi";

type DashboardControlsProps = {
  isMobile: boolean;
  totalAnnotations: number;
  totalUrls: number;
  enterUrl: string;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  syncStatus: string;
  syncTone: string;
  userId: string;
  signingOut: boolean;
  signOutError: string | null;
  onAnnotateSubmit: (event: ChangeEvent<HTMLFormElement>) => void;
  onEnterUrlChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSignOut: () => void;
  onClose?: () => void;
};

export default function DashboardControls({
  isMobile,
  totalAnnotations,
  totalUrls,
  enterUrl,
  searchQuery,
  searchInputRef,
  syncStatus,
  syncTone,
  userId,
  signingOut,
  signOutError,
  onAnnotateSubmit,
  onEnterUrlChange,
  onSearchQueryChange,
  onSignOut,
  onClose,
}: DashboardControlsProps) {
  return (
    <>
      <div className="dashboard-brand-row">
        <div className="dashboard-brand">
          <span className="dashboard-brand-mark" aria-hidden="true">
            <FiLayers />
          </span>
          <div>
            <h1 className="dashboard-brand-title">Annotation Studio</h1>
            <p className="dashboard-brand-subtitle">
              {totalAnnotations} highlight{totalAnnotations === 1 ? "" : "s"} across {totalUrls} page{totalUrls === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {isMobile && (
          <button
            type="button"
            className="dashboard-icon-button"
            onClick={onClose}
            aria-label="Close controls"
          >
            <FiX />
          </button>
        )}
      </div>

      <div className="dashboard-sidebar-actions">
        <label className="dashboard-label" htmlFor="dashboard-url-input">
          New page
        </label>
        <form className="dashboard-url-form" onSubmit={onAnnotateSubmit}>
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

        <label className="dashboard-search">
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
      </div>

      <div className="dashboard-sidebar-filler" aria-hidden="true" />

      <div className={`dashboard-sync ${syncTone}`} title={`Sync status: ${syncStatus}`}>
        <span className="dashboard-sync-state">
          <span className="dashboard-sync-dot" aria-hidden="true" />
          <span className="dashboard-sync-copy">
            <span className="dashboard-sync-label">Sync · {syncStatus}</span>
            <span className="dashboard-account-label">Signed in as {userId}</span>
          </span>
        </span>
        <button
          type="button"
          className="dashboard-sign-out"
          onClick={onSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          title={signingOut ? "Signing out" : "Sign out"}
        >
          <FiLogOut />
          <span>{signingOut ? "Logging out" : "Logout"}</span>
        </button>
      </div>

      {signOutError && (
        <p className="dashboard-sign-out-error" role="alert">
          {signOutError}
        </p>
      )}
    </>
  );
}
