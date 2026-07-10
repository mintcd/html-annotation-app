"use client";

import React from "react";
import { Highlighter } from "../app/icons";
import emptyStateStyles from "../styles/EmptyState.styles";

export default function EmptyState({ mode = "compact" }: { mode?: "compact" | "card" }) {
  return (
    <div style={emptyStateStyles.container(mode)} role="status">
      <span style={emptyStateStyles.icon} aria-hidden="true">
        <Highlighter size={18} />
      </span>
      <h3 style={emptyStateStyles.title}>No highlights yet</h3>
      <p style={emptyStateStyles.description}>
        Select text on the page to capture your first annotation.
      </p>
    </div>
  );
}
