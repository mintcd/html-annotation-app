import { listPages, getAnnotationsForPage, updateAnnotation } from './api.client';
import { getRange, highlightRange } from './dom';

export async function highlightAnnotations(annotations: Annotation[], container: HTMLElement) {
  // Process sequentially to avoid DOM mutations from earlier highlights
  for (const ann of annotations) {
    try {
      const result = getRange(container, ann.text, ann.position);
      const range = result.range;
      highlightRange(range, ann.color || '#ffff00', ann.id);

      // If we fell back to full-text match and received a canonical position,
      // persist it to the server so future loads can use the fast position lookup.
      if (!result.usedPosition && result.resolvedPosition) {
        try {
          console.log(`Persisting resolved position for annotation ${ann.id}`, result.resolvedPosition);
          await updateAnnotation(ann.id, { position: result.resolvedPosition });
        } catch (e) {
          console.error('Failed to persist annotation position:', e);
        }
      }
    } catch (e) {
      console.warn('Failed to match annotation:', ann.id, e);
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

