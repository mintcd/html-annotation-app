export {
  cleanHtml,
  createTextAnchor,
  createTextIndex,
  findBestContentNode,
  getRange,
  highlightRange,
  convertRangeToHtml,
  removeHighlights,
  type TextIndex,
} from './dom.ts';

export {
  sanitizeAnnotationHref,
  sanitizeAnnotationHtml,
} from './sanitizeHtml.ts';

export {
  highlightBoundingRect,
  highlightEndPosition,
  highlightStartPosition,
} from './highlight.ts';
