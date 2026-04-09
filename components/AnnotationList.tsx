import React, { useCallback, useState } from "react";
import PromptBox from './PromptBox';
import Latex from "./Latex";
import CommentEditor from "./CommentEditor";
import EmptyState from "./EmptyState";
import { useAnnotationContextOptional } from "../context/Annotator.context";
import { useCommentEditing } from "../hooks/AnnotationList.hooks";
import styles from "../styles/AnnotationList.styles";
import { shortenHtml } from "../utils/dom";


export default function AnnotationList({
  scrollToAnnotation,
  mode = 'compact',
  annotations: annotationsProp,
  onDeleteAnnotation,
  onUpdateComment,
  editingComment,
  onStartEditingComment,
  onCancelEditingComment,
  onSaveComment
}: {
  scrollToAnnotation?: (id: string) => void;
  mode?: 'compact' | 'card';
  annotations?: Annotation[];
  onDeleteAnnotation?: (id: string) => void;
  onUpdateComment?: (id: string, comment: string) => void;
  editingComment?: { annotationId: string; comment: string } | null;
  onStartEditingComment?: (id: string, comment: string) => void;
  onCancelEditingComment?: () => void;
  onSaveComment?: () => void;
}) {
  // For card mode (Dashboard), use props. For compact mode, use context.
  const contextData = useAnnotationContextOptional();
  const annotations = annotationsProp ?? contextData?.annotations ?? [];

  const {
    commentDraft,
    setCommentDraft,
    editingCommentId,
    setEditingCommentId,
    commentTextareaRef,
  } = useCommentEditing();

  type PromptState = {
    message: React.ReactNode;
    actions: { label: string; action: () => void; variant?: 'primary' | 'secondary' | 'destructive' | 'neutral' }[];
  } | null;

  const [prompt, setPrompt] = useState<PromptState>(null);
  const [itemStates, setItemStates] = useState<Record<string, { hover: boolean; focus: boolean; buttonHovers: Record<string, boolean> }>>({});

  const handleDeleteAnnotation = useCallback((id: string) => {
    setPrompt({
      message: 'Are you sure you want to delete this annotation?',
      actions: [
        {
          label: 'Delete',
          action: () => {
            if (contextData?.deleteAnnotation) {
              contextData.deleteAnnotation(id);
            } else if (onDeleteAnnotation) {
              onDeleteAnnotation(id);
            }
            setPrompt(null);
          },
          variant: 'destructive'
        },
        { label: 'Cancel', action: () => setPrompt(null), variant: 'neutral' },
      ]
    });
  }, [contextData, onDeleteAnnotation]);

  const handleDeleteComment = useCallback((id: string) => {
    setPrompt({
      message: 'Are you sure you want to delete this comment?',
      actions: [
        {
          label: 'Delete comment',
          action: () => {
            if (contextData?.updateAnnotation) {
              contextData.updateAnnotation({ id, comment: '' });
            }
            setPrompt(null);
          },
          variant: 'destructive'
        },
        { label: 'Cancel', action: () => setPrompt(null), variant: 'neutral' },
      ]
    });
  }, [contextData]);

  return (
    <div style={styles.container}>
      {prompt && (
        <PromptBox
          message={prompt.message}
          actions={prompt.actions}
          onClose={() => setPrompt(null)}
        />
      )}
      {annotations.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={mode === 'card' ? styles.annotationsWrapper : undefined}>
          {annotations.map((ann: Annotation) => (
            <div key={ann.id}>
              {mode === 'compact' ? (
                // Compact mode (Sidebar)
                <div
                  role={scrollToAnnotation ? "button" : undefined}
                  tabIndex={scrollToAnnotation ? 0 : undefined}
                  onClick={scrollToAnnotation ? () => scrollToAnnotation(ann.id) : undefined}
                  onMouseEnter={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], hover: true } }))}
                  onMouseLeave={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], hover: false } }))}
                  onFocus={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], focus: true } }))}
                  onBlur={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], focus: false } }))}
                  style={styles.annotationItem(itemStates[ann.id]?.hover, itemStates[ann.id]?.focus)}
                  title={scrollToAnnotation ? "Scroll to highlight" : undefined}
                >
                  <div style={styles.contentContainer}>
                    <span
                      aria-hidden
                      style={styles.colorIndicator(ann.color)}
                    />
                    <div>
                      <Latex>
                        {shortenHtml(ann.html ?? "No html")}
                      </Latex>
                      {ann.comment && (
                        <div style={styles.comment}>
                          <Latex>
                            {ann.comment}
                          </Latex>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={styles.actionButtons(itemStates[ann.id]?.hover)}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); handleDeleteAnnotation(ann.id); }}
                      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDeleteAnnotation(ann.id); } }}
                      onMouseEnter={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], buttonHovers: { ...prev[ann.id]?.buttonHovers, delete: true } } }))}
                      onMouseLeave={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], buttonHovers: { ...prev[ann.id]?.buttonHovers, delete: false } } }))}
                      style={styles.deleteAnnotationButton(itemStates[ann.id]?.buttonHovers?.delete)}
                      title="Delete annotation"
                      aria-label="Delete annotation"
                    >
                      <svg style={{ width: '0.75rem', height: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); setEditingCommentId(ann.id); setCommentDraft(ann.comment || ""); }}
                      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setEditingCommentId(ann.id); setCommentDraft(ann.comment || ""); } }}
                      onMouseEnter={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], buttonHovers: { ...prev[ann.id]?.buttonHovers, edit: true } } }))}
                      onMouseLeave={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], buttonHovers: { ...prev[ann.id]?.buttonHovers, edit: false } } }))}
                      style={styles.editCommentButton(itemStates[ann.id]?.buttonHovers?.edit)}
                      title="Edit comment"
                      aria-label="Edit comment"
                    >
                      <svg style={{ width: '0.75rem', height: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    {ann.comment && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); handleDeleteComment(ann.id); }}
                        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDeleteComment(ann.id); } }}
                        onMouseEnter={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], buttonHovers: { ...prev[ann.id]?.buttonHovers, deleteComment: true } } }))}
                        onMouseLeave={() => setItemStates(prev => ({ ...prev, [ann.id]: { ...prev[ann.id], buttonHovers: { ...prev[ann.id]?.buttonHovers, deleteComment: false } } }))}
                        style={styles.deleteCommentButton(itemStates[ann.id]?.buttonHovers?.deleteComment)}
                        title="Delete comment"
                        aria-label="Delete comment"
                      >
                        <svg style={{ width: '0.75rem', height: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Card mode (Dashboard)
                <div
                  style={styles.annotationCard(false)}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = styles.annotationCardHover as string}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = (styles.annotationCard(false).boxShadow as string)}
                >
                  <div style={styles.annotationContent}>
                    <div style={styles.cardColorIndicator(ann.color || "#ffff00")} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.annotationText(ann.color || "#ffff00", false)}>
                        {ann.html ? (
                          <Latex>{ann.html}</Latex>
                        ) : (
                          <p>{ann.text}</p>
                        )}
                      </div>

                      {editingComment?.annotationId === ann.id ? (
                        <div style={styles.cardCommentSection}>
                          <div style={styles.editCommentContainer}>
                            <textarea
                              value={editingComment.comment}
                              onChange={(e) => onStartEditingComment?.(ann.id, e.target.value)}
                              placeholder="Add a comment..."
                              style={styles.commentTextarea}
                              onFocus={(e) => e.currentTarget.style.boxShadow = (styles.commentTextareaFocus.boxShadow as string)}
                              onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                  onSaveComment?.();
                                } else if (e.key === 'Escape') {
                                  onCancelEditingComment?.();
                                }
                              }}
                            />
                            <div style={styles.commentButtons}>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); onSaveComment?.(); }}
                                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSaveComment?.(); } }}
                                style={styles.saveButton}
                                onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = (styles.saveButtonHover.backgroundColor as string)}
                                onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = (styles.saveButton.backgroundColor as string)}
                                title="Save comment (Ctrl+Enter)"
                              >
                                <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); onCancelEditingComment?.(); }}
                                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onCancelEditingComment?.(); } }}
                                style={styles.cancelButton}
                                onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = (styles.cancelButtonHover.backgroundColor as string)}
                                onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = (styles.cancelButton.backgroundColor as string)}
                                title="Cancel editing (Escape)"
                              >
                                <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        ann.comment && (
                          <div style={styles.cardCommentSection}>
                            <p style={styles.cardCommentText}>
                              {ann.comment}
                            </p>
                          </div>
                        )
                      )}

                      <div style={styles.annotationActions}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); onStartEditingComment?.(ann.id, ann.comment || ''); }}
                          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onStartEditingComment?.(ann.id, ann.comment || ''); } }}
                          style={styles.editCommentButtonCard}
                          onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = (styles.editCommentButtonCardHover.backgroundColor as string)}
                          onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = (styles.editCommentButtonCard.backgroundColor as string)}
                        >
                          <svg style={{ width: '0.75rem', height: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {ann.comment ? 'Edit Comment' : 'Add Comment'}
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); onDeleteAnnotation?.(ann.id); }}
                          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onDeleteAnnotation?.(ann.id); } }}
                          style={styles.deleteAnnotationButtonCard}
                          onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = (styles.deleteAnnotationButtonCardHover.backgroundColor as string)}
                          onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = (styles.deleteAnnotationButtonCard.backgroundColor as string)}
                        >
                          <svg style={{ width: '0.75rem', height: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {mode === 'compact' && editingCommentId === ann.id && (
                <CommentEditor
                  ann={ann}
                  commentDraft={commentDraft}
                  setCommentDraft={setCommentDraft}
                  commentTextareaRef={commentTextareaRef as React.RefObject<HTMLTextAreaElement>}
                  setEditingCommentId={setEditingCommentId}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
