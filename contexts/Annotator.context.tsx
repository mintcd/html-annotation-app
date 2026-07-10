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
import { removeHighlights } from "../utils/dom";
import { highlightAnnotations } from "../utils/annotations";
import { eq, useLiveQuery, useSyncStatus } from "@mintcd/sync-engine";
import { db } from "../utils/engine";
import { ensurePage, normalizeAnnotationRow, syncTimestamp } from "../utils/syncData";

type AnnotationPosition = NonNullable<Annotation['position']>;

type AnnotationUpdate = {
  id: string;
  comment?: string;
  color?: string;
  text?: string;
  html?: string | null;
  position?: AnnotationPosition;
};

type AnnotationContextProps = {
  children: ReactNode;
  initialAnnotations?: Annotation[];
  pageId: string;
  pageUrl: string;
  title?: string;
  contentRef: React.RefObject<HTMLElement>;
  /** Ref to the <iframe> element, when content is rendered inside one. */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** The iframe URL used to render the page (/_frame/slug/...) */
  iframeUrl?: string;
  /** True once the iframe has finished loading its real content. */
  iframeReady: boolean;
};

type AnnotationContextType = {
  contentRef: React.RefObject<HTMLElement>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  iframeReady: boolean;
  annotations: Annotation[];
  iframeUrl?: string;
  pageUrl?: string;
  title?: string;
  currentHighlightColor: string;
  setCurrentHighlightColor: React.Dispatch<React.SetStateAction<string>>;
  addAnnotation: (payload: { text: string; html: string; color: string; position?: AnnotationPosition }) => Promise<{ tempId: string; promise: Promise<string> }>;
  deleteAnnotation: (id: string) => void;
  updateAnnotation: (params: AnnotationUpdate) => Promise<boolean>;
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
  title,
  contentRef,
  iframeRef,
  iframeUrl,
  iframeReady,
}: AnnotationContextProps) {
  const [currentHighlightColor, setCurrentHighlightColor] = useState<string>("#87ceeb");
  const [lastAutoSaveStatus, setLastAutoSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const initialHighlightsApplied = useRef(false);
  const sync = useSyncStatus();
  const liveAnnotations = useLiveQuery(db.select().from('annotations'));

  const sourceAnnotations = useMemo(
    () => liveAnnotations.data
      ? liveAnnotations.data
        .map((row) => normalizeAnnotationRow(row as unknown as Record<string, unknown>))
        .filter((annotation) => annotation.page_id === pageId || annotation.page_id === pageUrl)
      : initialAnnotations ?? EMPTY_ANNOTATIONS,
    [initialAnnotations, liveAnnotations.data, pageId, pageUrl],
  );

  const [annotations, setAnnotations] = useState<Annotation[]>(sourceAnnotations);

  useEffect(() => {
    setAnnotations(sourceAnnotations);
  }, [sourceAnnotations]);

  useEffect(() => {
    if (!iframeReady) {
      initialHighlightsApplied.current = false;
      return;
    }

    if (
      liveAnnotations.loading
      || initialHighlightsApplied.current
      || !contentRef.current
    ) return;

    initialHighlightsApplied.current = true;
    void highlightAnnotations(sourceAnnotations, contentRef.current);
  }, [contentRef, iframeReady, liveAnnotations.loading, sourceAnnotations]);

  const addAnnotation = useCallback(async (payload: { text: string; html: string; color: string; position?: AnnotationPosition }): Promise<{ tempId: string; promise: Promise<string> }> => {
    const { text, html, color, position } = payload;
    const tempId = crypto.randomUUID();
    const now = syncTimestamp();
    const tempAnnotation: Annotation = {
      page_id: pageId,
      id: tempId,
      text,
      color,
      created_at: now,
      updated_at: now,
      html,
      position,
    };
    setAnnotations(prev => [...prev, tempAnnotation]);

    const promise = (async () => {
      try {
        const page = await ensurePage(pageUrl, title ?? '');
        const canonicalPageId = String(page.id);

        if (title) {
          const existingPages = await db.select('id', 'title').from('pages').where(eq('id', canonicalPageId)).execute();
          const existingPage = existingPages && existingPages.length ? existingPages[0] : null;
          if (existingPage && existingPage.title !== title) {
            await db.update({ title, updated_at: syncTimestamp() })
              .from('pages')
              .where(eq('id', canonicalPageId))
              .execute();
          }
        }

        const result = await db.insert({
          page_id: canonicalPageId,
          text,
          html: html || null,
          color,
          comment: null,
          created_at: now,
          updated_at: now,
          position: position ?? null,
        }).from('annotations').execute();
        const insertedId = result.rows[0]?.id;
        if (!insertedId) throw new Error('Annotation insert did not return an id');

        setAnnotations(prev => prev.map(ann => (
          ann.id === tempId
            ? { ...ann, id: String(insertedId), page_id: canonicalPageId }
            : ann
        )));

        setLastAutoSaveStatus({ success: true, message: "Annotation queued (offline-first)" });
        return String(insertedId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setLastAutoSaveStatus({ success: false, message: errorMessage });
        console.error("Failed to queue annotation:", error);
        setAnnotations(prev => prev.filter(ann => ann.id !== tempId));
        throw error;
      }
    })();

    return { tempId, promise };
  }, [pageId, pageUrl, title]);

  const deleteAnnotation = useCallback(async (id: string) => {
    if (contentRef.current) removeHighlights(contentRef.current, id);
    setAnnotations(prev => prev.filter((a) => a.id !== id));

    try {
      await db.delete().from('annotations').where(eq('id', id)).execute();
      setLastAutoSaveStatus({ success: true, message: "Annotation delete queued" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to queue delete annotation:", error);
    }
  }, [contentRef]);

  const updateAnnotation = useCallback(async (params: AnnotationUpdate) => {
    const { id, comment, color, text, html, position } = params;

    // If color is updated, also update DOM highlights immediately for UX.
    if (color !== undefined && contentRef.current) {
      const spans = contentRef.current.querySelectorAll<HTMLSpanElement>(
        `span.highlighted-text[data-highlight-id="${id}"]`
      );
      spans.forEach(span => {
        span.style.backgroundColor = color;
      });
    }

    setAnnotations(prev => prev.map(ann => {
      if (ann.id !== id) return ann;
      const updated: Annotation = { ...ann, lastModified: Date.now() } as Annotation;
      if (comment !== undefined) updated.comment = comment.trim() || undefined;
      if (color !== undefined) updated.color = color;
      if (text !== undefined) updated.text = text;
      if (html !== undefined) updated.html = html;
      if (position !== undefined) updated.position = position;
      return updated;
    }));

    try {
      const changes: Record<string, unknown> = { updated_at: syncTimestamp() };
      if (text !== undefined) changes.text = text;
      if (html !== undefined) changes.html = html;
      if (position !== undefined) changes.position = position;
      if (color !== undefined) changes.color = color;
      if (comment !== undefined) changes.comment = comment !== '' ? comment : null;
      await db.update(changes).from('annotations').where(eq('id', id)).execute();
      setLastAutoSaveStatus({ success: true, message: "Annotation update queued" });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to queue annotation update:", error);
      return false;
    }
  }, [contentRef]);

  const syncStatus = useMemo<'synced' | 'syncing' | 'pending'>(() => {
    if (sync.isSyncing) return 'syncing';
    if (sync.status === 'error' || sync.status === 'offline' || (sync.pendingCount ?? 0) > 0) return 'pending';
    return 'synced';
  }, [sync.isSyncing, sync.pendingCount, sync.status]);

  const value = useMemo(() => ({
    contentRef,
    iframeRef,
    iframeReady,
    annotations,
    iframeUrl,
    pageUrl,
    title,
    currentHighlightColor,
    setCurrentHighlightColor,
    addAnnotation,
    deleteAnnotation,
    updateAnnotation,
    syncStatus,
    lastAutoSaveStatus,
  }), [contentRef, iframeRef, iframeReady, annotations, iframeUrl, pageUrl, title, currentHighlightColor,
    setCurrentHighlightColor, addAnnotation, deleteAnnotation, updateAnnotation,
    syncStatus, lastAutoSaveStatus]);

  return (
    <AnnotationContextProvider value={value}>
      {children}
    </AnnotationContextProvider>
  );
}
