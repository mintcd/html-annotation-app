"use client";

import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnnotationContext } from "../context/Annotator.context";
import { prefetchResourcesForUrl } from '@/utils/frameCache';
import { useMobile, useHotkey } from "../hooks";
import { useResize, useClickOutside } from "../hooks/Sidebar.hooks";
import AnnotationList from "./AnnotationList";
import { sortOptions } from "../utils/annotations";
import type { SortOption } from "../utils/annotations";
import { BoxList, Sort, PasteHtml, Refresh, Times } from "../app/icons";
import { Badge } from "../design-system/badge";
import { IconButton } from "../design-system/icon-button";
import Dropdown from "./Dropdown";
import { escapeAttrValue } from "../utils/string";
import styles from "../styles/Sidebar.styles";

type SidebarProps = {
  onPasteHTML?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function Sidebar({
  onPasteHTML,
  open: controlledOpen,
  onOpenChange,
}: SidebarProps) {
  const { annotations, syncStatus, contentRef, iframeRef, pageUrl, title, iframeUrl } = useAnnotationContext();
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
    const escaped = escapeAttrValue(id);
    if (isMobile) setPanelOpen(false);

    if (!contentRef?.current) return;

    try {
      const spans = contentRef.current.querySelectorAll<HTMLSpanElement>(`[data-highlight-id="${escaped}"]`);
      const span = spans[0] ?? null;
      if (span) span.scrollIntoView({ behavior: "instant", block: "center" });
    } catch (e) {
      // ignore
    }
  }, [isMobile, contentRef, setPanelOpen]);

  // Resizing functionality
  const handleRef = useRef<HTMLDivElement>(null);
  const { width, onPointerDown, setWidth } = useResize({
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
        if (document.activeElement === iframeRef.current) setPanelOpen(false);
      }, 0);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [iframeRef, open, setPanelOpen]);

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
      const target = iframeRef?.current?.src || iframeUrl || pageUrl || window.location.href;
      await prefetchResourcesForUrl(target);
    } catch (error) {
      console.error('Refresh failed', error);
      alert('Failed to refresh resources');
    } finally {
      setIsRefreshing(false);
    }
  }, [iframeRef, iframeUrl, pageUrl]);

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
                {onPasteHTML && (
                  <IconButton
                    label="Paste page HTML"
                    title="Paste HTML when page content is blocked"
                    size="small"
                    onClick={onPasteHTML}
                  >
                    <PasteHtml size={13} />
                  </IconButton>
                )}
                <IconButton
                  label={isRefreshing ? 'Refreshing page resources' : 'Refresh page resources'}
                  title="Refresh page resources"
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

