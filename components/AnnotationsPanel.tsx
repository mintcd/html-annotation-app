"use client";

import React, { useMemo, useRef, useState, useCallback, useEffect, RefObject, PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnnotationContext } from "./Annotator.context";
import { useMobile, useHotkey, useClickOutside } from "../hooks";
import AnnotationList from "./AnnotationList";
import PageNoteEditor from "./PageNoteEditor";
import { BoxList, DarkMode, LightMode, Sort, PasteHtml, ReadingMode, Refresh, Times } from "../app/icons";
import { Badge } from "./design-system/badge";
import { IconButton } from "./design-system/icon-button";
import Dropdown from "./Dropdown";
import styles from "./styles/AnnotationsPanel.styles";

type SortOption = 'created-asc' | 'created-desc' | 'modified-asc' | 'modified-desc' | 'dom-order';

const sortOptions = [
  { value: 'dom-order' as SortOption, label: 'Page Order' },
  { value: 'created-desc' as SortOption, label: 'Newest First' },
  { value: 'created-asc' as SortOption, label: 'Oldest First' },
  { value: 'modified-desc' as SortOption, label: 'Recently Modified' },
  { value: 'modified-asc' as SortOption, label: 'Least Recently Modified' },
];

type SidebarProps = {
  onPasteHtml?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function AnnotationsPanel({
  onPasteHtml,
  open: controlledOpen,
  onOpenChange,
}: SidebarProps) {
  const { annotations, pageNote, updatePageNote, syncStatus, session, pageUrl, title } = useAnnotationContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('dom-order');
  const items = useMemo(() => {
    if (sortOption === 'dom-order') return annotations;

    const timestamp = (annotation: Annotation, field: 'created_at' | 'updated_at') => {
      const parsed = Date.parse(annotation[field] || '');
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const sorted = [...annotations];
    switch (sortOption) {
      case 'created-asc':
        return sorted.sort((left, right) => timestamp(left, 'created_at') - timestamp(right, 'created_at'));
      case 'created-desc':
        return sorted.sort((left, right) => timestamp(right, 'created_at') - timestamp(left, 'created_at'));
      case 'modified-asc':
        return sorted.sort((left, right) => timestamp(left, 'updated_at') - timestamp(right, 'updated_at'));
      case 'modified-desc':
        return sorted.sort((left, right) => timestamp(right, 'updated_at') - timestamp(left, 'updated_at'));
      default:
        return sorted;
    }
  }, [annotations, sortOption]);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Mobile detection and viewport tracking
  const { isMobile, isIOS, viewportInfo } = useMobile();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setPanelOpen = useCallback((nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [controlledOpen, onOpenChange]);
  const showToggleButton = !open;

  const pageIdentity = useMemo(() => {
    if (!pageUrl) {
      return { heading: title || 'Annotated page', detail: 'Current page' };
    }
    try {
      const url = new URL(pageUrl);
      const hostname = url.hostname.replace(/^www\./, '');
      return {
        heading: title || hostname,
        detail: `${hostname}${url.pathname === '/' ? '' : url.pathname}`,
      };
    } catch {
      return { heading: title || 'Annotated page', detail: pageUrl };
    }
  }, [pageUrl, title]);

  const scrollToAnnotation = useCallback((id: string) => {
    if (isMobile) setPanelOpen(false);
    session.scrollToHighlight(id);
  }, [isMobile, session, setPanelOpen]);

  // Resizing functionality
  const handleRef = useRef<HTMLDivElement>(null);
  const { width, onPointerDown, setWidth } = useResizablePanelWidth({
    initialWidth: 320,
    minWidth: 240,
    maxWidth: 560,
    storageKey: "anno.sidebar.width",
    disabled: isMobile,
    elementRef: handleRef as React.RefObject<HTMLElement>,
  });

  useHotkey((e) => (e.altKey || e.metaKey) && e.key.toLowerCase() === "s",
    () => setPanelOpen(!open));

  useClickOutside(sidebarRef as React.RefObject<HTMLElement>, () => {
    if (open) setPanelOpen(false);
  });

  // Close the sidebar when focus moves into the iframe (user clicks on page content).
  // This replaces the formerly broken "click-outside" path for iframe-hosted content
  // since pointer events inside the iframe don't bubble to the parent document.
  useEffect(() => {
    if (!open) return;
    const handleBlur = () => {
      window.setTimeout(() => {
        if (document.activeElement === session.frame) setPanelOpen(false);
      }, 0);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [open, session.frame, setPanelOpen]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setPanelOpen]);

  // Memoize sidebar positioning for mobile
  const sidebarMobileStyle = {
    height: viewportInfo.visualHeight * 0.6,
    width: viewportInfo.visualWidth,
    bottom: viewportInfo.layoutHeight - viewportInfo.offsetTop - viewportInfo.visualHeight,
    left: viewportInfo.offsetLeft,
  };

  const refreshResources = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await session.reloadFrame();
    } catch (error) {
      console.error('Refresh failed', error);
      const detail = error instanceof Error ? error.message : 'Unknown error';
      alert(`Refresh did not complete. The most recently saved copy is still available.\n\n${detail}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [session]);

  const syncLabel = syncStatus === 'syncing'
    ? 'Syncing'
    : syncStatus === 'synced'
      ? 'Synced'
      : 'Changes pending';
  const syncTone = syncStatus === 'synced'
    ? 'success'
    : syncStatus === 'syncing'
      ? 'blue'
      : 'warning';

  return (
    <>
      <AnimatePresence>
        {showToggleButton && (
          <motion.button
            type="button"
            onClick={() => setPanelOpen(true)}
            style={styles.toggleButton(isMobile, isIOS, viewportInfo)}
            initial={{ opacity: 0, scale: 0.86, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            aria-label={`Open annotations panel. ${annotations.length} annotations.`}
            title="Annotations (Alt/⌘ + S)"
            data-theme={session.darkMode ? 'dark' : undefined}
          >
            <BoxList size={22} />
            {annotations.length > 0 && (
              <span style={styles.toggleCount}>{annotations.length}</span>
            )}
          </motion.button>
        )}

        {isMobile && open && (
          <motion.button
            key="annotation-sidebar-backdrop"
            type="button"
            style={styles.mobileBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPanelOpen(false)}
            aria-label="Close annotations panel"
          />
        )}

        {open && (
          <motion.div
            key="annotation-sidebar"
            ref={sidebarRef}
            role={isMobile ? "dialog" : "complementary"}
            aria-modal={isMobile || undefined}
            aria-label="Annotations panel"
            data-theme={session.darkMode ? 'dark' : undefined}
            style={{
              ...styles.sidebarContainer(isMobile, viewportInfo, width),
              ...(isMobile ? sidebarMobileStyle : {}),
            }}
            initial={isMobile ? { y: '100%', opacity: 0.7 } : { x: '100%', opacity: 0.7 }}
            animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
            exit={isMobile ? { y: '100%', opacity: 0.7 } : { x: '100%', opacity: 0.7 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
          >
            {isMobile && <span style={styles.mobileGrabber} aria-hidden="true" />}
            <div style={styles.headerSection}>
              <div style={styles.pageIdentity}>
                <span style={styles.brandMark} aria-hidden="true">
                  <BoxList size={18} />
                </span>
                <span style={styles.pageIdentityText}>
                  <span style={styles.pageTitle}>{pageIdentity.heading}</span>
                  <span style={styles.pageDetail} title={pageUrl}>{pageIdentity.detail}</span>
                </span>
              </div>
              <IconButton
                label="Close annotations panel"
                title="Close panel"
                size="small"
                onClick={() => setPanelOpen(false)}
              >
                <Times size={13} />
              </IconButton>
            </div>

            <div style={styles.toolbarSection}>
              <div style={styles.statsContainer}>
                <Badge tone="neutral" size="small">
                  {annotations.length} highlight{annotations.length === 1 ? '' : 's'}
                </Badge>
                <Dropdown
                  options={sortOptions}
                  value={sortOption}
                  onChange={setSortOption}
                  buttonContent={<Sort />}
                  ariaLabel="Sort annotations"
                />
              </div>

              <div style={styles.toolbarActions}>
                <Badge tone={syncTone} size="small" dot>{syncLabel}</Badge>
                <IconButton
                  label={session.darkMode ? 'Turn off dark mode' : 'Turn on dark mode'}
                  title={session.darkMode ? 'Turn off dark mode' : 'Turn on dark mode'}
                  size="small"
                  tone={session.darkMode ? 'primary' : 'neutral'}
                  aria-pressed={session.darkMode}
                  disabled={!session.document || !session.root}
                  onClick={() => session.setDarkMode(!session.darkMode)}
                >
                  {session.darkMode ? <LightMode size={13} /> : <DarkMode size={13} />}
                </IconButton>
                <IconButton
                  label={session.readingMode ? 'Turn off reading mode' : 'Turn on reading mode'}
                  title={session.readingMode ? 'Turn off reading mode' : 'Turn on reading mode'}
                  size="small"
                  tone={session.readingMode ? 'primary' : 'neutral'}
                  aria-pressed={session.readingMode}
                  disabled={!session.document || !session.root}
                  onClick={() => session.setReadingMode(!session.readingMode)}
                >
                  <ReadingMode size={13} />
                </IconButton>
                {onPasteHtml && (
                  <IconButton
                    label="Paste page HTML"
                    title="Paste HTML when page content is blocked"
                    size="small"
                    onClick={onPasteHtml}
                  >
                    <PasteHtml size={13} />
                  </IconButton>
                )}
                <IconButton
                  label={isRefreshing ? 'Refreshing saved page' : 'Refresh saved page'}
                  title="Fetch and save the latest page"
                  size="small"
                  disabled={isRefreshing}
                  onClick={() => void refreshResources()}
                >
                  <motion.span
                    style={styles.refreshIcon}
                    animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
                    transition={isRefreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : undefined}
                  >
                    <Refresh size={14} />
                  </motion.span>
                </IconButton>
              </div>
            </div>

            {isMobile || !onPointerDown ? null : (
              <div
                ref={handleRef}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize annotations panel"
                aria-valuemin={240}
                aria-valuemax={560}
                aria-valuenow={width}
                tabIndex={0}
                onPointerDown={onPointerDown}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    setWidth?.(width + 16);
                  } else if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    setWidth?.(width - 16);
                  }
                }}
                style={styles.resizeHandle}
                title="Drag to resize annotations panel"
              >
                <span style={styles.resizeHandleGrip} />
              </div>
            )}

            <PageNoteEditor
              mode="compact"
              note={pageNote}
              onSave={updatePageNote}
            />

            <AnnotationList
              scrollToAnnotation={scrollToAnnotation}
              mode="compact"
              annotations={items}
            />

            {!isMobile && (
              <div style={styles.footerHint}>
                <span>Select a highlight to locate it on the page</span>
                <kbd style={styles.shortcut}>Alt/⌘ S</kbd>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};



type UseResizeConfig = {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  disabled?: boolean;
  elementRef?: RefObject<HTMLElement>;
};

type UseResizeReturn = {
  width: number;
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  // Expose setter for programmatic width changes
  setWidth?: (w: number) => void;
};

function getInitialWidth(
  initialWidth: number,
  minWidth: number,
  maxWidth: number,
  storageKey?: string,
) {
  if (!storageKey || typeof window === 'undefined') return initialWidth;

  try {
    const savedWidth = window.localStorage.getItem(storageKey);
    if (!savedWidth) return initialWidth;

    const parsed = Number.parseInt(savedWidth, 10);
    return Number.isFinite(parsed) && parsed >= minWidth && parsed <= maxWidth
      ? parsed
      : initialWidth;
  } catch {
    return initialWidth;
  }
}

export function useResizablePanelWidth({
  initialWidth = 320,
  minWidth = 240,
  maxWidth = 560,
  storageKey,
  disabled = false,
  elementRef,
}: UseResizeConfig = {}): UseResizeReturn {
  const [width, setWidthState] = useState<number>(() => (
    getInitialWidth(initialWidth, minWidth, maxWidth, storageKey)
  ));

  // Refs for drag state
  const dragging = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const startW = useRef<number>(0);

  // Save width to localStorage when it changes
  useEffect(() => {
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      // Ignore localStorage errors
    }
  }, [width, storageKey]);

  // Attach pointer event listeners to the element if ref provided
  useEffect(() => {
    if (!elementRef?.current || disabled) return;

    const element = elementRef.current;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;

      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture may throw in some environments; continue and fall back to window listeners
      }

      // Attach global listeners so dragging continues even if the pointer leaves the small handle
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;

      // Calculate drag delta (dragging left increases width for right-side sidebar)
      const dx = startX.current - e.clientX;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, startW.current + dx));

      if (nextWidth !== width) {
        setWidthState(nextWidth);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragging.current) return;

      dragging.current = false;

      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      // Cleanup global listeners
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    element.addEventListener('pointerdown', handlePointerDown);

    // Keep a cleanup that removes both the element listener and any global listeners
    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [elementRef, disabled, width, minWidth, maxWidth]);

  // Wrapper for setWidth to ensure bounds
  const setWidth = useCallback((newWidth: number) => {
    const constrainedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
    setWidthState(constrainedWidth);
  }, [minWidth, maxWidth]);

  // Pointer event handlers
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;

      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;

      const target = e.currentTarget as HTMLDivElement;
      const pointerId = e.pointerId;

      try {
        target.setPointerCapture(pointerId);
      } catch {
        // ignore
      }

      // Move handler for window events
      const handleMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const dx = startX.current - ev.clientX;
        const nextWidth = Math.min(maxWidth, Math.max(minWidth, startW.current + dx));
        if (nextWidth !== width) setWidthState(nextWidth);
      };

      // Up handler for window events
      const handleUp = (ev: PointerEvent) => {
        if (!dragging.current) return;
        dragging.current = false;
        try {
          target.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [disabled, width, minWidth, maxWidth]
  );

  return {
    width,
    onPointerDown,
    setWidth,
  };
}
