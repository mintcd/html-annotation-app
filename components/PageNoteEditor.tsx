"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./design-system/button";
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
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = draft !== baseline;
  const dirtyRef = useRef(dirty);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    setBaseline(savedContent);
    if (!dirtyRef.current) {
      setDraft(savedContent);
    }
  }, [savedContent]);

  const resetDraft = useCallback(() => {
    setDraft(baseline);
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

  const status = saveError
    ? { label: saveError, tone: "danger" as const }
    : saving
      ? { label: "Saving", tone: "neutral" as const }
      : dirty
        ? { label: "Unsaved", tone: "neutral" as const }
        : saved
          ? { label: "Saved", tone: "success" as const }
          : null;

  return (
    <section style={styles.section(mode)} aria-label="Page note">
      <div style={styles.header}>
        <label style={styles.label} htmlFor={`page-note-${mode}`}>
          Page note
        </label>
        {status && (
          <span
            style={styles.status(status.tone)}
            role={status.tone === "danger" ? "alert" : undefined}
          >
            {status.label}
          </span>
        )}
      </div>

      <textarea
        id={`page-note-${mode}`}
        value={draft}
        disabled={disabled || saving}
        placeholder="Add a note for this page..."
        rows={mode === "compact" ? 4 : 6}
        style={styles.textarea(mode, focused)}
        onChange={(event) => {
          setDraft(event.target.value);
          setSaveError(null);
          setSaved(false);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void saveNote();
          } else if (event.key === "Escape" && dirty) {
            event.preventDefault();
            resetDraft();
          }
        }}
      />

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
