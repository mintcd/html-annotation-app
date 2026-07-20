"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import {
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiEdit2,
  FiExternalLink,
  FiGlobe,
  FiLayers,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import AnnotationList from "../AnnotationList";
import PageNoteEditor from "../PageNoteEditor";
import type { AnnotationPage, EditingCommentState } from "./types";
import { formatUpdatedAt, getPageLocation } from "./utils";

type PageDetailProps = {
  page: AnnotationPage;
  deleting: boolean;
  editingComment: EditingCommentState | null;
  onBack: () => void;
  onOpenAnnotator: (pageUrl: string) => void;
  onDeletePage: (pageUrl: string, filename: string) => void;
  onSaveTitle: (pageUrl: string, title: string) => Promise<void>;
  onSavePageNote: (pageUrl: string, content: string) => Promise<void>;
  onDeleteAnnotation: (pageUrl: string, annotationId: string) => void;
  onStartEditingComment: (pageUrl: string, annotationId: string, comment: string) => void;
  onCancelEditingComment: () => void;
  onSaveComment: () => void;
};

export default function PageDetail({
  page,
  deleting,
  editingComment,
  onBack,
  onOpenAnnotator,
  onDeletePage,
  onSaveTitle,
  onSavePageNote,
  onDeleteAnnotation,
  onStartEditingComment,
  onCancelEditingComment,
  onSaveComment,
}: PageDetailProps) {
  const location = getPageLocation(page.url);
  const title = page.title || page.siteTitle || location.host;
  const [logoFailed, setLogoFailed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [savingTitle, setSavingTitle] = useState(false);
  const showLogo = page.siteLogoSrc && !logoFailed;

  function startTitleEdit() {
    setDraftTitle(title);
    setEditingTitle(true);
  }

  function cancelTitleEdit() {
    setDraftTitle(title);
    setEditingTitle(false);
  }

  async function submitTitleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTitle = draftTitle.trim();
    setSavingTitle(true);
    try {
      await onSaveTitle(page.url, nextTitle);
      setDraftTitle(nextTitle || title);
      setEditingTitle(false);
    } catch (error) {
      alert(`Error saving title: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSavingTitle(false);
    }
  }

  return (
    <>
      <header className="dashboard-page-hero">
        <div className="dashboard-page-hero-inner">
          <button type="button" className="dashboard-detail-back" onClick={onBack}>
            <FiArrowLeft aria-hidden="true" />
            All pages
          </button>

          <div className="dashboard-hero-layout">
            <div className="dashboard-hero-copy">
              <div className="dashboard-hero-title-row">
                {showLogo ? (
                  <Image
                    className="dashboard-hero-logo"
                    src={page.siteLogoSrc as string}
                    alt=""
                    width={38}
                    height={38}
                    priority
                    unoptimized
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <span className="dashboard-hero-logo dashboard-hero-logo-fallback" aria-hidden="true">
                    <FiGlobe />
                  </span>
                )}
                <div className="dashboard-hero-title-wrap">
                  {editingTitle ? (
                    <form className="dashboard-title-edit-form" onSubmit={submitTitleEdit}>
                      <input
                        className="dashboard-input dashboard-title-input"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelTitleEdit();
                          }
                        }}
                        aria-label="Page title"
                        disabled={savingTitle}
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="dashboard-title-action"
                        aria-label="Save page title"
                        title="Save title"
                        disabled={savingTitle}
                      >
                        <FiCheck aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="dashboard-title-action"
                        onClick={cancelTitleEdit}
                        aria-label="Cancel title edit"
                        title="Cancel"
                        disabled={savingTitle}
                      >
                        <FiX aria-hidden="true" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <h2 className="dashboard-hero-title">{title}</h2>
                      <button
                        type="button"
                        className="dashboard-icon-button dashboard-title-edit-button"
                        onClick={startTitleEdit}
                        aria-label={`Edit title for ${title}`}
                        title="Edit title"
                      >
                        <FiEdit2 aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="dashboard-hero-url" title={page.url} onClick={() => window.open(page.url, "_blank", "noopener,noreferrer")}>
                <span>{page.url}</span>
              </p>
              <div className="dashboard-meta-row">
                <span className="dashboard-meta-chip">
                  <FiLayers aria-hidden="true" />
                  {page.annotations.length} annotation{page.annotations.length === 1 ? "" : "s"}
                </span>
                <span className="dashboard-meta-chip">
                  <FiClock aria-hidden="true" />
                  Updated {formatUpdatedAt(page.uploadedAt)}
                </span>
              </div>
            </div>

            <div className="dashboard-hero-actions">
              <button
                type="button"
                className="dashboard-button dashboard-button-primary"
                onClick={() => onOpenAnnotator(page.url)}
              >
                Open annotator
                <FiExternalLink aria-hidden="true" />
              </button>
              <button
                type="button"
                className="dashboard-button dashboard-button-danger"
                onClick={() => onDeletePage(page.url, page.filename)}
                disabled={deleting}
              >
                <FiTrash2 aria-hidden="true" />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-content-inner">
          <PageNoteEditor
            mode="dashboard"
            note={page.pageNote}
            onSave={(content) => onSavePageNote(page.url, content)}
          />

          <div className="dashboard-content-heading">
            <div>
              <h3 className="dashboard-content-title">Highlights & notes</h3>
              <p className="dashboard-content-description">Everything captured on this page.</p>
            </div>
            <span className="dashboard-result-count">{page.annotations.length}</span>
          </div>

          <AnnotationList
            mode="card"
            annotations={page.annotations}
            onDeleteAnnotation={(id: string) => onDeleteAnnotation(page.url, id)}
            editingComment={editingComment?.pageUrl === page.url
              ? { annotationId: editingComment.annotationId, comment: editingComment.comment }
              : null}
            onStartEditingComment={(id: string, comment: string) =>
              onStartEditingComment(page.url, id, comment)}
            onCancelEditingComment={onCancelEditingComment}
            onSaveComment={onSaveComment}
          />
        </div>
      </div>
    </>
  );
}
