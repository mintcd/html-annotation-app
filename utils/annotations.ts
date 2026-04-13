import { listPages, getAnnotationsForPage, updateAnnotation } from './api.client';
import { getRange, highlightRange } from './dom';

export async function highlightAnnotations(annotations: Annotation[], container: HTMLElement) {
  // Compute ranges for all annotations first (no DOM mutations yet).
  const prepared: Array<{
    ann: Annotation;
    range: Range;
    usedPosition: boolean;
    resolvedPosition?: { startPosition: number; endPosition: number; startOffset: number; endOffset: number };
  }> = [];

  for (const ann of annotations) {
    try {
      const result = getRange(container, ann.text, ann.position);
      prepared.push({ ann, range: result.range, usedPosition: result.usedPosition, resolvedPosition: result.resolvedPosition });
    } catch (e) {
      console.warn('Failed to match annotation:', ann.id, e);
    }
  }

  // Persist any resolved positions before we mutate the DOM (so offsets stay valid).
  await Promise.all(prepared.map(async (p) => {
    if (!p.usedPosition && p.resolvedPosition) {
      try {
        console.log(`Persisting resolved position for annotation ${p.ann.id}`, p.resolvedPosition);
        await updateAnnotation(p.ann.id, { position: p.resolvedPosition });
      } catch (e) {
        console.error('Failed to persist annotation position:', e);
      }
    }
  }));

  // Highlight from the end of the document backwards so earlier mutations
  // don't shift the positions of later ranges.
  prepared.sort((a, b) => -a.range.compareBoundaryPoints(Range.START_TO_START, b.range));

  for (const p of prepared) {
    try {
      highlightRange(p.range, p.ann.color || '#ffff00', p.ann.id);
    } catch (e) {
      console.warn('Failed to highlight annotation:', p.ann.id, e);
    }
  }
}

export type SortOption = 'created-asc' | 'created-desc' | 'modified-asc' | 'modified-desc' | 'dom-order';

export function sortAnnotations(annotations: Annotation[], sortOption: SortOption): Annotation[] {
  switch (sortOption) {

    // case 'created-asc':
    //   return [...annotations].sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
    // case 'created-desc':
    //   return [...annotations].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
    // case 'modified-asc':
    //   return [...annotations].sort((a, b) => (a.updated_at ?? 0) - (b.updated_at ?? 0));
    // case 'modified-desc':
    //   return [...annotations].sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
    // case 'dom-order':
    default:
      return annotations
    // Query DOM for order
    // const spans = document.querySelectorAll<HTMLSpanElement>('span.highlighted-text[data-highlight-id]');
    // const orderMap = new Map<string, number>();
    // spans.forEach((span, index) => {
    //   const id = span.getAttribute('data-highlight-id');
    //   if (id) orderMap.set(id, index);
    // });
    // return [...annotations].sort((a, b) => {
    //   const aOrder = orderMap.get(a.id) ?? Infinity;
    //   const bOrder = orderMap.get(b.id) ?? Infinity;
    //   return aOrder - bOrder;
    // });
  }
}

export const sortOptions = [
  { value: 'dom-order' as SortOption, label: 'Page Order' },
  { value: 'created-desc' as SortOption, label: 'Newest First' },
  { value: 'created-asc' as SortOption, label: 'Oldest First' },
  { value: 'modified-desc' as SortOption, label: 'Recently Modified' },
  { value: 'modified-asc' as SortOption, label: 'Least Recently Modified' },
];

export type AnnotationPage = {
  url: string;
  filename: string;
  timestamp: string;
  title?: string;
  count: number;
  annotations: Annotation[];
  blobUrl: string;
  uploadedAt: string;
}

export async function loadAnnotations(): Promise<AnnotationPage[]> {
  try {
    const pages = await listPages();
    const annotationPages = await Promise.all(
      pages.map(async (page: Page) => {
        const annotations = await getAnnotationsForPage(page.url);
        return {
          url: page.url,
          filename: `${page.id}.json`,
          timestamp: page.created_at,
          title: page.title,
          count: page.number_of_annotations,
          annotations: annotations,
          blobUrl: '',
          uploadedAt: page.updated_at,
        } satisfies AnnotationPage;
      })
    );
    console.log(`Fetched ${annotationPages.length} pages`);
    return annotationPages;
  } catch (error) {
    console.error('[Dashboard] Error fetching annotations:', error);
    return [];
  }
}

export async function loadAnnotationsForPage(pageUrl: string): Promise<Annotation[]> {
  try {
    const annotations = await getAnnotationsForPage(pageUrl);
    console.log(`Loaded ${annotations.length} annotations for ${pageUrl}`);
    return annotations;
  } catch (error) {
    console.error('Error loading annotations:', error);
    return [];
  }
}

