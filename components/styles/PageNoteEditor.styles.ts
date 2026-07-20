const pageNoteEditorStyles = {
  section: (mode: "compact" | "dashboard"): React.CSSProperties => ({
    flex: "0 0 auto",
    margin: mode === "compact" ? "var(--ds-space-3) var(--ds-space-3) 0" : "0 0 1rem",
    padding: mode === "compact" ? "var(--ds-space-3)" : "1rem",
    border: "1px solid var(--ds-color-border)",
    borderRadius: "var(--ds-radius-lg)",
    color: "var(--ds-color-text)",
    background: mode === "compact"
      ? "var(--ds-color-surface-subtle)"
      : "rgba(255, 255, 255, 0.84)",
    boxShadow: mode === "compact" ? "none" : "0 1px 2px rgba(28, 32, 46, 0.03)",
  }),

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--ds-space-2)",
    marginBottom: "var(--ds-space-2)",
  },

  label: {
    color: "var(--ds-color-text)",
    fontSize: "var(--ds-font-size-xs)",
    fontWeight: "var(--ds-font-weight-bold)",
    letterSpacing: "0.075em",
    textTransform: "uppercase" as const,
  },

  status: (tone: "neutral" | "success" | "danger"): React.CSSProperties => ({
    minWidth: 0,
    overflow: "hidden",
    color: tone === "danger"
      ? "var(--ds-color-danger)"
      : tone === "success"
        ? "var(--ds-color-success)"
        : "var(--ds-color-text-tertiary)",
    fontSize: "0.6875rem",
    fontWeight: 650,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),

  editorSurface: (
    mode: "compact" | "dashboard",
    active: boolean,
    disabled: boolean,
  ): React.CSSProperties => ({
    width: "100%",
    minHeight: mode === "compact" ? 86 : 124,
    boxSizing: "border-box",
    padding: mode === "compact" ? "var(--ds-space-3)" : "0.85rem",
    border: `1px solid ${active ? "var(--ds-color-focus)" : "var(--ds-color-border)"}`,
    borderRadius: "var(--ds-radius-md)",
    color: "var(--ds-color-text)",
    background: disabled ? "var(--ds-color-surface-subtle)" : "var(--ds-color-surface)",
    boxShadow: active ? "var(--ds-focus-ring)" : "inset 0 1px 2px rgba(21, 32, 51, 0.04)",
    cursor: disabled ? "not-allowed" : "text",
    font: "inherit",
    fontSize: mode === "compact" ? "var(--ds-font-size-xs)" : "0.82rem",
    lineHeight: "var(--ds-line-height-normal)",
    outline: "none",
    overflowWrap: "anywhere",
    transition: [
      "border-color var(--ds-motion-fast) var(--ds-ease-standard)",
      "box-shadow var(--ds-motion-fast) var(--ds-ease-standard)",
    ].join(", "),
  }),

  placeholder: {
    color: "var(--ds-color-text-tertiary)",
  },

  actions: {
    marginTop: "var(--ds-space-2)",
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "var(--ds-space-1)",
  },
};

export default pageNoteEditorStyles;
