"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHotkey, useMobile } from "../hooks";
import colorPickerStyles from "./styles/ColorPicker.styles";
import { useAnnotationContextOptional } from "../contexts/Annotator.context";

type ColorPickerProps = {
  onColorSelect: (color: string) => void;
  onClose: () => void;
  currentColor?: string;
  // Accept either a precomputed anchor rect or an annotation id so the picker
  // can compute its own anchor rect lazily.
  anchorRect?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
  anchorId?: string | null;
};

const HIGHLIGHT_COLORS = [
  { name: "Blue", value: "#87ceeb" },
  { name: "Green", value: "#90ee90" },
  { name: "Red", value: "#ff6b6b" },
  { name: "Gray", value: "#d3d3d3" },
];

export default function ColorPicker({
  onColorSelect,
  onClose,
  currentColor,
  anchorRect,
  anchorId,
}: ColorPickerProps) {
  const { isMobile, viewportInfo } = useMobile();
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const colorButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const annotationCtx = useAnnotationContextOptional();

  const computedAnchorRect = useMemo(() => {
    if (!anchorId) return anchorRect ?? null;
    return annotationCtx?.session.getHighlightRect(anchorId) ?? anchorRect ?? null;
  }, [anchorId, anchorRect, annotationCtx?.session]);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const selectedIndex = Math.max(0, HIGHLIGHT_COLORS.findIndex((color) => color.value === currentColor));
    const frame = window.requestAnimationFrame(() => colorButtonRefs.current[selectedIndex]?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      if (previouslyFocused.current?.isConnected) previouslyFocused.current.focus();
    };
  }, [currentColor]);

  useHotkey((e) => e.key === 'Escape', onClose);

  const handleColorKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % HIGHLIGHT_COLORS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + HIGHLIGHT_COLORS.length) % HIGHLIGHT_COLORS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = HIGHLIGHT_COLORS.length - 1;
    } else if (event.key === 'Tab') {
      nextIndex = event.shiftKey
        ? (index - 1 + HIGHLIGHT_COLORS.length) % HIGHLIGHT_COLORS.length
        : (index + 1) % HIGHLIGHT_COLORS.length;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      colorButtonRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close color picker"
        tabIndex={-1}
        style={colorPickerStyles.backdrop}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="highlight-color-title"
        style={colorPickerStyles.panel(viewportInfo, computedAnchorRect, isMobile)}
      >
        <div style={colorPickerStyles.header}>
          <span id="highlight-color-title" style={colorPickerStyles.title}>Highlight color</span>
          <span style={colorPickerStyles.hint}>Choose a color</span>
        </div>
        <div role="radiogroup" aria-label="Highlight colors" style={colorPickerStyles.colorGrid}>
          {HIGHLIGHT_COLORS.map((color, index) => {
            const isSelected = currentColor === color.value;
            return (
              <button
                ref={(element) => { colorButtonRefs.current[index] = element; }}
                key={color.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected || (!currentColor && index === 0) ? 0 : -1}
                onClick={() => onColorSelect(color.value)}
                onKeyDown={(event) => handleColorKeyDown(event, index)}
                onPointerEnter={() => setActiveColor(color.value)}
                onPointerLeave={() => setActiveColor(null)}
                onFocus={() => setActiveColor(color.value)}
                onBlur={() => setActiveColor(null)}
                title={`${color.name} highlight`}
                style={colorPickerStyles.colorButton(color.value, isSelected, activeColor === color.value, isMobile)}
                aria-label={`${color.name}${isSelected ? ', selected' : ''}`}
              >
                {isSelected && <span style={colorPickerStyles.checkmark} aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
