function highlightTint(color?: string, opacity = 0.13): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color || "");
  if (!match) return `rgba(147, 197, 253, ${opacity})`;
  const [, red, green, blue] = match;
  return `rgba(${Number.parseInt(red, 16)}, ${Number.parseInt(green, 16)}, ${Number.parseInt(blue, 16)}, ${opacity})`;
}

const annotationListStyles = {
  container: (mode: "compact" | "card"): React.CSSProperties => ({
    flex: mode === "compact" ? 1 : undefined,
    minHeight: 0,
    overflowY: mode === "compact" ? "auto" : undefined,
    padding: mode === "compact" ? "var(--ds-space-3)" : 0,
    touchAction: "pan-y",
    scrollbarWidth: "thin",
    scrollbarColor: "var(--ds-color-border-strong) transparent",
  }),

  compactList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "var(--ds-space-2)",
  },

  annotationsWrapper: {
    width: "100%",
    maxWidth: "56rem",
    margin: "0 auto",
    display: "grid",
    gap: "var(--ds-space-4)",
  },

  annotationItem: (active: boolean, focused: boolean): React.CSSProperties => ({
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "start",
    gap: "var(--ds-space-2)",
    padding: "var(--ds-space-2)",
    border: `1px solid ${active ? "var(--ds-color-blue-200)" : "var(--ds-color-border)"}`,
    borderRadius: "var(--ds-radius-xl)",
    background: active
      ? "linear-gradient(145deg, var(--ds-color-surface), var(--ds-color-blue-50))"
      : "var(--ds-color-surface)",
    boxShadow: focused
      ? "var(--ds-focus-ring), var(--ds-shadow-md)"
      : active
        ? "var(--ds-shadow-md)"
        : "var(--ds-shadow-sm)",
    transition: [
      "border-color var(--ds-motion-normal) var(--ds-ease-standard)",
      "background var(--ds-motion-normal) var(--ds-ease-standard)",
      "box-shadow var(--ds-motion-normal) var(--ds-ease-standard)",
      "transform var(--ds-motion-normal) var(--ds-ease-standard)",
    ].join(", "),
    transform: active ? "translateY(-1px)" : "none",
  }),

  annotationTarget: {
    minWidth: 0,
    display: "flex",
    alignItems: "stretch",
    gap: "var(--ds-space-3)",
    margin: 0,
    padding: "var(--ds-space-1)",
    border: 0,
    borderRadius: "var(--ds-radius-lg)",
    color: "inherit",
    background: "transparent",
    font: "inherit",
    textAlign: "left" as const,
    cursor: "pointer",
    outline: "none",
  },

  colorIndicator: (color?: string): React.CSSProperties => ({
    width: 4,
    minHeight: 54,
    flex: "0 0 auto",
    borderRadius: "var(--ds-radius-full)",
    backgroundColor: color || "var(--ds-color-blue-300)",
    boxShadow: `0 0 0 4px ${highlightTint(color, 0.12)}`,
  }),

  annotationCopy: {
    minWidth: 0,
    display: "flex",
    flex: 1,
    flexDirection: "column" as const,
    alignItems: "flex-start",
  },

  highlightLabel: {
    marginBottom: 3,
    color: "var(--ds-color-primary)",
    fontSize: "0.625rem",
    fontWeight: "var(--ds-font-weight-bold)",
    letterSpacing: "0.075em",
    lineHeight: 1.3,
    textTransform: "uppercase" as const,
  },

  excerpt: {
    width: "100%",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 3,
    color: "var(--ds-color-text)",
    fontSize: "var(--ds-font-size-xs)",
    fontWeight: "var(--ds-font-weight-medium)",
    lineHeight: "var(--ds-line-height-relaxed)",
  },

  comment: {
    width: "100%",
    minWidth: 0,
    marginTop: "var(--ds-space-2)",
    padding: "0.4rem 0.5rem",
    display: "flex",
    alignItems: "flex-start",
    gap: "var(--ds-space-2)",
    borderRadius: "var(--ds-radius-md)",
    color: "var(--ds-color-text-secondary)",
    background: "var(--ds-color-surface-subtle)",
    fontSize: "0.6875rem",
    lineHeight: "var(--ds-line-height-normal)",
  },

  commentText: {
    minWidth: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 2,
  },

  actionButtons: (visible: boolean): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    gap: "var(--ds-space-1)",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateX(0)" : "translateX(4px)",
    transition: [
      "opacity var(--ds-motion-fast) var(--ds-ease-standard)",
      "transform var(--ds-motion-fast) var(--ds-ease-standard)",
    ].join(", "),
  }),

  annotationCard: (active: boolean): React.CSSProperties => ({
    position: "relative",
    overflow: "hidden",
    padding: "clamp(1rem, 2vw, 1.35rem)",
    border: `1px solid ${active ? "var(--ds-color-blue-200)" : "var(--ds-color-border)"}`,
    borderRadius: "var(--ds-radius-xl)",
    color: "var(--ds-color-text)",
    background: "var(--ds-color-surface)",
    boxShadow: active ? "var(--ds-shadow-md)" : "var(--ds-shadow-sm)",
    transform: active ? "translateY(-2px)" : "none",
    transition: [
      "border-color var(--ds-motion-normal) var(--ds-ease-standard)",
      "box-shadow var(--ds-motion-normal) var(--ds-ease-standard)",
      "transform var(--ds-motion-normal) var(--ds-ease-standard)",
    ].join(", "),
  }),

  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "var(--ds-space-2)",
    marginBottom: "var(--ds-space-3)",
  },

  cardMarker: (color?: string): React.CSSProperties => ({
    width: 10,
    height: 10,
    border: "2px solid var(--ds-color-surface)",
    borderRadius: "var(--ds-radius-full)",
    background: color || "var(--ds-color-blue-300)",
    boxShadow: `0 0 0 3px ${highlightTint(color, 0.2)}`,
  }),

  cardEyebrow: {
    color: "var(--ds-color-text-tertiary)",
    fontSize: "0.65rem",
    fontWeight: "var(--ds-font-weight-bold)",
    letterSpacing: "0.09em",
    textTransform: "uppercase" as const,
  },

  annotationText: (color?: string): React.CSSProperties => ({
    position: "relative",
    margin: 0,
    padding: "var(--ds-space-4) var(--ds-space-5)",
    border: 0,
    borderLeft: `3px solid ${color || "var(--ds-color-blue-300)"}`,
    borderRadius: "0 var(--ds-radius-lg) var(--ds-radius-lg) 0",
    color: "var(--ds-color-text)",
    background: `linear-gradient(90deg, ${highlightTint(color, 0.18)}, ${highlightTint(color, 0.07)})`,
    fontSize: "clamp(0.875rem, 1.5vw, 1rem)",
    fontWeight: "var(--ds-font-weight-medium)",
    lineHeight: "var(--ds-line-height-relaxed)",
  }),

  cardCommentSection: {
    marginTop: "var(--ds-space-4)",
    padding: "var(--ds-space-3)",
    display: "flex",
    alignItems: "flex-start",
    gap: "var(--ds-space-2)",
    border: "1px solid var(--ds-color-border)",
    borderRadius: "var(--ds-radius-lg)",
    background: "var(--ds-color-surface-subtle)",
  },

  cardCommentIcon: {
    width: 28,
    height: 28,
    flex: "0 0 auto",
    display: "inline-grid",
    placeItems: "center",
    borderRadius: "var(--ds-radius-md)",
    color: "var(--ds-color-primary)",
    background: "var(--ds-color-primary-soft)",
  },

  cardCommentText: {
    margin: 0,
    paddingTop: 3,
    color: "var(--ds-color-text-secondary)",
    fontSize: "var(--ds-font-size-sm)",
    lineHeight: "var(--ds-line-height-normal)",
    whiteSpace: "pre-wrap" as const,
  },

  cardEditor: {
    marginTop: "var(--ds-space-4)",
    padding: "var(--ds-space-3)",
    border: "1px solid var(--ds-color-blue-200)",
    borderRadius: "var(--ds-radius-lg)",
    background: "var(--ds-color-blue-50)",
  },

  editorLabel: {
    display: "block",
    marginBottom: "var(--ds-space-2)",
    color: "var(--ds-color-text)",
    fontSize: "var(--ds-font-size-xs)",
    fontWeight: "var(--ds-font-weight-semibold)",
  },

  commentTextarea: {
    width: "100%",
    minHeight: 92,
    boxSizing: "border-box" as const,
    padding: "var(--ds-space-3)",
    border: "1px solid var(--ds-color-border-strong)",
    borderRadius: "var(--ds-radius-lg)",
    color: "var(--ds-color-text)",
    background: "var(--ds-color-surface)",
    boxShadow: "var(--ds-shadow-sm)",
    font: "inherit",
    fontSize: "var(--ds-font-size-sm)",
    lineHeight: "var(--ds-line-height-normal)",
    outline: "none",
    resize: "vertical" as const,
  },

  editorFooter: {
    marginTop: "var(--ds-space-2)",
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--ds-space-2)",
  },

  editorHint: {
    color: "var(--ds-color-text-tertiary)",
    fontSize: "0.6875rem",
  },

  editorActions: {
    display: "flex",
    alignItems: "center",
    gap: "var(--ds-space-1)",
  },

  annotationActions: {
    marginTop: "var(--ds-space-4)",
    paddingTop: "var(--ds-space-3)",
    display: "flex",
    flexWrap: "wrap" as const,
    justifyContent: "flex-end",
    gap: "var(--ds-space-2)",
    borderTop: "1px solid var(--ds-color-border)",
  },
};

export default annotationListStyles;
