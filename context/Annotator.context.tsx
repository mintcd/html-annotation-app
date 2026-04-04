"use client";

import { createContext, useContext, ReactNode } from "react";
import { useCallback, useState, useMemo, useRef } from "react";
import { removeHighlights } from "../utils/dom";
import { createAnnotation, updateAnnotation as updateAnnotationAPI, deleteAnnotation as deleteAnnotationAPI, getPage, updatePage } from "../utils/api.client";

type AnnotationContextProps = {
  children: ReactNode;
  initialAnnotations?: AnnotationItem[];
  pageUrl: string;
  title?: string;
  contentRef: React.RefObject<HTMLElement>;
  /** Ref to the <iframe> element, when content is rendered inside one. */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** True once the iframe has finished loading its real content. */
  iframeReady: boolean;
};

type AnnotationContextType = {
  contentRef: React.RefObject<HTMLElement>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  iframeReady: boolean;
  annotations: AnnotationItem[];
  pageUrl?: string;
  title?: string;
  currentHighlightColor: string;
  setCurrentHighlightColor: React.Dispatch<React.SetStateAction<string>>;
  addAnnotation: (text: string, html: string, color: string) => Promise<{ tempId: string; promise: Promise<string> }>;
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
  iframeReady,
}: AnnotationContextProps) {
  const [annotations, setAnnotations] = useState<AnnotationItem[]>(initialAnnotations);
  const [currentHighlightColor, setCurrentHighlightColor] = useState<string>("#87ceeb");
  const [pendingOperations, setPendingOperations] = useState<Array<{ type: 'create' | 'update' | 'delete', annotation: AnnotationItem }>>([]);
  const [lastAutoSaveStatus, setLastAutoSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addAnnotation = useCallback(async (text: string, html: string, color: string): Promise<{ tempId: string; promise: Promise<string> }> => {
    const tempId = `temp-${Date.now()}`;
    const now = Date.now();
    const tempAnnotation: AnnotationItem = {
      id: tempId,
      text,
      color,
      created: now,
      lastModified: now,
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
          const existingPage = await getPage(pageUrl);
          if (existingPage && existingPage.title !== title) {
            await updatePage({ url: pageUrl, title });
          }
        }

        // Create annotation and get server-generated ID, including color
        const serverAnnotation = await createAnnotation(pageUrl, text, html, color);

        // Replace temp annotation with server annotation (with proper ID)
        setAnnotations(prev => prev.map(ann =>
          ann.id === tempId ? {
            ...ann,
            id: serverAnnotation.id,
            color: serverAnnotation.color, // Use color from server
            created: new Date(serverAnnotation.created_at).getTime(),
            lastModified: new Date(serverAnnotation.updated_at).getTime(),
          } : ann
        ));

        setLastAutoSaveStatus({ success: true, message: "Annotation created" });
        return serverAnnotation.id;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setLastAutoSaveStatus({ success: false, message: errorMessage });
        console.error("Failed to create annotation:", error);
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

    // Immediately delete from API
    try {
      await deleteAnnotationAPI(id);
      setLastAutoSaveStatus({ success: true, message: "Annotation deleted" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to delete annotation:", error);
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

    let currentAnnotation: AnnotationItem | undefined;

    setAnnotations(prev => prev.map(ann => {
      if (ann.id !== id) return ann;
      currentAnnotation = ann; // Capture current annotation before update
      const updated: AnnotationItem = { ...ann, lastModified: Date.now() } as AnnotationItem;
      if (comment !== undefined) updated.comment = comment.trim() || undefined;
      if (color !== undefined) updated.color = color;
      if (text !== undefined) updated.text = text;
      if (html !== undefined) updated.html = html;
      return updated;
    }));

    // Immediately update in API
    try {
      if (currentAnnotation) {
        const updatedText = text !== undefined ? text : undefined;
        const updatedHtml = html !== undefined ? html : undefined;
        const updatedColor = color !== undefined ? color : undefined;
        const updatedComment = comment !== undefined ? (comment.trim() || undefined) : undefined;
        await updateAnnotationAPI(id, updatedText, updatedHtml, updatedColor, updatedComment);
        setLastAutoSaveStatus({ success: true, message: "Annotation updated" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastAutoSaveStatus({ success: false, message: errorMessage });
      console.error("Failed to update annotation:", error);
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
