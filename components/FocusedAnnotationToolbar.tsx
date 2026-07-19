"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import ColorPicker from "./ColorPicker";
import { useAnnotationContext } from "../contexts/Annotator.context";
import { useAnnotatorOverlayOptional } from "../contexts/AnnotatorOverlay.context";
import { useActiveAnnotationId } from "../hooks/FocusedAnnotationToolbar.hooks";
import { useCoarsePointer } from "../hooks";
import { Delete, Highlighter, Comment, Resize, Send } from "../app/icons";
import { IconButton } from "./design-system/icon-button";
import useMenuOnFocusStyles from "./styles/MenuOnFocus.styles";
import AnnotationResizeHandles from "./AnnotationResizeHandles";

export default function FocusedAnnotationToolbar() {
  const { activeAnnotationId, setFocusedId } = useActiveAnnotationId();

  if (!activeAnnotationId) return null;

  return (
    <FocusedHighlightMenu
      key={activeAnnotationId}
      activeAnnotationId={activeAnnotationId}
      setFocusedId={setFocusedId}
    />
  );
}

type FocusedHighlightMenuProps = {
  activeAnnotationId: string;
  setFocusedId: (id: string | null) => void;
};

function FocusedHighlightMenu({ activeAnnotationId, setFocusedId }: FocusedHighlightMenuProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [textareaFocus, setTextareaFocus] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [colorPickerAnchor, setColorPickerAnchor] = useState<DOMRect | null>(null);
  const [commentAnchor, setCommentAnchor] = useState<DOMRect | null>(null);
  const [toolbarFocusIndex, setToolbarFocusIndex] = useState(0);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const commentButtonRef = useRef<HTMLButtonElement>(null);
  const { session, annotations, deleteAnnotation, setCurrentHighlightColor, updateAnnotation } = useAnnotationContext();
  const overlay = useAnnotatorOverlayOptional();
  const { isCoarsePointer } = useCoarsePointer();
  const isResizeMode = overlay?.contextual.type === 'resize'
    && overlay.contextual.annotationId === activeAnnotationId;

  useEffect(() => {
    if (showCommentInput && commentTextareaRef.current) {
      const textarea = commentTextareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, [showCommentInput]);

  const measureAnchor = useCallback(() => {
    if (!activeAnnotationId) {
      setAnchorRect(null);
      return;
    }

    setAnchorRect(session.getHighlightRect(activeAnnotationId));
  }, [activeAnnotationId, session]);

  useEffect(() => {
    const iframeWindow = session.frame?.contentWindow;
    const iframeDocument = session.document;
    const content = session.root;
    const visualViewport = window.visualViewport;
    const animationFrame = window.requestAnimationFrame(measureAnchor);
    iframeWindow?.addEventListener('scroll', measureAnchor, { passive: true });
    iframeDocument?.addEventListener('scroll', measureAnchor, { passive: true, capture: true });
    iframeWindow?.addEventListener('resize', measureAnchor);
    window.addEventListener('resize', measureAnchor);
    visualViewport?.addEventListener('resize', measureAnchor);
    visualViewport?.addEventListener('scroll', measureAnchor);
    const resizeObserver = content && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measureAnchor)
      : null;
    if (content && resizeObserver) resizeObserver.observe(content);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      iframeWindow?.removeEventListener('scroll', measureAnchor);
      iframeDocument?.removeEventListener('scroll', measureAnchor, true);
      iframeWindow?.removeEventListener('resize', measureAnchor);
      window.removeEventListener('resize', measureAnchor);
      visualViewport?.removeEventListener('resize', measureAnchor);
      visualViewport?.removeEventListener('scroll', measureAnchor);
      resizeObserver?.disconnect();
    };
  }, [measureAnchor, session.document, session.frame, session.root]);

  const styles = useMenuOnFocusStyles(menuRef, anchorRect, textareaFocus, commentAnchor);
  const currentAnnotation = annotations.find((annotation) => annotation.id === activeAnnotationId);

  const handleColorSelect = (id: string, newColor: string) => {
    void updateAnnotation({ id, color: newColor });

    // Update current highlight color for future highlights
    setCurrentHighlightColor(newColor);

    // Close color picker and menu
    setShowColorPicker(false);
    setFocusedId(null);
  };

  function handleChangeStyle(e: React.MouseEvent<HTMLButtonElement>) {
    if (!activeAnnotationId) return;
    setShowCommentInput(false);
    setColorPickerAnchor(e.currentTarget.getBoundingClientRect());
    setShowColorPicker(true);
    overlay?.openColorPicker(activeAnnotationId);
  }

  const closeColorPicker = () => {
    setShowColorPicker(false);
    if (activeAnnotationId) overlay?.showHighlight(activeAnnotationId);
  };

  const closeCommentInput = () => {
    setTextareaFocus(false);
    setShowCommentInput(false);
    if (activeAnnotationId) overlay?.showHighlight(activeAnnotationId);
  };

  const handleToolbarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      setFocusedId(null);
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = currentIndex < 0 ? buttons.length - 1 : (currentIndex - 1 + buttons.length) % buttons.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = buttons.length - 1;
    }

    if (nextIndex !== null && buttons[nextIndex]) {
      event.preventDefault();
      setToolbarFocusIndex(nextIndex);
      buttons[nextIndex].focus();
    }
  };

  return (
    <>
      {anchorRect && (
        <>
          {!isResizeMode && (
            <div
              ref={menuRef}
              role="toolbar"
              aria-label="Highlight actions"
              onKeyDown={handleToolbarKeyDown}
              style={styles.menuContainer}
            >
              <IconButton
                ref={commentButtonRef}
                label={currentAnnotation?.comment ? "Edit comment" : "Add comment"}
                size={styles.controlSize}
                tone="neutral"
                aria-expanded={showCommentInput}
                aria-controls={showCommentInput ? "highlight-comment-editor" : undefined}
                tabIndex={toolbarFocusIndex === 0 ? 0 : -1}
                onFocus={() => setToolbarFocusIndex(0)}
                onClick={(event) => {
                  setShowColorPicker(false);
                  setCommentAnchor(event.currentTarget.getBoundingClientRect());
                  setCommentText(currentAnnotation?.comment || "");
                  setShowCommentInput(true);
                  overlay?.openCommentEditor(activeAnnotationId);
                }}
                title={currentAnnotation?.comment ? "Edit comment" : "Add comment"}
              >
                <span style={styles.iconWrap}>
                  <Comment size={18} aria-hidden="true" />
                  {currentAnnotation?.comment && <span style={styles.commentIndicator} aria-hidden="true" />}
                </span>
              </IconButton>

              <IconButton
                label="Change highlight color"
                size={styles.controlSize}
                tone="neutral"
                aria-expanded={showColorPicker}
                tabIndex={toolbarFocusIndex === 1 ? 0 : -1}
                onFocus={() => setToolbarFocusIndex(1)}
                onClick={handleChangeStyle}
                title="Change highlight color"
              >
                <span style={styles.highlightIcon(currentAnnotation?.color || "#87ceeb")}>
                  <Highlighter size={18} aria-hidden="true" />
                </span>
              </IconButton>

              {isCoarsePointer && (
                <IconButton
                  label="Resize highlight"
                  size={styles.controlSize}
                  tone="neutral"
                  tabIndex={toolbarFocusIndex === 2 ? 0 : -1}
                  onFocus={() => setToolbarFocusIndex(2)}
                  onClick={() => {
                    setShowColorPicker(false);
                    setShowCommentInput(false);
                    overlay?.enterResizeMode(activeAnnotationId);
                  }}
                  title="Resize highlight"
                >
                  <Resize size={18} aria-hidden="true" />
                </IconButton>
              )}

              <span style={styles.separator} aria-hidden="true" />

              <IconButton
                label="Delete highlight"
                size={styles.controlSize}
                tone="danger"
                tabIndex={toolbarFocusIndex === (isCoarsePointer ? 3 : 2) ? 0 : -1}
                onFocus={() => setToolbarFocusIndex(isCoarsePointer ? 3 : 2)}
                onClick={() => {
                  deleteAnnotation(activeAnnotationId);
                  setFocusedId(null);
                }}
                title="Delete highlight"
              >
                <Delete size={19} aria-hidden="true" />
              </IconButton>
            </div>
          )}

          {showColorPicker && (
            <ColorPicker
              currentColor={annotations.find(a => a.id === activeAnnotationId)?.color}
              onColorSelect={(color) => handleColorSelect(activeAnnotationId, color)}
              onClose={closeColorPicker}
              anchorRect={colorPickerAnchor}
            />
          )}
          {showCommentInput && activeAnnotationId && anchorRect && (
            <div
              id="highlight-comment-editor"
              role="group"
              aria-labelledby="highlight-comment-label"
              style={styles.commentInputContainer as React.CSSProperties}
            >
              <div style={styles.commentHeader}>
                <label id="highlight-comment-label" htmlFor="highlight-comment-textarea" style={styles.commentLabel}>
                  Comment
                </label>
                <span style={styles.commentHint}>Saved to this highlight</span>
              </div>
              <textarea
                id="highlight-comment-textarea"
                ref={commentTextareaRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onBlur={(e) => {
                  if (e.relatedTarget && (e.relatedTarget as HTMLElement).title === 'Save comment') {
                    return;
                  }
                  closeCommentInput();
                }}
                onFocus={() => setTextareaFocus(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeCommentInput();
                    commentButtonRef.current?.focus();
                  } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    updateAnnotation({ id: activeAnnotationId, comment: commentText });
                    setShowCommentInput(false);
                    setFocusedId(null);
                  }
                }}
                placeholder="Add a note about this highlight…"
                style={styles.commentTextarea as React.CSSProperties}
                autoFocus
              />
              <IconButton
                label="Save comment"
                tone="primary"
                size="small"
                onClick={() => {
                  updateAnnotation({ id: activeAnnotationId, comment: commentText });
                  setShowCommentInput(false);
                  setFocusedId(null);
                }}
                style={styles.saveCommentButton}
                title="Save comment"
              >
                <Send size={15} aria-hidden="true" />
              </IconButton>
              <span style={styles.saveHint}>Ctrl/⌘ + Enter to save</span>
            </div>
          )}
        </>
      )}
      {activeAnnotationId && <AnnotationResizeHandles annotationId={activeAnnotationId} onResize={measureAnchor} />}
    </>
  );
}
