import { createTextIndex, getRange, highlightRange } from '../dom';
import { updateAnnotationRow, type AppSyncRuntime } from '../../persistence';

export type AnnotationHighlightFailure = {
  annotation: Annotation;
  error: unknown;
};

export type AnnotationHighlightResult = {
  matched: Annotation[];
  failed: AnnotationHighlightFailure[];
};

type ApplyAnnotationHighlightOptions = {
  logFailures?: boolean;
};

export async function applyAnnotationHighlights(
  annotations: Annotation[],
  root: HTMLElement,
  runtime?: AppSyncRuntime,
  options: ApplyAnnotationHighlightOptions = {},
): Promise<AnnotationHighlightResult> {
  if (annotations.length === 0) return { matched: [], failed: [] };
  const logFailures = options.logFailures ?? true;

  // Use one immutable DOM snapshot for the whole batch. Highlighting mutates
  // text nodes, so a cross-batch cache would retain stale node references.
  let textIndex: ReturnType<typeof createTextIndex>;
  try {
    textIndex = createTextIndex(root);
  } catch (error) {
    if (logFailures) {
      annotations.forEach((ann) => {
        console.warn('Failed to match annotation:', ann.id, error);
      });
    }
    return {
      matched: [],
      failed: annotations.map((annotation) => ({ annotation, error })),
    };
  }

  const prepared: Array<{
    ann: Annotation;
    range: Range;
    usedPosition: boolean;
    resolvedPosition?: TextAnchor;
  }> = [];
  const failed: AnnotationHighlightFailure[] = [];

  for (const ann of annotations) {
    try {
      const result = getRange(root, ann.text, ann.position, textIndex);
      prepared.push({ ann, range: result.range, usedPosition: result.usedPosition, resolvedPosition: result.resolvedPosition });
    } catch (error) {
      if (logFailures) console.warn('Failed to match annotation:', ann.id, error);
      failed.push({ annotation: ann, error });
    }
  }

  prepared.sort((a, b) => -a.range.compareBoundaryPoints(Range.START_TO_START, b.range));

  const highlighted: typeof prepared = [];
  for (const p of prepared) {
    try {
      highlightRange(p.range, p.ann.color || '#ffff00', p.ann.id);
      highlighted.push(p);
    } catch (error) {
      if (logFailures) console.warn('Failed to highlight annotation:', p.ann.id, error);
      failed.push({ annotation: p.ann, error });
    }
  }

  const anchorRepairs = highlighted.filter(
    (item): item is typeof item & { resolvedPosition: TextAnchor } =>
      !item.usedPosition && item.resolvedPosition !== undefined,
  );

  if (anchorRepairs.length > 0) {
    void (async () => {
      let repaired = false;

      for (const { ann, resolvedPosition } of anchorRepairs) {
        try {
          const updated = await updateAnnotationRow(ann.id, {
            position: resolvedPosition,
            updated_at: ann.updated_at,
          }, runtime, { flush: 'none' });
          repaired ||= updated !== undefined;
        } catch (e) {
          console.error(`Failed to persist annotation anchor ${ann.id}:`, e);
        }
      }

      if (repaired && runtime) {
        try {
          await runtime.sync();
        } catch (e) {
          console.error('Failed to flush repaired annotation anchors:', e);
        }
      }
    })();
  }

  return {
    matched: highlighted.map(({ ann }) => ann),
    failed,
  };
}
