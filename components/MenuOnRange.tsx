"use client";

import { useRef } from "react";
import { Highlighter } from "../app/icons";
import { Button } from "../design-system/button";
import { useSelection } from "../hooks/MenuOnRange.hooks";
import useMenuStyles from "../styles/MenuOnRange.styles";
import { useAnnotationContext } from "../context/Annotator.context";

export default function MenuOnRange() {
  const { currentHighlightColor } = useAnnotationContext();
  const menuRef = useRef<HTMLButtonElement>(null);
  const { range, highlight } = useSelection(menuRef);
  const styles = useMenuStyles(menuRef, range);

  return (
    range &&
    <Button
      variant="primary"
      size="small"
      onClick={highlight}
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
