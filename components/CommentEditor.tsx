import React, { useState } from "react";
import commentEditorStyles from "./styles/CommentEditor.styles";
import { useAnnotationContext } from "./Annotator.context";
import { Button } from "./design-system/button";
import { Save, Times } from "../app/icons";

type CommentEditorProps = {
  ann: Annotation;
  commentDraft: string;
  setCommentDraft: (draft: string) => void;
  commentTextareaRef: React.RefObject<HTMLTextAreaElement>;
  setEditingCommentId: (id: string | null) => void;
};

export default function CommentEditor({
  ann,
  commentDraft,
  setCommentDraft,
  commentTextareaRef,
  setEditingCommentId,
}: CommentEditorProps) {
  const { updateAnnotation } = useAnnotationContext();
  const [isFocused, setIsFocused] = useState(false);

  const cancelEditing = () => {
    setEditingCommentId(null);
    setCommentDraft("");
  };

  const saveComment = () => {
    updateAnnotation({ id: ann.id, comment: commentDraft });
    setCommentDraft("");
    setEditingCommentId(null);
  };

  return (
    <div style={commentEditorStyles.container} onClick={(e) => e.stopPropagation()}>
      <div style={commentEditorStyles.editorCard}>
        <div style={commentEditorStyles.header}>
          <label style={commentEditorStyles.label} htmlFor={`compact-note-${ann.id}`}>
            {ann.comment ? "Edit note" : "Add a note"}
          </label>
          <span style={commentEditorStyles.helperText}>Shift or Ctrl/⌘ Enter to save</span>
        </div>
        <textarea
          id={`compact-note-${ann.id}`}
          ref={commentTextareaRef}
          autoFocus
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              saveComment();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelEditing();
            }
          }}
          placeholder="Add context, a question, or a reminder…"
          style={commentEditorStyles.textarea(isFocused)}
          rows={3}
        />
        <div style={commentEditorStyles.actions}>
          <Button
            size="small"
            variant="ghost"
            leadingIcon={<Times size={10} />}
            onClick={cancelEditing}
          >
            Cancel
          </Button>
          <Button
            size="small"
            leadingIcon={<Save size={10} />}
            onClick={saveComment}
          >
            Save note
          </Button>
        </div>
      </div>
    </div>
  );
}
