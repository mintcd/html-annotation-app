import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findTextAnchorMatch,
  normalizeAnchorText,
} from '../core/annotation/model/index.ts';
import {
  createTextIndex,
  getRange,
} from '../core/annotation/dom/index.ts';

class FakeText {
  parentElement: FakeElement;
  ownerDocument: FakeDocument;
  nodeValue: string;

  constructor(nodeValue: string, parent: FakeElement) {
    this.nodeValue = nodeValue;
    this.parentElement = parent;
    this.ownerDocument = parent.ownerDocument;
  }
}

class FakeElement {
  parentElement: FakeElement | null = null;
  children: Array<FakeElement | FakeText> = [];
  ownerDocument: FakeDocument;
  private tagName: string;
  private classes: string[];
  private attributes: Record<string, string>;

  constructor(
    ownerDocument: FakeDocument,
    tagName = 'span',
    classes: string[] = [],
    attributes: Record<string, string> = {},
  ) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
    this.classes = classes;
    this.attributes = attributes;
  }

  append(...children: Array<FakeElement | FakeText>): this {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
    return this;
  }

  text(value: string): FakeText {
    const node = new FakeText(value, this);
    this.children.push(node);
    return node;
  }

  matches(selectors: string): boolean {
    return selectors.split(',').some((rawSelector) => {
      const selector = rawSelector.trim();
      if (selector.startsWith('.')) return this.classes.includes(selector.slice(1));
      if (selector === '[hidden]') return 'hidden' in this.attributes;
      const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      if (attribute) {
        const [, name, value] = attribute;
        return name in this.attributes && (value === undefined || this.attributes[name] === value);
      }
      return this.tagName.toLowerCase() === selector.toLowerCase();
    });
  }

  closest(selectors: string): FakeElement | null {
    if (this.matches(selectors)) return this;
    return this.parentElement?.closest(selectors) ?? null;
  }

  contains(candidate: FakeElement): boolean {
    for (let element: FakeElement | null = candidate; element; element = element.parentElement) {
      if (element === this) return true;
    }
    return false;
  }
}

class FakeRange {
  startContainer!: FakeText;
  startOffset = 0;
  endContainer!: FakeText;
  endOffset = 0;
  private ownerDocument: FakeDocument;

  constructor(ownerDocument: FakeDocument) {
    this.ownerDocument = ownerDocument;
  }

  setStart(node: FakeText, offset: number): void {
    this.startContainer = node;
    this.startOffset = offset;
    if (!this.endContainer) {
      this.endContainer = node;
      this.endOffset = offset;
    }
  }

  setEnd(node: FakeText, offset: number): void {
    this.endContainer = node;
    this.endOffset = offset;
  }

  cloneRange(): FakeRange {
    const clone = new FakeRange(this.ownerDocument);
    clone.startContainer = this.startContainer;
    clone.startOffset = this.startOffset;
    clone.endContainer = this.endContainer;
    clone.endOffset = this.endOffset;
    return clone;
  }

  collapse(toStart: boolean): void {
    if (toStart) {
      this.endContainer = this.startContainer;
      this.endOffset = this.startOffset;
    } else {
      this.startContainer = this.endContainer;
      this.startOffset = this.endOffset;
    }
  }

  compareBoundaryPoints(_how: number, source: FakeRange): number {
    return this.ownerDocument.comparePoints(
      this.startContainer,
      this.startOffset,
      source.startContainer,
      source.startOffset,
    );
  }
}

class FakeDocument {
  defaultView = {
    getComputedStyle: () => ({ display: 'inline', visibility: 'visible' }),
  };
  textNodes: FakeText[] = [];

  createTreeWalker(
    root: FakeElement,
    _whatToShow: number,
    filter: { acceptNode(node: FakeText): number },
  ): { nextNode(): FakeText | null } {
    this.textNodes = [];
    const visit = (element: FakeElement) => {
      for (const child of element.children) {
        if (child instanceof FakeText) this.textNodes.push(child);
        else visit(child);
      }
    };
    visit(root);
    const accepted = this.textNodes.filter((node) => filter.acceptNode(node) === 1);
    let index = 0;
    return { nextNode: () => accepted[index++] ?? null };
  }

  createRange(): FakeRange {
    return new FakeRange(this);
  }

  comparePoints(left: FakeText, leftOffset: number, right: FakeText, rightOffset: number): number {
    const nodeDifference = this.textNodes.indexOf(left) - this.textNodes.indexOf(right);
    return nodeDifference || leftOffset - rightOffset;
  }
}

function mathJaxFixture(): { root: HTMLElement; canonical: string; legacy: string } {
  const document = new FakeDocument();
  const root = new FakeElement(document, 'p');
  const beforeA = 'In a system of set theory with atoms it is assumed that one is given an infinite set ';
  const between = ' of atoms. One can build a universe ';
  const after = ' of sets over A.';

  const math = (visualText: string) => {
    const container = new FakeElement(document, 'span', ['MathJax_CHTML'], { 'data-mathml': visualText });
    const visual = new FakeElement(document, 'span', ['mjx-math'], { 'aria-hidden': 'true' });
    visual.text(visualText);
    const assistive = new FakeElement(document, 'span', ['MJX_Assistive_MathML']);
    assistive.text(visualText);
    container.append(visual, assistive);
    const source = new FakeElement(document, 'script', [], { type: 'math/tex' });
    source.text(visualText);
    return [container, source] as const;
  };

  const [aRender, aSource] = math('A');
  const [vRender, vSource] = math('V(A)');
  root.text(beforeA);
  root.append(aRender, aSource);
  root.text(between);
  root.append(vRender, vSource);
  root.text(after);

  return {
    root: root as unknown as HTMLElement,
    canonical: `${beforeA}A${between}V(A)${after}`,
    legacy: `${beforeA}AAA${between}V(A)V(A)V(A)${after}`,
  };
}

Object.assign(globalThis, {
  NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
  Range: { START_TO_START: 0 },
});

function anchorFor(text: string, exact: string, start: number): TextAnchor {
  const end = start + exact.length;
  return {
    version: 1,
    start,
    end,
    exact,
    prefix: text.slice(Math.max(0, start - 48), start),
    suffix: text.slice(end, end + 48),
  };
}

test('normalizes Unicode, invisible characters, and whitespace consistently', () => {
  assert.equal(
    normalizeAnchorText('  cafe\u0301\u200b\n\twith   spaces  '),
    'café with spaces',
  );
});

test('uses the stored position when the exact quote is unchanged', () => {
  const text = 'before selected text after';
  const exact = 'selected text';
  const start = text.indexOf(exact);
  assert.equal(findTextAnchorMatch(text, exact, anchorFor(text, exact, start)), start);
});

test('uses quote context to relocate repeated text after an insertion', () => {
  const original = 'first lead repeated phrase first tail; second lead repeated phrase second tail';
  const exact = 'repeated phrase';
  const originalStart = original.lastIndexOf(exact);
  const anchor = anchorFor(original, exact, originalStart);
  const changed = `inserted material; ${original}`;

  assert.equal(findTextAnchorMatch(changed, exact, anchor), changed.lastIndexOf(exact));
});

test('does not guess when unanchored text has multiple matches', () => {
  assert.equal(findTextAnchorMatch('same quote then same quote', 'same quote'), null);
});

test('does not guess when anchored candidates have identical confidence', () => {
  const exact = 'repeat';
  const text = 'repeat middle repeat';
  const anchor: TextAnchor = {
    version: 1,
    start: 7,
    end: 7 + exact.length,
    exact,
    prefix: '',
    suffix: '',
  };

  assert.equal(findTextAnchorMatch(text, exact, anchor), null);
});

test('does not use proximity alone when repeated text has no context', () => {
  const exact = 'repeat';
  const anchor: TextAnchor = {
    version: 1,
    start: 12,
    end: 12 + exact.length,
    exact,
    prefix: '',
    suffix: '',
  };

  assert.equal(findTextAnchorMatch('repeat much later repeat', exact, anchor), null);
});

test('indexes rendered MathJax once while excluding assistive and source copies', () => {
  const { root, canonical } = mathJaxFixture();
  assert.equal(createTextIndex(root).text, canonical);
});

test('repairs annotations whose MathJax text was saved three times', () => {
  const { root, canonical, legacy } = mathJaxFixture();
  const index = createTextIndex(root);
  const result = getRange(root, legacy, undefined, index);

  assert.equal(result.usedPosition, false);
  assert.equal(result.resolvedPosition?.exact, canonical);
  assert.equal(result.range.startOffset, 0);
  assert.equal(result.range.endOffset, ' of sets over A.'.length);
});

test('uses a canonical anchor exact when the saved display quote is legacy MathJax text', () => {
  const { root, canonical, legacy } = mathJaxFixture();
  const index = createTextIndex(root);
  const anchor = anchorFor(canonical, canonical, 0);
  const result = getRange(root, legacy, anchor, index);

  assert.equal(result.usedPosition, true);
  assert.equal(result.resolvedPosition, undefined);
});
