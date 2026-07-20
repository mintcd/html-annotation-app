"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "./design-system/button";
import TextEditor from "./text-editor";
import { Save, Times } from "../app/icons";
import styles from "./styles/PageNoteEditor.styles";

type PageNoteEditorProps = {
  note: PageNote | null;
  onSave: (content: string) => Promise<unknown> | unknown;
  mode?: "compact" | "dashboard";
  disabled?: boolean;
};

export default function PageNoteEditor({
  note,
  onSave,
  mode = "compact",
  disabled = false,
}: PageNoteEditorProps) {
  const savedContent = note?.content ?? "";
  const [baseline, setBaseline] = useState(savedContent);
  const [draft, setDraft] = useState(savedContent);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(false);
  const [initialCaretPoint, setInitialCaretPoint] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = draft !== baseline;
  const dirtyRef = useRef(dirty);
  const pendingCaretPointRef = useRef<{ x: number; y: number } | null>(null);
  const editorDisabled = disabled || saving;

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    setBaseline(savedContent);
    if (!dirtyRef.current) {
      setDraft(savedContent);
      setEditing(false);
      setActive(false);
      setInitialCaretPoint(null);
    }
  }, [savedContent]);

  const resetDraft = useCallback(() => {
    setDraft(baseline);
    setEditing(false);
    setActive(false);
    setInitialCaretPoint(null);
    setSaveError(null);
    setSaved(false);
  }, [baseline]);

  const saveNote = useCallback(async () => {
    if (!dirty || saving || disabled) return;

    const nextContent = draft.trim() ? draft : "";
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const result = await onSave(nextContent);
      if (result === false) {
        throw new Error("Unable to save note");
      }
      setDraft(nextContent);
      setBaseline(nextContent);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save note");
    } finally {
      setSaving(false);
    }
  }, [dirty, disabled, draft, onSave, saving]);

  const startEditing = useCallback((opts?: { initialCaretPoint?: { x: number; y: number } }) => {
    if (editorDisabled) return;

    setEditing(true);
    setActive(true);
    setInitialCaretPoint(opts?.initialCaretPoint ?? null);
  }, [editorDisabled]);

  const handleEditorChange = useCallback((text: string) => {
    setDraft(text);
    setSaveError(null);
    setSaved(false);
  }, []);

  const handleEditorBlur = useCallback((text: string) => {
    setDraft(text);
    setEditing(false);
    setActive(false);
    setInitialCaretPoint(null);
  }, []);

  const handleSurfaceClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (editing || editorDisabled) return;
    startEditing({ initialCaretPoint: { x: event.clientX, y: event.clientY } });
  }, [editing, editorDisabled, startEditing]);

  const handleSurfacePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (editorDisabled) return;
    pendingCaretPointRef.current = { x: event.clientX, y: event.clientY };
  }, [editorDisabled]);

  const handleSurfaceFocus = useCallback((event: ReactFocusEvent<HTMLDivElement>) => {
    setActive(true);
    if (event.target !== event.currentTarget || editing || editorDisabled) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const fallbackCaretPoint = { x: rect.left + 12, y: rect.top + 12 };
    startEditing({ initialCaretPoint: pendingCaretPointRef.current ?? fallbackCaretPoint });
    pendingCaretPointRef.current = null;
  }, [editing, editorDisabled, startEditing]);

  const handleSurfaceBlur = useCallback((event: ReactFocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    if (!editing) setActive(false);
  }, [editing]);

  const handleEditorKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void saveNote();
    } else if (event.key === "Escape" && dirty) {
      event.preventDefault();
      resetDraft();
    }
  }, [dirty, resetDraft, saveNote]);

  const status = saveError
    ? { label: saveError, tone: "danger" as const }
    : saving
      ? { label: "Saving", tone: "neutral" as const }
      : dirty
        ? { label: "Unsaved", tone: "neutral" as const }
        : saved
          ? { label: "Saved", tone: "success" as const }
          : null;
  const labelId = `page-note-label-${mode}`;

  return (
    <section style={styles.section(mode)} aria-label="Page note">
      <div style={styles.header}>
        <span id={labelId} style={styles.label}>
          Page note
        </span>
        {status && (
          <span
            style={styles.status(status.tone)}
            role={status.tone === "danger" ? "alert" : undefined}
          >
            {status.label}
          </span>
        )}
      </div>

      <div
        className="page-note-editor-surface"
        style={styles.editorSurface(mode, active, editorDisabled)}
        role="textbox"
        aria-labelledby={labelId}
        aria-multiline="true"
        aria-disabled={editorDisabled || undefined}
        tabIndex={editorDisabled ? -1 : 0}
        onPointerDown={handleSurfacePointerDown}
        onClick={handleSurfaceClick}
        onFocus={handleSurfaceFocus}
        onBlur={handleSurfaceBlur}
        onKeyDown={handleEditorKeyDown}
      >
        <TextEditor
          value={draft}
          onChange={handleEditorChange}
          onBlur={handleEditorBlur}
          initialCaretPoint={initialCaretPoint}
          onInitialCaretAssigned={() => setInitialCaretPoint(null)}
          isEditing={editing && !editorDisabled}
          onStartEditing={editorDisabled ? undefined : startEditing}
          preserveHeightOnEdit
        >
          {draft ? undefined : (
            <span style={styles.placeholder}>Add a note for this page...</span>
          )}
        </TextEditor>
      </div>

      {dirty && (
        <div style={styles.actions}>
          <Button
            size="small"
            variant="ghost"
            leadingIcon={<Times size={10} />}
            disabled={saving}
            onClick={resetDraft}
          >
            Cancel
          </Button>
          <Button
            size="small"
            leadingIcon={<Save size={10} />}
            disabled={saving}
            onClick={() => void saveNote()}
          >
            Save note
          </Button>
        </div>
      )}
    </section>
  );
}
