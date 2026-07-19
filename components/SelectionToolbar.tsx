"use client";

import { useRef } from "react";
import { Highlighter } from "../app/icons";
import { Button } from "./design-system/button";
import { useAnnotationSelection } from "../hooks/MenuOnRange.hooks";
import useMenuStyles from "./styles/MenuOnRange.styles";
import { useAnnotationContext } from "../contexts/Annotator.context";

export default function SelectionToolbar() {
  const { currentHighlightColor } = useAnnotationContext();
  const menuRef = useRef<HTMLButtonElement>(null);
  const { range, createHighlight } = useAnnotationSelection(menuRef);
  const styles = useMenuStyles(menuRef, range);

  return (
    range &&
    <Button
      variant="primary"
      size="small"
      onClick={createHighlight}
      ref={menuRef}
      onMouseDown={(e) => e.preventDefault()}
      style={styles.menuContainer}
      aria-label="Highlight selected text"
      leadingIcon={(
        <span style={styles.colorPreview(currentHighlightColor)} aria-hidden="true">
          <Highlighter size={15} color="currentColor" />
        </span>
      )}
    >
      Highlight
    </Button>
  );
}
