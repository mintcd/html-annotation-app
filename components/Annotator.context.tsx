"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AnnotationSession } from "../core/annotation/session/useAnnotationSession";
import { useSyncRows, useSyncRuntime, useSyncStatus } from "../core/persistence";
import {
  createAnnotationRow,
  deleteAnnotationRow,
  deletePageNoteRow,
  findPageNoteForPage,
  normalizeAnnotationRow,
  syncTimestamp,
  updateAnnotationRow,
  upsertPageNoteRow,
} from "../core/persistence";

type AnnotationUpdate = {
  id: string;
  comment?: string;
  color?: string;
  text?: string;
  html?: string | null;
  position?: TextAnchor;
};

type AnnotationContextProps = {
  children: ReactNode;
  initialAnnotations?: Annotation[];
  pageId: string;
  pageUrl: string;
  session: AnnotationSession;
};

type AnnotationContextType = {
  session: AnnotationSession;
  annotations: Annotation[];
  pageNote: PageNote | null;
  pageUrl?: string;
  title?: string;
  currentHighlightColor: string;
  setCurrentHighlightColor: React.Dispatch<React.SetStateAction<string>>;
  addAnnotation: (payload: { text: string; html: string; color: string; position: TextAnchor }) => Promise<Annotation>;
  deleteAnnotation: (id: string) => void;
  updateAnnotation: (params: AnnotationUpdate) => Promise<boolean>;
  updatePageNote: (content: string) => Promise<boolean>;
  syncStatus: 'synced' | 'syncing' | 'pending';
  lastAutoSaveStatus: { success: boolean; message: string } | null;
};

const EMPTY_ANNOTATIONS: Annotation[] = [];

const AnnotationContextProvider = createContext<AnnotationContextType | null>(null);

export function useAnnotationContext(): AnnotationContextType {
  const context = useContext(AnnotationContextProvider);
  if (!context) {
    throw new Error("useAnnotationContext must be used within AnnotationContext");
  }
  return context;
}

export function useAnnotationContextOptional(): AnnotationContextType | null {
  return useContext(AnnotationContextProvider);
}

export function AnnotationContext({
  children,
  initialAnnotations,
  pageId,
  pageUrl,
  session,
}: AnnotationContextProps) {
  const [currentHighlightColor, setCurrentHighlightColor] = useState<string>("#87ceeb");
  const [lastAutoSaveStatus, setLastAutoSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [initialMatchingComplete, setInitialMatchingComplete] = useState(false);
  const initialHighlightsApplied = useRef(false);
  const matchingGeneration = useRef(0);
  const sync = useSyncStatus();
  const runtime = useSyncRuntime();
  const liveAnnotations = useSyncRows('annotations');
  const livePageNotes = useSyncRows('page_notes');

  const sourceAnnotations = useMemo(
    () => liveAnnotations.data
      ? liveAnnotations.data
        .map((row) => normalizeAnnotationRow(row as unknown as Record<string, unknown>))
        .filter((annotation) => annotation.page_id === pageId || annotation.page_id === pageUrl)
      : initialAnnotations ?? EMPTY_ANNOTATIONS,
    [initialAnnotations, liveAnnotations.data, pageId, pageUrl],
  );

  const [annotations, setAnnotations] = useState<Annotation[]>(sourceAnnotations);
  const pageNote = useMemo(
    () => findPageNoteForPage(
      livePageNotes.data as unknown as Record<string, unknown>[] | undefined,
      pageId,
      pageUrl,
    ),
    [livePageNotes.data, pageId, pageUrl],
  );

  useEffect(() => {
    setAnnotations(sourceAnnotations);
  }, [sourceAnnotations]);

  useEffect(() => {
    if (!session.ready) {
      matchingGeneration.current++;
      initialHighlightsApplied.current = false;
      setInitialMatchingComplete(false);
      return;
    }

    if (
      liveAnnotations.loading
      || initialHighlightsApplied.current
      || !session.root
    ) return;

    initialHighlightsApplied.current = true;
    setInitialMatchingComplete(false);

    const generation = ++matchingGeneration.current;
    void session.applyAnnotations(sourceAnnotations).finally(() => {
      if (matchingGeneration.current === generation) {
        setInitialMatchingComplete(true);
      }
    });
  }, [liveAnnotations.loading, runtime, session, sourceAnnotations]);

  const contentSession = useMemo<AnnotationSession>(() => ({
    ...session,
    ready: session.ready && initialMatchingComplete,
    root: initialMatchingComplete ? session.root : null,
  }), [initialMatchingComplete, session]);

  const addAnnotation = useCallback(async (payload: { text: string; html: string; color: string; position: TextAnchor }): Promise<Annotation> => {
    const { text, html, color, position } = payload;
    const now = syncTimestamp();

    try {
      const inserted = await createAnnotationRow({
        page_id: pageId,
        text,
        html: html || null,
        color,
        comment: null,
        created_at: now,
        updated_at: now,
        position,
      }, runtime);

      setAnnotations(prev => (
        prev.some(ann => ann.id === inserted.id)
          ? prev.map(ann => ann.id === inserted.id ? inserted : ann)
          : [...prev, inserted]
      ));
      setLastAutoSaveStatus({ success: true, message: "Annotation queued (offline-first)" });
      return inserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to queue annotation:", error);
      throw error;
    }
  }, [pageId, runtime]);

  const deleteAnnotation = useCallback(async (id: string) => {
    session.removeHighlight(id);
    setAnnotations(prev => prev.filter((a) => a.id !== id));

    try {
      await deleteAnnotationRow(id, runtime);
      setLastAutoSaveStatus({ success: true, message: "Annotation delete queued" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to queue delete annotation:", error);
    }
  }, [runtime, session]);

  const updateAnnotation = useCallback(async (params: AnnotationUpdate) => {
    const { id, comment, color, text, html, position } = params;

    // If color is updated, also update DOM highlights immediately for UX.
    if (color !== undefined) session.updateHighlightColor(id, color);

    setAnnotations(prev => prev.map(ann => {
      if (ann.id !== id) return ann;
      const updated: Annotation = { ...ann, lastModified: Date.now() } as Annotation;
      if (comment !== undefined) updated.comment = comment.trim() || undefined;
      if (color !== undefined) updated.color = color;
      if (text !== undefined) updated.text = text;
      if (html !== undefined) updated.html = html;
      if (position !== undefined) {
        updated.position = position;
        updated.text = position.exact;
      }
      return updated;
    }));

    try {
      await updateAnnotationRow(id, {
        text,
        html,
        position,
        color,
        comment: comment !== undefined ? comment.trim() || null : undefined,
        updated_at: syncTimestamp(),
      }, runtime);
      setLastAutoSaveStatus({ success: true, message: "Annotation update queued" });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to queue annotation update:", error);
      return false;
    }
  }, [runtime, session]);

  const updatePageNote = useCallback(async (content: string) => {
    try {
      const hasContent = content.trim().length > 0;

      if (!hasContent) {
        if (pageNote) {
          await deletePageNoteRow(pageNote.id, runtime);
        }
        setLastAutoSaveStatus({ success: true, message: "Page note delete queued" });
        return true;
      }

      await upsertPageNoteRow({
        id: pageNote?.id,
        page_id: pageId,
        content,
        format: pageNote?.format,
      }, runtime);
      setLastAutoSaveStatus({ success: true, message: "Page note update queued" });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to queue page note update:", error);
      return false;
    }
  }, [pageId, pageNote, runtime]);

  const syncStatus = useMemo<'synced' | 'syncing' | 'pending'>(() => {
    if (sync.isSyncing) return 'syncing';
    if (sync.status === 'error' || sync.status === 'offline' || (sync.pendingCount ?? 0) > 0) return 'pending';
    return 'synced';
  }, [sync.isSyncing, sync.pendingCount, sync.status]);

  const value = useMemo(() => ({
    session: contentSession,
    annotations,
    pageNote,
    pageUrl,
    title: contentSession.title,
    currentHighlightColor,
    setCurrentHighlightColor,
    addAnnotation,
    deleteAnnotation,
    updateAnnotation,
    updatePageNote,
    syncStatus,
    lastAutoSaveStatus,
  }), [contentSession, annotations, pageUrl, currentHighlightColor,
    setCurrentHighlightColor, addAnnotation, deleteAnnotation, updateAnnotation,
    updatePageNote, pageNote, syncStatus, lastAutoSaveStatus]);

  return (
    <AnnotationContextProvider value={value}>
      {children}
    </AnnotationContextProvider>
  );
}
