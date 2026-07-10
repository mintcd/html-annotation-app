"use client";

import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import styles from "./AnnotatorOverlay.module.css";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableElements(scope: HTMLElement): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

export type OverlayFocusScopeProps = HTMLAttributes<HTMLDivElement> & {
  active?: boolean;
  autoFocus?: boolean;
  contain?: boolean;
  restoreFocus?: boolean;
};

/** Focus containment and restoration for modal content rendered in OverlayRoot. */
export function OverlayFocusScope({
  active = true,
  autoFocus = true,
  contain = true,
  restoreFocus = true,
  className,
  children,
  onKeyDown,
  tabIndex,
  ...props
}: OverlayFocusScopeProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    let animationFrame = 0;
    if (autoFocus) {
      animationFrame = window.requestAnimationFrame(() => {
        const scope = scopeRef.current;
        if (!scope || scope.contains(document.activeElement)) return;
        (focusableElements(scope)[0] ?? scope).focus({ preventScroll: true });
      });
    }

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      const previouslyFocused = previouslyFocusedRef.current;
      if (restoreFocus && previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
      previouslyFocusedRef.current = null;
    };
  }, [active, autoFocus, restoreFocus]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!active || !contain || event.defaultPrevented || event.key !== "Tab") return;

    const scope = scopeRef.current;
    if (!scope) return;
    const focusable = focusableElements(scope);
    if (focusable.length === 0) {
      event.preventDefault();
      scope.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && (activeElement === first || !scope.contains(activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      {...props}
      ref={scopeRef}
      className={[styles.focusScope, className].filter(Boolean).join(" ")}
      tabIndex={tabIndex ?? -1}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

