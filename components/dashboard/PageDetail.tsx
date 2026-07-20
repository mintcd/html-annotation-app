"use client";

import {
  FiArrowLeft,
  FiClock,
  FiExternalLink,
  FiGlobe,
  FiLayers,
  FiTrash2,
} from "react-icons/fi";
import AnnotationList from "../AnnotationList";
import type { AnnotationPage, EditingCommentState } from "./types";
import { formatUpdatedAt, getPageLocation } from "./utils";

type PageDetailProps = {
  page: AnnotationPage;
  deleting: boolean;
  editingComment: EditingCommentState | null;
  onBack: () => void;
  onOpenAnnotator: (pageUrl: string) => void;
  onDeletePage: (pageUrl: string, filename: string) => void;
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
  onDeleteAnnotation,
  onStartEditingComment,
  onCancelEditingComment,
  onSaveComment,
}: PageDetailProps) {
  const location = getPageLocation(page.url);
  const title = page.title || location.host;

  return (
    <>
      <header className="dashboard-page-hero">
        <div className="dashboard-page-hero-inner">
          <button type="button" className="dashboard-detail-back" onClick={onBack}>
            <FiArrowLeft aria-hidden="true" />
            All pages
          </button>

          <div className="dashboard-eyebrow-row">
            <p className="dashboard-eyebrow">
              <FiGlobe aria-hidden="true" />
              Selected page
            </p>
          </div>

          <div className="dashboard-hero-layout">
            <div className="dashboard-hero-copy">
              <h2 className="dashboard-hero-title">{title}</h2>
              <p className="dashboard-hero-url" title={page.url}>
                <FiExternalLink aria-hidden="true" />
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
