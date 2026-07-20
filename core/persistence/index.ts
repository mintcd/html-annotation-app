export {
  createAnnotationRow,
  deleteAnnotationRow,
  deleteHighlightColorRow,
  deletePageNoteRow,
  deletePageRow,
  ensurePage,
  ensureWebsiteAvailableForRoute,
  FALLBACK_HIGHLIGHT_COLOR,
  findPageNoteForPage,
  findPageById,
  findWebsiteByOrigin,
  getOrCreateWebsite,
  INITIAL_HIGHLIGHT_COLORS,
  normalizeHexColor,
  normalizeAnnotationRow,
  normalizeHighlightColorRow,
  normalizePageNoteRow,
  syncTimestamp,
  updateAnnotationRow,
  updatePageRow,
  updateWebsiteRow,
  upsertHighlightColorRow,
  upsertPageNoteRow,
} from './syncData';

export {
  getCurrentSyncRuntime,
  SyncEngineProvider,
  useSyncRows,
  useSyncRuntime,
  useSyncStatus,
  type AppSyncRuntime,
} from './syncRuntime';

export {
  useHighlightColors,
} from './useHighlightColors';
