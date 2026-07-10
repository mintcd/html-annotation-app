import { eq } from '@mintcd/sync-engine';
import { db } from './engine';
import { createTextIndex, getRange, highlightRange } from './dom';

export async function highlightAnnotations(annotations: Annotation[], container: HTMLElement) {
  if (annotations.length === 0) return;

  // Use one immutable DOM snapshot for the whole batch. Highlighting mutates
  // text nodes, so a cross-batch cache would retain stale node references.
  const textIndex = createTextIndex(container);

  // Compute ranges for all annotations first (no DOM mutations yet).
  const prepared: Array<{
    ann: Annotation;
    range: Range;
    usedPosition: boolean;
    resolvedPosition?: TextAnchor;
  }> = [];

  for (const ann of annotations) {
    try {
      const result = getRange(container, ann.text, ann.position, textIndex);
      prepared.push({ ann, range: result.range, usedPosition: result.usedPosition, resolvedPosition: result.resolvedPosition });
    } catch (e) {
      console.warn('Failed to match annotation:', ann.id, e);
    }
  }

  const anchorRepairs = prepared.filter(
    (item): item is typeof item & { resolvedPosition: TextAnchor } =>
      !item.usedPosition && item.resolvedPosition !== undefined,
  );

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

  // Anchor maintenance should not delay painting. Preserve updated_at so a
  // background relocation is not presented as a user edit. The repository
  // currently has no multi-row transaction API, so these writes are issued
  // together and handled independently.
  if (anchorRepairs.length > 0) {
    void Promise.all(anchorRepairs.map(async ({ ann, resolvedPosition }) => {
      try {
        await db.update({ position: resolvedPosition, updated_at: ann.updated_at })
          .from('annotations')
          .where(eq('id', ann.id))
          .execute();
      } catch (e) {
        console.error(`Failed to persist annotation anchor ${ann.id}:`, e);
      }
    }));
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

