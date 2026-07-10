"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

export type AnnotatorPanel =
  | { type: "closed" }
  | { type: "annotations" };

export type AnnotatorContextualOverlay =
  | { type: "none" }
  | { type: "selection" }
  | { type: "highlight"; annotationId: string }
  | { type: "resize"; annotationId: string }
  | { type: "comment"; annotationId: string }
  | { type: "color"; annotationId: string };

export type AnnotatorDialog =
  | { type: "none" }
  | { type: "externalLink"; href: string }
  | { type: "pasteHtml"; error?: string };

export type AnnotatorOverlayState = {
  panel: AnnotatorPanel;
  contextual: AnnotatorContextualOverlay;
  dialog: AnnotatorDialog;
};

export const INITIAL_ANNOTATOR_OVERLAY_STATE: AnnotatorOverlayState = {
  panel: { type: "closed" },
  contextual: { type: "none" },
  dialog: { type: "none" },
};

export type AnnotatorOverlayAction =
  | { type: "setPanel"; panel: AnnotatorPanel }
  | { type: "setContextual"; contextual: AnnotatorContextualOverlay }
  | { type: "setDialog"; dialog: AnnotatorDialog }
  | { type: "closeTopmost" }
  | { type: "reset" };

export function annotatorOverlayReducer(
  state: AnnotatorOverlayState,
  action: AnnotatorOverlayAction,
): AnnotatorOverlayState {
  switch (action.type) {
    case "setPanel":
      return state.panel === action.panel
        ? state
        : { ...state, panel: action.panel };
    case "setContextual":
      return state.contextual === action.contextual
        ? state
        : { ...state, contextual: action.contextual };
    case "setDialog":
      return state.dialog === action.dialog
        ? state
        : { ...state, dialog: action.dialog };
    case "closeTopmost":
      if (state.dialog.type !== "none") {
        return { ...state, dialog: { type: "none" } };
      }
      if (state.contextual.type !== "none") {
        return { ...state, contextual: { type: "none" } };
      }
      if (state.panel.type !== "closed") {
        return { ...state, panel: { type: "closed" } };
      }
      return state;
    case "reset":
      return INITIAL_ANNOTATOR_OVERLAY_STATE;
  }
}

export type AnnotatorOverlayContextValue = {
  state: AnnotatorOverlayState;
  panel: AnnotatorPanel;
  contextual: AnnotatorContextualOverlay;
  dialog: AnnotatorDialog;
  setPanel: (panel: AnnotatorPanel) => void;
  openAnnotations: () => void;
  closePanel: () => void;
  toggleAnnotations: () => void;
  setContextual: (contextual: AnnotatorContextualOverlay) => void;
  showSelection: () => void;
  showHighlight: (annotationId: string) => void;
  showResize: (annotationId: string) => void;
  showComment: (annotationId: string) => void;
  showColor: (annotationId: string) => void;
  clearContextual: () => void;
  setDialog: (dialog: AnnotatorDialog) => void;
  showExternalLink: (href: string) => void;
  showPasteHtml: (error?: string) => void;
  closeDialog: () => void;
  closeTopmost: () => void;
  resetOverlays: () => void;
};

const AnnotatorOverlayContext = createContext<AnnotatorOverlayContextValue | null>(null);

export type AnnotatorOverlayProviderProps = {
  children: ReactNode;
  initialState?: Partial<AnnotatorOverlayState>;
  dismissOnEscape?: boolean;
  onStateChange?: (state: AnnotatorOverlayState) => void;
};

function createInitialState(
  initialState: Partial<AnnotatorOverlayState> | undefined,
): AnnotatorOverlayState {
  return {
    panel: initialState?.panel ?? INITIAL_ANNOTATOR_OVERLAY_STATE.panel,
    contextual: initialState?.contextual ?? INITIAL_ANNOTATOR_OVERLAY_STATE.contextual,
    dialog: initialState?.dialog ?? INITIAL_ANNOTATOR_OVERLAY_STATE.dialog,
  };
}

export function AnnotatorOverlayProvider({
  children,
  initialState,
  dismissOnEscape = true,
  onStateChange,
}: AnnotatorOverlayProviderProps) {
  const [state, dispatch] = useReducer(
    annotatorOverlayReducer,
    initialState,
    createInitialState,
  );

  const setPanel = useCallback((panel: AnnotatorPanel) => {
    dispatch({ type: "setPanel", panel });
  }, []);
  const openAnnotations = useCallback(() => setPanel({ type: "annotations" }), [setPanel]);
  const closePanel = useCallback(() => setPanel({ type: "closed" }), [setPanel]);
  const toggleAnnotations = useCallback(() => {
    setPanel(state.panel.type === "annotations" ? { type: "closed" } : { type: "annotations" });
  }, [setPanel, state.panel.type]);

  const setContextual = useCallback((contextual: AnnotatorContextualOverlay) => {
    dispatch({ type: "setContextual", contextual });
  }, []);
  const showSelection = useCallback(() => setContextual({ type: "selection" }), [setContextual]);
  const showHighlight = useCallback(
    (annotationId: string) => setContextual({ type: "highlight", annotationId }),
    [setContextual],
  );
  const showResize = useCallback(
    (annotationId: string) => setContextual({ type: "resize", annotationId }),
    [setContextual],
  );
  const showComment = useCallback(
    (annotationId: string) => setContextual({ type: "comment", annotationId }),
    [setContextual],
  );
  const showColor = useCallback(
    (annotationId: string) => setContextual({ type: "color", annotationId }),
    [setContextual],
  );
  const clearContextual = useCallback(() => setContextual({ type: "none" }), [setContextual]);

  const setDialog = useCallback((dialog: AnnotatorDialog) => {
    dispatch({ type: "setDialog", dialog });
  }, []);
  const showExternalLink = useCallback(
    (href: string) => setDialog({ type: "externalLink", href }),
    [setDialog],
  );
  const showPasteHtml = useCallback(
    (error?: string) => setDialog(error === undefined ? { type: "pasteHtml" } : { type: "pasteHtml", error }),
    [setDialog],
  );
  const closeDialog = useCallback(() => setDialog({ type: "none" }), [setDialog]);
  const closeTopmost = useCallback(() => dispatch({ type: "closeTopmost" }), []);
  const resetOverlays = useCallback(() => dispatch({ type: "reset" }), []);

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  useEffect(() => {
    if (!dismissOnEscape) return;
    const hasOpenOverlay = state.dialog.type !== "none"
      || state.contextual.type !== "none"
      || state.panel.type !== "closed";
    if (!hasOpenOverlay) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeTopmost();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeTopmost, dismissOnEscape, state.contextual.type, state.dialog.type, state.panel.type]);

  const value = useMemo<AnnotatorOverlayContextValue>(() => ({
    state,
    panel: state.panel,
    contextual: state.contextual,
    dialog: state.dialog,
    setPanel,
    openAnnotations,
    closePanel,
    toggleAnnotations,
    setContextual,
    showSelection,
    showHighlight,
    showResize,
    showComment,
    showColor,
    clearContextual,
    setDialog,
    showExternalLink,
    showPasteHtml,
    closeDialog,
    closeTopmost,
    resetOverlays,
  }), [
    clearContextual,
    closeDialog,
    closePanel,
    closeTopmost,
    openAnnotations,
    resetOverlays,
    setContextual,
    setDialog,
    setPanel,
    showColor,
    showComment,
    showExternalLink,
    showHighlight,
    showResize,
    showPasteHtml,
    showSelection,
    state,
    toggleAnnotations,
  ]);

  return (
    <AnnotatorOverlayContext.Provider value={value}>
      {children}
    </AnnotatorOverlayContext.Provider>
  );
}

export function useAnnotatorOverlay(): AnnotatorOverlayContextValue {
  const context = useContext(AnnotatorOverlayContext);
  if (!context) {
    throw new Error("useAnnotatorOverlay must be used within an AnnotatorOverlayProvider");
  }
  return context;
}

export function useAnnotatorOverlayOptional(): AnnotatorOverlayContextValue | null {
  return useContext(AnnotatorOverlayContext);
}
