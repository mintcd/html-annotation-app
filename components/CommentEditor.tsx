import React, { useState } from "react";
import commentEditorStyles from "../styles/CommentEditor.styles";
import { useAnnotationContext } from "../context/Annotator.context";

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
  return (
    <div style={commentEditorStyles.container} onClick={(e) => e.stopPropagation()}>
      <div style={commentEditorStyles.relativeContainer}>
        <textarea
          ref={commentTextareaRef}
          autoFocus
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              updateAnnotation({ id: ann.id, comment: commentDraft });
              setCommentDraft("");
              setEditingCommentId(null);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditingCommentId(null);
              setCommentDraft("");
            }
          }}
          placeholder="Add a comment..."
          style={commentEditorStyles.textarea(isFocused)}
          rows={3}
        />
        <div style={commentEditorStyles.helperText}>
          Shift+Enter to save, Esc to cancel
        </div>
      </div>
    </div>
  );
}