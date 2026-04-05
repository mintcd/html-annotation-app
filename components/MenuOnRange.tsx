"use client";

import { useRef } from "react";
import { Highlighter } from "../app/icons";
import { useSelection } from "../hooks/MenuOnRange.hooks";
import menuStyles from "../styles/MenuOnRange.styles";
import { useAnnotationContext } from "../context/Annotator.context";

export default function MenuOnRange() {
  const { currentHighlightColor } = useAnnotationContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const { range, highlight } = useSelection(menuRef);
  const styles = menuStyles(menuRef, range);

  return (
    range &&
    <div
      onClick={highlight}
      ref={menuRef}
      onMouseDown={(e) => e.preventDefault()}
      style={styles.menuContainer}
    >
      <Highlighter size={20} color={currentHighlightColor} />
    </div>
  );
}