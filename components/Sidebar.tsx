"use client";

import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnnotationContext } from "../context/Annotator.context";
import { prefetchResourcesForUrl } from '@/utils/frameCache';
import { useMobile, useHotkey } from "../hooks";
import { useResize, useClickOutside, useMobileToggle, usePreventScroll } from "../hooks/Sidebar.hooks";
import AnnotationList from "./AnnotationList";
import { sortAnnotations, sortOptions } from "../utils/annotations";
import type { SortOption } from "../utils/annotations";
import { BoxList, Sort, PasteHtml, Refresh } from "../app/icons";
import Dropdown from "./Dropdown";
import { escapeAttrValue } from "../utils/string";
import styles from "../styles/Sidebar.styles";

export default function Sidebar({ onPasteHTML }: { onPasteHTML?: () => void }) {
  const { annotations, syncStatus, contentRef, iframeRef, pageUrl, title, iframeReady, iframeUrl } = useAnnotationContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('dom-order');
  const items = useMemo(() => sortAnnotations(annotations, sortOption), [annotations, sortOption]);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Mobile detection and viewport tracking
  const { isMobile, isIOS, viewportInfo } = useMobile();
  const [open, setOpen] = useState(false);
  const _showToggleButton = useMobileToggle(isMobile);
  // Always show the toggle button when the sidebar is closed so it can always be reopened.
  const showToggleButton = _showToggleButton || !open;

  const scrollToAnnotation = useCallback((id: string) => {
    const escaped = escapeAttrValue(id);
    if (isMobile) setOpen(false);

    if (!contentRef?.current) return;

    try {
      const spans = contentRef.current.querySelectorAll<HTMLSpanElement>(`[data-highlight-id="${escaped}"]`);
      const span = spans[0] ?? null;
      if (span) span.scrollIntoView({ behavior: "instant", block: "center" });
    } catch (e) {
      // ignore
    }
  }, [isMobile, contentRef]);

  // Resizing functionality
  const handleRef = useRef<HTMLDivElement>(null);
  const { width, onPointerDown } = useResize({
    initialWidth: 320,
    minWidth: 240,
    maxWidth: 560,
    storageKey: "anno.sidebar.width",
    disabled: isMobile,
    elementRef: handleRef as React.RefObject<HTMLElement>,
  });

  useHotkey((e) => (e.altKey || e.metaKey) && e.key.toLowerCase() === "s",
    () => setOpen((o: boolean) => !o));

  useClickOutside(sidebarRef as React.RefObject<HTMLElement>, () => setOpen(false));

  // Close the sidebar when focus moves into the iframe (user clicks on page content).
  // This replaces the formerly broken "click-outside" path for iframe-hosted content
  // since pointer events inside the iframe don't bubble to the parent document.
  useEffect(() => {
    if (!open) return;
    const handleBlur = () => setOpen(false);
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [open]);

  // Memoize sidebar positioning for mobile
  const sidebarMobileStyle = {
    height: viewportInfo.visualHeight * 0.6,
    width: viewportInfo.visualWidth,
    bottom: viewportInfo.layoutHeight - viewportInfo.offsetTop - viewportInfo.visualHeight,
    left: 0,
  }
  usePreventScroll(sidebarRef as React.RefObject<HTMLElement>, isMobile);

  return (
    <>
      <AnimatePresence>
        {showToggleButton && (
          <motion.div
            onClick={() => setOpen(true)}
            style={styles.toggleButton(isMobile, isIOS, viewportInfo)}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <BoxList size={50} />
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <div
          ref={sidebarRef}
          style={{ ...styles.sidebarContainer(isMobile, viewportInfo, width), ...(isMobile ? sidebarMobileStyle : {}) }}
        >
          <div style={styles.headerSection}>
            <span style={styles.statsContainer}>
              <span style={styles.statsText}>
                {annotations.length} total
                {items.length !== annotations.length ? <span> • {items.length} shown</span> : null}
              </span>
              <Dropdown
                options={sortOptions}
                value={sortOption}
                onChange={setSortOption}
                buttonContent={<Sort />}
                ariaLabel="Sort annotations"
              />
            </span>
            <span style={styles.syncContainer}>
              {syncStatus === 'syncing' ? (
                <span style={styles.syncingText}>Syncing...</span>
              ) : syncStatus === 'synced' ? (
                <span style={styles.syncedText}>Synced</span>
              ) : (
                <span style={styles.syncingText}>Unsaved changes</span>
              )}
              {onPasteHTML && (
                <button
                  onClick={onPasteHTML}
                  title="Paste HTML (use when page content is blocked)"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'inherit', opacity: 0.6, display: 'flex', alignItems: 'center' }}
                >
                  <PasteHtml size={14} />
                </button>
              )}
              <button
                onClick={async () => {
                  try {
                    setIsRefreshing(true);
                    const target = iframeRef?.current?.src || iframeUrl || pageUrl || window.location.href;
                    await prefetchResourcesForUrl(target);
                    try { console.log('[prefetch] refreshed resources for', target); } catch (e) { }
                  } catch (e) {
                    console.error('Refresh failed', e);
                    alert('Failed to refresh resources');
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                title="Refresh resources"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: 'inherit', opacity: 0.8, marginLeft: 8 }}
              >
                {isRefreshing ? <span style={{ fontSize: 12 }}>Refreshing…</span> : <Refresh size={16} />}
              </button>
            </span>
          </div>
          {isMobile || !onPointerDown ? null : (
            <div
              ref={handleRef}
              role="separator"
              aria-orientation="vertical"
              onPointerDown={onPointerDown}
              style={styles.resizeHandle}
              title="Drag to resize"
            />
          )}
          <AnnotationList scrollToAnnotation={scrollToAnnotation} mode="compact" />
        </div>
      )}
    </>
  );
};

