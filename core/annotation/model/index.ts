export const TEXT_ANCHOR_CONTEXT_LENGTH = 48;
export const INVISIBLE_TEXT_RE = /[\u00ad\u200b-\u200d\u2060\ufeff]/gu;

export function normalizeAnchorText(value: string): string {
  return value
    .normalize('NFC')
    .replace(INVISIBLE_TEXT_RE, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function createTextAnchorModel(text: string, start: number, end: number): TextAnchor {
  return {
    version: 1,
    start,
    end,
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - TEXT_ANCHOR_CONTEXT_LENGTH), start),
    suffix: text.slice(end, end + TEXT_ANCHOR_CONTEXT_LENGTH),
  };
}

function commonPrefixLength(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  let i = 0;
  while (i < length && left[i] === right[i]) i++;
  return i;
}

function commonSuffixLength(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  let i = 0;
  while (i < length && left[left.length - 1 - i] === right[right.length - 1 - i]) i++;
  return i;
}

export function findOccurrences(text: string, exact: string): number[] {
  const starts: number[] = [];
  for (let start = text.indexOf(exact); start !== -1; start = text.indexOf(exact, start + 1)) {
    starts.push(start);
  }
  return starts;
}

export function findTextAnchorMatch(text: string, exact: string, anchor?: TextAnchor): number | null {
  if (!exact) return null;

  if (anchor && text.slice(anchor.start, anchor.start + exact.length) === exact) {
    return anchor.start;
  }

  const starts = findOccurrences(text, exact);
  if (starts.length === 0) return null;
  if (starts.length === 1) return starts[0];
  if (!anchor) return null;

  const ranked = starts.map((start) => {
    const prefix = text.slice(Math.max(0, start - anchor.prefix.length), start);
    const suffix = text.slice(start + exact.length, start + exact.length + anchor.suffix.length);
    return {
      start,
      context: commonSuffixLength(prefix, anchor.prefix) + commonPrefixLength(suffix, anchor.suffix),
      distance: Math.abs(start - anchor.start),
    };
  }).sort((left, right) =>
    right.context - left.context
    || left.distance - right.distance
    || left.start - right.start,
  );

  const best = ranked[0];
  const second = ranked[1];
  const requiredContext = Math.min(8, anchor.prefix.length + anchor.suffix.length);
  if (requiredContext === 0 || best.context < requiredContext) return null;
  if (second && best.context === second.context && best.distance === second.distance) return null;
  return best.start;
}

export function textAnchorsEqual(left: TextAnchor, right: TextAnchor): boolean {
  return left.start === right.start
    && left.end === right.end
    && left.exact === right.exact
    && left.prefix === right.prefix
    && left.suffix === right.suffix;
}

export function isTextAnchor(position: unknown): position is TextAnchor {
  return Boolean(
    position
    && typeof position === 'object'
    && 'version' in position
    && position.version === 1,
  );
}
