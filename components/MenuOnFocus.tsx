"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ColorPicker from "./ColorPicker";
import { useAnnotationContext } from "../context/Annotator.context";
import { useElementWidth } from "../hooks";
import { useFocusedId } from "../hooks/MenuOnFocus.hooks";
import { Delete, Highlighter, Comment, Send } from "../app/icons";
import menuOnFocusStyles from "../styles/MenuOnFocus.styles";
import Resizers from "./Resizers";
import { highlightBoundingRect } from "../utils/highlight";

export default function MenuOnFocus() {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [textareaFocus, setTextareaFocus] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { contentRef, annotations, deleteAnnotation, setCurrentHighlightColor, updateAnnotation } = useAnnotationContext();
  const { focusedId, setFocusedId } = useFocusedId();
  const menuWidth = useElementWidth(menuRef, focusedId);

  const styles = menuOnFocusStyles(textareaFocus);

  // Close color picker when menu is closed
  useEffect(() => {
    if (!focusedId) {
      setShowColorPicker(false);
    }
  }, [focusedId]);

  useEffect(() => {
    if (showCommentInput && commentTextareaRef.current) {
      const textarea = commentTextareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(commentText.length, commentText.length);
    }
  }, [showCommentInput, commentText.length]);

  const iframeDoc = contentRef.current?.ownerDocument;
  const anchorRect = focusedId ? highlightBoundingRect(focusedId, iframeDoc) : null;

  const handleColorSelect = (id: string, newColor: string) => {
    if (!contentRef.current) return;

    // Update all spans with this ID
    const spans = contentRef.current.querySelectorAll<HTMLSpanElement>(
      `span.highlighted-text[data-highlight-id="${id}"]`
    );

    spans.forEach((span) => {
      span.style.backgroundColor = newColor;
    });

    // Notify parent of color change
    updateAnnotation({ id, color: newColor });

    // Update current highlight color for future highlights
    setCurrentHighlightColor(newColor);

    // Close color picker and menu
    setShowColorPicker(false);
    setFocusedId(null);
  };

  function handleChangeStyle(e: React.MouseEvent<HTMLButtonElement>) {
    if (!focusedId) return;
    setShowColorPicker(true);
  }
  const rect = anchorRect;

  const menuPosition = {
    top: (rect?.bottom ?? 0) + 10,
    left: (rect?.left ?? 0) + ((rect?.width ?? 0) / 2) - (menuWidth / 2),
  };

  const commentPosition = {
    top: (rect?.bottom ?? 0) - 10,
    left: (rect?.left ?? 0) + ((rect?.width ?? 0) / 2) - (menuWidth / 2),
  };

  return (
    (focusedId && anchorRect) &&
    <>
      <div
        ref={menuRef}
        role="toolbar"
        aria-label="Highlight actions"
        onMouseDown={(e) => e.preventDefault()}
        style={{ ...styles.menuContainer, ...menuPosition }}
      >
        <button
          onClick={() => {
            const currentAnnotation = annotations.find(a => a.id === focusedId);
            setCommentText(currentAnnotation?.comment || "");
            setShowCommentInput(true);
          }}
          style={styles.commentButton}          >
          <Comment size={20} color="#6b7280" />
        </button>

        <button
          type="button"
          onClick={handleChangeStyle}
          style={styles.changeStyleButton}
        >
          <Highlighter
            size={20}
            color={annotations.find(a => a.id === focusedId)?.color || "#3b82f6"}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            deleteAnnotation(focusedId);
            setFocusedId(null);
          }}
          style={styles.deleteButton}
        >
          <Delete size={20} color="#dc2626" />
        </button>

      </div>

      {showColorPicker && (
        <ColorPicker
          currentColor={annotations.find(a => a.id === focusedId)?.color}
          onColorSelect={(color) => handleColorSelect(focusedId, color)}
          onClose={() => setShowColorPicker(false)}
          anchorId={focusedId}
        />
      )}
      {showCommentInput && focusedId && anchorRect && (
        <div
          style={{ ...(styles.commentInputContainer as React.CSSProperties), ...commentPosition }}          >
          <textarea
            ref={commentTextareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onBlur={(e) => {
              if (e.relatedTarget && (e.relatedTarget as HTMLElement).title === 'Save comment') {
                return;
              }
              setTextareaFocus(false);
              setShowCommentInput(false);
              // Do not clear focusedId here — let the outside interaction handler
              // (pointerup) decide when to close the menu. Clearing focusedId on
              // blur can race with taps that intend to re-open the highlight.
            }}
            placeholder="Add a comment..."
            style={styles.commentTextarea as React.CSSProperties}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              updateAnnotation({ id: focusedId, comment: commentText });
              setShowCommentInput(false);
              setFocusedId(null);
            }}
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#3a5da2ff',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Save comment"
          >
            <Send size={16} />
          </button>
        </div>
      )}
      {focusedId && <Resizers annotationId={focusedId} />}
    </>
  );
}
