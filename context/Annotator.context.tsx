"use client";

import { createContext, useContext, ReactNode } from "react";
import { useCallback, useState, useMemo, useRef } from "react";
import { removeHighlights } from "../utils/dom";
import repository from "../utils/repository";
import { eq } from "../utils/QueryBuilder";

type AnnotationContextProps = {
  children: ReactNode;
  initialAnnotations?: Annotation[];
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
  addAnnotation: (payload: { text: string, html: string, color: string, path?: number[] | null }) => Promise<{ tempId: string; promise: Promise<string> }>;
  deleteAnnotation: (id: string) => void;
  updateAnnotation: (params: { id: string; comment?: string; color?: string; text?: string; html?: string }) => void;
  syncStatus: 'synced' | 'syncing' | 'to-sync';
  lastAutoSaveStatus: { success: boolean; message: string } | null;
};

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
  initialAnnotations = [],
  pageUrl,
  title,
  contentRef,
  iframeRef,
  iframeUrl,
  iframeReady,
}: AnnotationContextProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [currentHighlightColor, setCurrentHighlightColor] = useState<string>("#87ceeb");
  const [pendingOperations, setPendingOperations] = useState<Array<{ type: 'create' | 'update' | 'delete', annotation: Annotation }>>([]);
  const [lastAutoSaveStatus, setLastAutoSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addAnnotation = useCallback(async (payload: { text: string, html: string, color: string, position?: { startPosition: number, endPosition: number, startOffset: number, endOffset: number } }): Promise<{ tempId: string; promise: Promise<string> }> => {
    const { text, html, color, position } = payload;
    const tempId = `temp-${Date.now()}`;
    const now = Date.now().toString();
    const tempAnnotation: Annotation = {
      page_id: pageUrl,
      id: tempId,
      text,
      color,
      created_at: now,
      updated_at: now,
      html,
    };
    // Add temporary annotation to show immediately in UI
    setAnnotations(prev => [...prev, tempAnnotation]);

    // Return temp ID immediately and a promise for the final ID
    const promise = (async () => {
      try {
        // Only update the page title if it already exists and we have a real title.
        // Dashboard is responsible for creating pages.
        if (title) {
          const existingPages: any[] = await repository.select('id', 'title').from('pages').where(eq('url', pageUrl));
          const existingPage = existingPages && existingPages.length ? existingPages[0] : null;
          if (existingPage && existingPage.title !== title) {
            await repository.update({ title }).from('pages').where(eq('url', pageUrl));
          }
        }

        // Create annotation locally and queue for remote sync
        await repository.insert({ id: tempId, page_id: pageUrl, text, html, color, created_at: Date.now(), updated_at: Date.now(), position }).from('annotations');

        setLastAutoSaveStatus({ success: true, message: "Annotation queued (offline-first)" });
        return tempId;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setLastAutoSaveStatus({ success: false, message: errorMessage });
        console.error("Failed to queue annotation:", error);
        // Remove temp annotation on failure
        setAnnotations(prev => prev.filter(ann => ann.id !== tempId));
        throw error;
      }
    })();

    return { tempId, promise };
  }, [pageUrl, title]);

  const deleteAnnotation = useCallback(async (id: string) => {
    if (!contentRef.current) return;
    removeHighlights(contentRef.current, id);
    setAnnotations(prev => prev.filter((a) => a.id !== id));

    // Queue delete operation locally
    try {
      await repository.delete().from('annotations').where(eq('id', id));
      setLastAutoSaveStatus({ success: true, message: "Annotation delete queued" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to queue delete annotation:", error);
    }
  }, [contentRef]);

  const updateAnnotation = useCallback(async (params: { id: string; comment?: string; color?: string; text?: string; html?: string }) => {
    const { id, comment, color, text, html } = params;

    // If color is updated, also update DOM highlights immediately for UX.
    if (color !== undefined && contentRef.current) {
      const spans = contentRef.current.querySelectorAll<HTMLSpanElement>(
        `span.highlighted-text[data-highlight-id="${id}"]`
      );
      spans.forEach(span => {
        span.style.backgroundColor = color;
      });
    }

    let currentAnnotation: Annotation | undefined;

    setAnnotations(prev => prev.map(ann => {
      if (ann.id !== id) return ann;
      currentAnnotation = ann; // Capture current annotation before update
      const updated: Annotation = { ...ann, lastModified: Date.now() } as Annotation;
      if (comment !== undefined) updated.comment = comment.trim() || undefined;
      if (color !== undefined) updated.color = color;
      if (text !== undefined) updated.text = text;
      if (html !== undefined) updated.html = html;
      return updated;
    }));

    // Immediately update in API
    try {
      if (currentAnnotation) {
        const changes: any = {};
        if (text !== undefined) changes.text = text;
        if (html !== undefined) changes.html = html;
        if (color !== undefined) changes.color = color;
        if (comment !== undefined) changes.comment = comment !== '' ? comment : null;
        await repository.update({ ...(changes as any) }).from('annotations').where(eq('id', id));
        setLastAutoSaveStatus({ success: true, message: "Annotation update queued" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to queue annotation update:", error);
    }
  }, [contentRef]);

  // Compute sync status based on pending operations
  const syncStatus = useMemo<'synced' | 'syncing' | 'to-sync'>(() => {
    if (isSyncing) return 'syncing';
    if (pendingOperations.length > 0) return 'to-sync';
    return 'synced';
  }, [isSyncing, pendingOperations]);

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
  }), [contentRef, iframeRef, iframeReady, annotations, pageUrl, title, currentHighlightColor,
    setCurrentHighlightColor, addAnnotation, deleteAnnotation, updateAnnotation,
    syncStatus, lastAutoSaveStatus]);

  return (
    <AnnotationContextProvider value={value}>
      {children}
    </AnnotationContextProvider>
  );
}
