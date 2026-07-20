import {
  INVISIBLE_TEXT_RE,
  createTextAnchorModel,
  findOccurrences,
  findTextAnchorMatch,
  normalizeAnchorText,
  textAnchorsEqual,
} from '../model/index.ts';
import { sanitizeAnnotationHtml } from './sanitizeHtml.ts';

export {
  findTextAnchorMatch,
  normalizeAnchorText,
} from '../model/index.ts';


export function convertRangeToHtml(range: Range): string {
  const clonedRange = range.cloneRange();
  const fragment = clonedRange.cloneContents();
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(fragment);

  return tempDiv.innerHTML;
}

/**
 * Find the deepest element under `root` such that no single direct child
 * accounts for more than `threshold` fraction of the element's text.
 * This is useful to locate a content node that is not merely a wrapper
 * composed mostly of a single child block.
 */
export function findBestContentNode(root: HTMLElement, threshold: number = 0.8, minTotal: number = 20): HTMLElement {

  function nodeTextLen(n: Node | null): number {
    if (!n) return 0;
    const t = n.textContent || '';
    return t.trim().length;
  }

  let current: HTMLElement = root;

  while (true) {
    const currentTextLen = nodeTextLen(current);
    if (currentTextLen < minTotal) return current;

    // Look through all children to find one that accounts for >threshold of parent's text
    let dominantChild: HTMLElement | null = null;
    for (const child of Array.from(current.children)) {
      const childTextLen = nodeTextLen(child);
      if (currentTextLen > 0 && (childTextLen / currentTextLen) > threshold) {
        dominantChild = child as HTMLElement;
        break;
      }
    }

    // If no child dominates, this is our optimal node
    if (!dominantChild) {
      return current;
    }

    // Otherwise, descend into the dominant child
    current = dominantChild;
  }
}

/**
 * Clean HTML content by removing unnecessary elements, normalizing whitespace, and preserving math sources.
 * This function is particularly useful for preparing HTML content for annotation or storage.
 *
 * @param html The HTML string to be cleaned.
 * @returns An object containing the cleaned HTML and any collected math sources.
 */
export function cleanHtml(html: string): { html: string; mathSource?: string } {
  if (!html.trim()) return { html: '' };

  // Parse the HTML string into a DOM element
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const clone = tempDiv.cloneNode(true) as HTMLElement;

  // Annotation wrappers are presentation-only and must never leak into saved
  // excerpts (notably when an existing highlight is resized across another
  // highlight). Keep their contents and discard only annotator-owned markup.
  clone.querySelectorAll('span.highlighted-text[data-highlight-id]').forEach((span) => {
    span.replaceWith(...Array.from(span.childNodes));
  });

  // Remove only the noisy/assistive MathJax elements that interfere with
  // saving/re-processing. Preserve core rendered output (e.g. .MathJax,
  // .katex) and <math> nodes so the Dashboard can display already-rendered
  // math or re-run the renderer when needed.
  const toRemoveSelectors = [
    '.MathJax_Preview',
    '.MJX_Assistive_MathML',
    'mjx-assistive-mml'
  ];
  toRemoveSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Collect math sources from various places
  const mathSources: string[] = [];

  // For script[type="math/tex"], remove MathJax-assigned ids to allow re-processing
  // Replace script[type="math/..."] with placeholder spans and remember
  // the wrapped math text (e.g. $...$ or $$...$$). We'll later inject the
  // math text back after whitespace normalization so KaTeX can find it.
  const mathMap: string[] = [];
  Array.from(clone.querySelectorAll('script[type^="math/"]')).forEach((script, idx) => {
    try {
      // remove MathJax-assigned ids
      script.removeAttribute('id');
      const raw = (script.textContent || '').trim();
      if (!raw) {
        // empty script: just remove
        script.remove();
        return;
      }

      // Collect raw math source
      mathSources.push(raw);

      const typeAttr = (script.getAttribute('type') || '').toLowerCase();
      let isDisplay = /mode\s*=\s*display/.test(typeAttr) || /^\\\[/.test(raw) || /^\$\$/.test(raw);

      // Check if the corresponding MathJax element has display class
      if (!isDisplay) {
        const scriptId = script.getAttribute('id');
        if (scriptId) {
          const mathJaxElement = clone.querySelector(`[id="${scriptId}-Frame"]`);
          if (mathJaxElement && mathJaxElement.classList.contains('mjx-display')) {
            isDisplay = true;
          }
        }
      }

      const wrapped = isDisplay ? `$$ ${raw} $$` : `$ ${raw} $`;
      mathMap.push(wrapped);

      const placeholder = document.createElement('span');
      placeholder.setAttribute('data-math-placeholder', String(mathMap.length - 1));
      // insert placeholder where script was
      script.parentNode?.replaceChild(placeholder, script);
    } catch (e) {
      try { script.remove(); } catch (_e) { }
    }
  });

  // Extract math source from MathML <annotation> elements
  Array.from(clone.querySelectorAll('annotation')).forEach(ann => {
    const content = (ann.textContent || '').trim();
    if (content) mathSources.push(content);
  });

  // Extract math source from data-mathml attributes
  Array.from(clone.querySelectorAll('[data-mathml]')).forEach(el => {
    const mathml = (el.getAttribute('data-mathml') || '').trim();
    if (mathml) mathSources.push(mathml);
  });

  // If the fragment contains math script placeholders (we replaced scripts
  // above) or MathML, remove any already-rendered MathJax/KaTeX output to
  // avoid duplicated visuals when the Dashboard runs MathJax.
  const hasMathScript = clone.querySelector('[data-math-placeholder]');
  const hasMathML = clone.querySelector('math');
  const hasRenderedMath = clone.querySelector('[class*="MathJax"], [class*="mjx-"], .katex, [data-mathml]');
  if (hasMathScript || hasMathML || hasRenderedMath) {
    // Remove rendered output nodes that would duplicate script-driven rendering
    clone.querySelectorAll('[class*="MathJax"], [class*="mjx-"], .katex, .katex-display, span.math, [data-mathml], [id^="MathJax-"]').forEach(el => el.remove());
  }

  // Remove event handler attributes for safety
  const allElements = clone.querySelectorAll('*');
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on') ||
        attr.name === 'javascript:' ||
        attr.name === 'data-react' ||
        attr.name.startsWith('data-testid')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // Normalize whitespace in the HTML but preserve the math placeholders.
  const normalized = clone.innerHTML.replace(/\s+/g, ' ').trim();

  // Build a new DOM from the normalized HTML so we can replace placeholders
  // with actual text nodes (containing $...$ or $$...$$) safely.
  const finalDiv = document.createElement('div');
  finalDiv.innerHTML = normalized;

  // Replace placeholders with text nodes containing the wrapped math
  Array.from(finalDiv.querySelectorAll('[data-math-placeholder]')).forEach((ph) => {
    const id = ph.getAttribute('data-math-placeholder');
    if (!id) return;
    const idx = Number(id);
    const mathText = mathMap[idx];
    if (mathText == null) return;
    ph.parentNode?.replaceChild(document.createTextNode(mathText), ph);
  });

  // Return the finalized HTML string and math source
  // Note: we intentionally do not re-run a global whitespace collapse here so
  // the math text is preserved exactly as inserted above.
  const finalHtml = sanitizeAnnotationHtml(finalDiv.innerHTML.trim());
  const mathSource = mathSources.length > 0 ? mathSources.join('\n') : undefined;

  return { html: finalHtml, mathSource };
}

const EXCLUDED_TEXT_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  '[hidden]',
  '.MathJax_Preview',
  '.MJX_Assistive_MathML',
  'mjx-assistive-mml',
  '.katex-mathml',
].join(',');
const RENDERED_MATH_SELECTOR = '[data-mathml], .MathJax, .katex';

type IndexedCharacter = {
  char: string;
  startNode: Text;
  startOffset: number;
  endNode: Text;
  endOffset: number;
};

export type TextIndex = {
  root: HTMLElement;
  text: string;
  characters: IndexedCharacter[];
  compactText: string;
  compactCharacters: IndexedCharacter[];
};

function getGraphemeSegments(value: string): Array<{ segment: string; index: number }> {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), ({ segment, index }) => ({ segment, index }));
  }

  const segments: Array<{ segment: string; index: number }> = [];
  let index = 0;
  for (const segment of value) {
    segments.push({ segment, index });
    index += segment.length;
  }
  return segments;
}

function isIndexableTextNode(node: Text, root: HTMLElement, visibility: WeakMap<Element, boolean>): boolean {
  if (!node.nodeValue) return false;

  // MathJax and KaTeX mark their visual output aria-hidden because a second,
  // assistive representation is provided to screen readers. Index the visual
  // tree once and continue to exclude the assistive tree above. Otherwise a
  // formula either disappears from the anchor or is counted multiple times.
  const renderedMath = node.parentElement?.closest(RENDERED_MATH_SELECTOR);
  const isRenderedMath = Boolean(renderedMath && root.contains(renderedMath));

  for (let element = node.parentElement; element; element = element.parentElement) {
    let visible = visibility.get(element);
    if (visible === undefined) {
      visible = !element.matches(EXCLUDED_TEXT_SELECTOR);
      const isMathRenderingElement = isRenderedMath && renderedMath?.contains(element);
      if (visible && element.matches('[aria-hidden="true"]') && !isMathRenderingElement) {
        visible = false;
      }
      if (visible) {
        const style = element.ownerDocument.defaultView?.getComputedStyle(element);
        visible = style?.display !== 'none'
          && style?.visibility !== 'hidden'
          && style?.visibility !== 'collapse';
      }
      visibility.set(element, visible);
    }
    if (!visible) return false;
    if (element === root) return true;
  }

  return false;
}

function buildTextIndex(
  root: HTMLElement,
  accepts: (node: Text) => boolean,
  emptyMessage: string,
): TextIndex {
  const characters: IndexedCharacter[] = [];
  const compactCharacters: IndexedCharacter[] = [];
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return accepts(node as Text)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    },
  );

  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const value = node.nodeValue ?? '';
    for (const { segment, index } of getGraphemeSegments(value)) {
      const normalized = segment.normalize('NFC').replace(INVISIBLE_TEXT_RE, '');
      const endOffset = index + segment.length;

      for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        const indexed: IndexedCharacter = {
          char,
          startNode: node,
          startOffset: index,
          endNode: node,
          endOffset,
        };

        if (/\s/u.test(char)) {
          const previous = characters[characters.length - 1];
          if (!previous) continue;
          if (previous.char === ' ') {
            previous.endNode = node;
            previous.endOffset = endOffset;
          } else {
            characters.push({ ...indexed, char: ' ' });
          }
        } else {
          characters.push(indexed);
          compactCharacters.push(indexed);
        }
      }
    }
  }

  if (characters[characters.length - 1]?.char === ' ') characters.pop();
  if (characters.length === 0) throw new Error(emptyMessage);

  return {
    root,
    text: characters.map(({ char }) => char).join(''),
    characters,
    compactText: compactCharacters.map(({ char }) => char).join(''),
    compactCharacters,
  };
}

export function createTextIndex(root: HTMLElement): TextIndex {
  const visibility = new WeakMap<Element, boolean>();
  return buildTextIndex(
    root,
    (node) => isIndexableTextNode(node, root, visibility),
    'No visible text found in the document',
  );
}

function buildRangeFromIndexedCharacters(
  ownerDocument: Document,
  characters: IndexedCharacter[],
  start: number,
  end: number,
): Range | null {
  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end <= start
    || end > characters.length
  ) return null;

  const first = characters[start];
  const last = characters[end - 1];
  const range = ownerDocument.createRange();
  range.setStart(first.startNode, first.startOffset);
  range.setEnd(last.endNode, last.endOffset);
  return range;
}

function anchorAt(index: TextIndex, start: number, end: number): TextAnchor {
  return createTextAnchorModel(index.text, start, end);
}

export function createTextAnchor(
  root: HTMLElement,
  range: Range,
  index: TextIndex = createTextIndex(root),
): TextAnchor | null {
  const ownerDocument = root.ownerDocument;
  const startBoundary = range.cloneRange();
  const endBoundary = range.cloneRange();
  const point = ownerDocument.createRange();
  startBoundary.collapse(true);
  endBoundary.collapse(false);

  let start = -1;
  let end = -1;

  try {
    for (let i = 0; i < index.characters.length; i++) {
      const character = index.characters[i];
      point.setStart(character.endNode, character.endOffset);
      point.collapse(true);
      if (point.compareBoundaryPoints(Range.START_TO_START, startBoundary) <= 0) continue;

      point.setStart(character.startNode, character.startOffset);
      point.collapse(true);
      if (point.compareBoundaryPoints(Range.START_TO_START, endBoundary) >= 0) break;

      if (start === -1) start = i;
      end = i + 1;
    }
  } catch {
    return null;
  }

  if (start === -1 || end <= start) return null;
  return anchorAt(index, start, end);
}

export function getRange(
  root: HTMLElement,
  position: TextAnchor,
  index: TextIndex = createTextIndex(root),
): {
  range: Range;
  resolvedPosition?: TextAnchor;
} {
  const exact = normalizeAnchorText(position.exact);
  if (!exact) throw new Error('Annotation anchor must quote non-empty text');

  const start = findTextAnchorMatch(index.text, exact, position);
  if (start !== null) {
    const end = start + exact.length;
    const range = buildRangeFromIndexedCharacters(root.ownerDocument, index.characters, start, end);
    if (!range) throw new Error('Unable to reconstruct annotation range');
    const resolvedPosition = anchorAt(index, start, end);
    return {
      range,
      resolvedPosition: textAnchorsEqual(position, resolvedPosition)
        ? undefined
        : resolvedPosition,
    };
  }

  const occurrences = Math.max(
    findOccurrences(index.text, exact).length,
  );
  if (occurrences > 1) throw new Error(`Annotation text is ambiguous (${occurrences} matches)`);
  throw new Error(`${position.exact} not found in document`);
}

export function highlightRange(range: Range, color: string = "#ffff00", id?: string): string {
  if (!id) {
    id = Date.now().toString();
  }

  // Split boundaries so the selected parts become whole text nodes
  // Only split when the offset is strictly inside a text node. Splitting at
  // offset 0 or at node length creates empty text nodes which later lead to
  // empty highlighted spans.
  if (range.endContainer.nodeType === Node.TEXT_NODE) {
    const t = range.endContainer as Text;
    const tv = t.nodeValue || '';
    if (range.endOffset > 0 && range.endOffset < tv.length) {
      t.splitText(range.endOffset);
    }
  }
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const t = range.startContainer as Text;
    const tv = t.nodeValue || '';
    if (range.startOffset > 0 && range.startOffset < tv.length) {
      t.splitText(range.startOffset);
    }
  }
  // Build ordered wrap actions between the split boundaries. Each action is
  // either a group of consecutive sibling inline nodes to wrap, or a block
  // element that should have its inline children wrapped recursively.
  const actions = collectWrapActions(range);
  for (const a of actions) {
    if (a.type === 'wrap') {
      wrapNodes(a.nodes, color, id);
    } else {
      wrapInlineChildren(a.node, color, id);
    }
  }

  return id;
}

type WrapAction =
  | { type: 'wrap'; parent: Node; nodes: Node[] }
  | { type: 'block'; node: Node };

function collectWrapActions(range: Range): WrapAction[] {
  const actions: WrapAction[] = [];
  const start = range.startContainer;
  const end = range.endContainer;
  const root = range.commonAncestorContainer;
  if (!root) return actions;

  const doc = (root && root.ownerDocument) || document;

  const walker = doc.createTreeWalker(
    root as Node,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const s = (node as Text).nodeValue;
          if (!s || s.length === 0) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // Advance walker to the start node
  walker.currentNode = start;
  let n: Node | null = start;

  let inlineGroup: { parent: Node | null; nodes: Node[] } | null = null;

  function flushInline() {
    if (inlineGroup && inlineGroup.nodes.length > 0) {
      actions.push({ type: 'wrap', parent: inlineGroup.parent as Node, nodes: inlineGroup.nodes });
      inlineGroup = null;
    }
  }

  while (n) {
    // If this is a block element fully inside the range, handle it separately
    if (n.nodeType === Node.ELEMENT_NODE && isBlockElement(n) && nodeFullyContained(range, n)) {
      flushInline();
      actions.push({ type: 'block', node: n });
      // Skip the block's subtree
      const next = walker.nextSibling();
      n = next;
      if (!n) break;
      if (n === end) {
        // continue loop to process end
      }
      continue;
    }

    // If the node itself is fully contained and is an inline element or text,
    // group it by its direct parent (so wrappers are inserted in the correct
    // parent and we never attempt to wrap across different parents).
    if (nodeFullyContained(range, n)) {
      const parent = n.parentNode;
      if (parent) {
        if (!inlineGroup) {
          inlineGroup = { parent, nodes: [n] };
        } else {
          const last = inlineGroup.nodes[inlineGroup.nodes.length - 1] as Node;
          if (inlineGroup.parent === parent && last.nextSibling === n) {
            inlineGroup.nodes.push(n);
          } else {
            flushInline();
            inlineGroup = { parent, nodes: [n] };
          }
        }

        // If we included an element node, skip its descendants to avoid
        // double-including children.
        if (n.nodeType === Node.ELEMENT_NODE) {
          const next = walker.nextSibling();
          n = next;
          if (!n) break;
          if (n === end) {
            // continue loop to allow finalization
          }
          continue;
        }
      }
    }

    if (n === end) break;
    n = walker.nextNode();
  }

  flushInline();
  return actions;
}

function wrapInlineChildren(parent: Node, color: string, id: string) {
  if (parent.nodeType !== Node.ELEMENT_NODE) return;

  const children = Array.from(parent.childNodes);
  let i = 0;
  while (i < children.length) {
    if (isBlockElement(children[i])) {
      // Recursively wrap inline children of this block
      wrapInlineChildren(children[i], color, id);
      i++;
    } else {
      // Collect consecutive inline children
      const inlineGroup: Node[] = [];
      while (i < children.length && !isBlockElement(children[i])) {
        inlineGroup.push(children[i]);
        i++;
      }
      if (inlineGroup.length > 0) {
        wrapNodes(inlineGroup, color, id);
      }
    }
  }
}

function wrapNodes(nodes: Node[], color: string, id: string) {
  if (nodes.length === 0) return;

  const first = nodes[0];
  const parent = first.parentNode;
  if (!parent) return;

  const wrapper = (first.ownerDocument || document).createElement('span');
  wrapper.className = 'highlighted-text';
  wrapper.dataset.highlightId = id;
  wrapper.style.backgroundColor = color;
  wrapper.style.setProperty('--highlight-color', color);

  parent.insertBefore(wrapper, first);

  for (const node of nodes) {
    wrapper.appendChild(node);
  }
  // If the wrapper contains only whitespace text (no visible content),
  // unwrap it to avoid creating tiny empty highlighted spans between blocks.
  const text = (wrapper.textContent || '');
  if (text.trim().length === 0) {
    const hasElementChild = Array.from(wrapper.childNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
    if (!hasElementChild) {
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }
      parent.removeChild(wrapper);
    }
  }
}

function nodeFullyContained(rng: Range, node: Node): boolean {
  try {
    const nr = (node.ownerDocument || document).createRange();
    if (node.nodeType === Node.TEXT_NODE) {
      nr.selectNodeContents(node);
    } else {
      nr.selectNode(node);
    }
    // rng.start <= nr.start  AND rng.end >= nr.end
    return (
      rng.compareBoundaryPoints(Range.START_TO_START, nr) <= 0 &&
      rng.compareBoundaryPoints(Range.END_TO_END, nr) >= 0
    );
  } catch (e) {
    return false;
  }
}

function isBlockElement(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  // cheap fast-path for common blocks; you can expand this list
  if (['p', 'div', 'li', 'ul', 'ol', 'section', 'article', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return true;
  // fallback (in case of custom blocks)
  const display = getComputedStyle(el).display;
  return display === 'block' || display === 'list-item' || display === 'table' || display === 'flex' || display === 'grid';
}

export function removeHighlights(container: HTMLElement, id: string): void {
  // Find all highlight spans with this id inside the container
  const spans = container.querySelectorAll<HTMLSpanElement>(
    `span.highlighted-text[data-highlight-id="${id}"]`
  );

  const affectedParents = new Set<Node>();

  spans.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;

    affectedParents.add(parent);

    // Unwrap span → put back its contents (text nodes or elements)
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  });

  // Repeated resize/delete cycles otherwise leave a growing number of
  // adjacent text nodes. Normalizing once per affected parent keeps later
  // range lookup and caret movement inexpensive.
  affectedParents.forEach((parent) => parent.normalize());
}
