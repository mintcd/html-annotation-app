"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./design-system/button";
import { IconButton } from "./design-system/icon-button";
import { Latex } from "./design-system/latex";
import { Comment, Edit, Save, Times, Trash } from "../app/icons";
import ActionDialog from "./ActionDialog";
import CommentEditor from "./CommentEditor";
import EmptyState from "./EmptyState";
import { useAnnotationContextOptional } from "./Annotator.context";
import styles from "./styles/AnnotationList.styles";

type AnnotationListProps = {
  scrollToAnnotation?: (id: string) => void;
  mode?: "compact" | "card";
  annotations?: Annotation[];
  onDeleteAnnotation?: (id: string) => void;
  onUpdateComment?: (id: string, comment: string) => void;
  editingComment?: { annotationId: string; comment: string } | null;
  onStartEditingComment?: (id: string, comment: string) => void;
  onCancelEditingComment?: () => void;
  onSaveComment?: () => void;
};

type PromptState = {
  message: React.ReactNode;
  actions: {
    label: string;
    action: () => void;
    variant?: "primary" | "secondary" | "destructive" | "neutral";
  }[];
} | null;

function annotationExcerpt(annotation: Annotation): string {
  const source = annotation.html || annotation.text || "Untitled highlight";
  const normalized = source.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled highlight";
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 177).trimEnd()}…`;
}

function annotationPreview(annotation: Annotation): string {
  return annotation.html?.trim() || annotation.text || "Untitled highlight";
}

export default function AnnotationList({
  scrollToAnnotation,
  mode = "compact",
  annotations: annotationsProp,
  onDeleteAnnotation,
  onUpdateComment,
  editingComment,
  onStartEditingComment,
  onCancelEditingComment,
  onSaveComment,
}: AnnotationListProps) {
  const contextData = useAnnotationContextOptional();
  const annotations = annotationsProp ?? contextData?.annotations ?? [];
  const [commentDraft, setCommentDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState<PromptState>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeAnnotationId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingCommentId) return;
    const textarea = commentTextareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    // Only run when a different editor opens; draft edits must preserve the caret.
  }, [editingCommentId]);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setPrompt({
      message: "Delete this highlight and its note? This action cannot be undone.",
      actions: [
        {
          label: "Delete",
          action: () => {
            if (contextData?.deleteAnnotation) {
              contextData.deleteAnnotation(id);
            } else {
              onDeleteAnnotation?.(id);
            }
            setPrompt(null);
          },
          variant: "destructive",
        },
        { label: "Cancel", action: () => setPrompt(null), variant: "neutral" },
      ],
    });
  }, [contextData, onDeleteAnnotation]);

  const handleDeleteComment = useCallback((id: string) => {
    setPrompt({
      message: "Delete the note attached to this highlight?",
      actions: [
        {
          label: "Delete note",
          action: () => {
            if (contextData?.updateAnnotation) {
              contextData.updateAnnotation({ id, comment: "" });
            } else {
              onUpdateComment?.(id, "");
            }
            setPrompt(null);
          },
          variant: "destructive",
        },
        { label: "Cancel", action: () => setPrompt(null), variant: "neutral" },
      ],
    });
  }, [contextData, onUpdateComment]);

  const startCompactComment = useCallback((annotation: Annotation) => {
    setEditingCommentId(annotation.id);
    setCommentDraft(annotation.comment || "");
  }, [setCommentDraft, setEditingCommentId]);

  return (
    <div
      style={styles.container(mode)}
      className="annotation-list-container"
      aria-label={mode === "compact" ? "Page annotations" : undefined}
    >
      {prompt && (
        <ActionDialog
          message={prompt.message}
          actions={prompt.actions}
          onClose={() => setPrompt(null)}
        />
      )}

      {annotations.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        <div
          style={mode === "card" ? styles.annotationsWrapper : styles.compactList}
          role="list"
        >
          {annotations.map((annotation) => {
            const isActive = hoveredId === annotation.id || activeAnnotationId === annotation.id;
            const excerpt = annotationExcerpt(annotation);
            const preview = annotationPreview(annotation);

            if (mode === "compact") {
              return (
                <div key={annotation.id} role="listitem">
                  <article
                    style={styles.annotationItem(isActive, activeAnnotationId === annotation.id)}
                    onMouseEnter={() => setHoveredId(annotation.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setFocusedId(annotation.id)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setFocusedId(null);
                      }
                    }}
                  >
                    <button
                      type="button"
                      style={styles.annotationTarget}
                      onClick={() => scrollToAnnotation?.(annotation.id)}
                      disabled={!scrollToAnnotation}
                      title={scrollToAnnotation ? "Locate highlight on page" : undefined}
                      aria-label={scrollToAnnotation ? `Locate highlight: ${excerpt}` : undefined}
                    >
                      <span aria-hidden="true" style={styles.colorIndicator(annotation.color)} />
                      <span style={styles.annotationCopy}>
                        <span style={styles.highlightLabel}>Highlight</span>
                        <span style={styles.excerpt}>
                          <Latex>{preview}</Latex>
                        </span>
                        {annotation.comment && (
                          <span style={styles.comment}>
                            <Comment size={11} aria-hidden="true" />
                            <span style={styles.commentText}>
                              <Latex>{annotation.comment}</Latex>
                            </span>
                          </span>
                        )}
                      </span>
                    </button>

                    <div style={styles.actionButtons(isActive)} role="group" aria-label="Annotation actions">
                      <IconButton
                        label={annotation.comment ? "Edit note" : "Add note"}
                        title={annotation.comment ? "Edit note" : "Add note"}
                        size="small"
                        onClick={() => startCompactComment(annotation)}
                      >
                        <Edit size={11} />
                      </IconButton>
                      {annotation.comment && (
                        <IconButton
                          label="Delete note"
                          title="Delete note"
                          size="small"
                          onClick={() => handleDeleteComment(annotation.id)}
                        >
                          <Comment size={11} />
                        </IconButton>
                      )}
                      <IconButton
                        label="Delete annotation"
                        title="Delete annotation"
                        tone="danger"
                        size="small"
                        onClick={() => handleDeleteAnnotation(annotation.id)}
                      >
                        <Trash size={11} />
                      </IconButton>
                    </div>
                  </article>

                  {editingCommentId === annotation.id && (
                    <CommentEditor
                      ann={annotation}
                      commentDraft={commentDraft}
                      setCommentDraft={setCommentDraft}
                      commentTextareaRef={commentTextareaRef as React.RefObject<HTMLTextAreaElement>}
                      setEditingCommentId={setEditingCommentId}
                    />
                  )}
                </div>
              );
            }

            const isEditing = editingComment?.annotationId === annotation.id;
            return (
              <article
                key={annotation.id}
                role="listitem"
                style={styles.annotationCard(isActive)}
                onMouseEnter={() => setHoveredId(annotation.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setFocusedId(annotation.id)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setFocusedId(null);
                  }
                }}
              >
                <div style={styles.cardHeader}>
                  <span style={styles.cardMarker(annotation.color)} aria-hidden="true" />
                  <span style={styles.cardEyebrow}>Saved highlight</span>
                </div>

                <blockquote style={styles.annotationText(annotation.color)}>
                  {annotation.html ? (
                    <Latex>{annotation.html}</Latex>
                  ) : (
                    <Latex>{annotation.text || "Untitled highlight"}</Latex>
                  )}
                </blockquote>

                {isEditing ? (
                  <div style={styles.cardEditor}>
                    <label style={styles.editorLabel} htmlFor={`annotation-note-${annotation.id}`}>
                      Note
                    </label>
                    <textarea
                      id={`annotation-note-${annotation.id}`}
                      autoFocus
                      value={editingComment.comment}
                      onChange={(event) => onStartEditingComment?.(annotation.id, event.target.value)}
                      placeholder="Add context, a question, or a reminder…"
                      style={styles.commentTextarea}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                          event.preventDefault();
                          onSaveComment?.();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          onCancelEditingComment?.();
                        }
                      }}
                    />
                    <div style={styles.editorFooter}>
                      <span style={styles.editorHint}>Ctrl/⌘ Enter to save · Esc to cancel</span>
                      <div style={styles.editorActions}>
                        <Button size="small" variant="ghost" onClick={onCancelEditingComment} leadingIcon={<Times size={10} />}>
                          Cancel
                        </Button>
                        <Button size="small" onClick={onSaveComment} leadingIcon={<Save size={10} />}>
                          Save note
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : annotation.comment ? (
                  <div style={styles.cardCommentSection}>
                    <span style={styles.cardCommentIcon} aria-hidden="true"><Comment size={12} /></span>
                    <p style={styles.cardCommentText}>{annotation.comment}</p>
                  </div>
                ) : null}

                {!isEditing && (
                  <div style={styles.annotationActions}>
                    {onStartEditingComment && (
                      <Button
                        size="small"
                        variant="ghost"
                        leadingIcon={<Edit size={10} />}
                        onClick={() => onStartEditingComment(annotation.id, annotation.comment || "")}
                      >
                        {annotation.comment ? "Edit note" : "Add note"}
                      </Button>
                    )}
                    {onDeleteAnnotation && (
                      <Button
                        size="small"
                        variant="danger"
                        leadingIcon={<Trash size={10} />}
                        onClick={() => onDeleteAnnotation(annotation.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
