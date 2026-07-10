const commentEditorStyles = {
  container: {
    margin: "calc(var(--ds-space-1) * -1) var(--ds-space-1) var(--ds-space-2)",
  },

  editorCard: {
    padding: "var(--ds-space-3)",
    border: "1px solid var(--ds-color-blue-200)",
    borderRadius: "var(--ds-radius-lg)",
    background: "linear-gradient(145deg, var(--ds-color-blue-50), var(--ds-color-surface))",
    boxShadow: "var(--ds-shadow-sm)",
  },

  header: {
    marginBottom: "var(--ds-space-2)",
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "var(--ds-space-1) var(--ds-space-2)",
  },

  label: {
    color: "var(--ds-color-text)",
    fontSize: "var(--ds-font-size-xs)",
    fontWeight: "var(--ds-font-weight-semibold)",
  },

  helperText: {
    color: "var(--ds-color-text-tertiary)",
    fontSize: "0.625rem",
  },

  textarea: (isFocused: boolean): React.CSSProperties => ({
    width: "100%",
    minHeight: 84,
    boxSizing: "border-box",
    padding: "var(--ds-space-3)",
    border: `1px solid ${isFocused ? "var(--ds-color-focus)" : "var(--ds-color-border)"}`,
    borderRadius: "var(--ds-radius-lg)",
    color: "var(--ds-color-text)",
    background: "var(--ds-color-surface)",
    boxShadow: isFocused ? "var(--ds-focus-ring)" : "inset 0 1px 2px rgba(21, 32, 51, 0.04)",
    fontFamily: "var(--ds-font-family-sans)",
    fontSize: "var(--ds-font-size-xs)",
    lineHeight: "var(--ds-line-height-normal)",
    outline: "none",
    resize: "vertical",
    transition: [
      "border-color var(--ds-motion-fast) var(--ds-ease-standard)",
      "box-shadow var(--ds-motion-fast) var(--ds-ease-standard)",
    ].join(", "),
  }),

  actions: {
    marginTop: "var(--ds-space-2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "var(--ds-space-1)",
  },
};

export default commentEditorStyles;
