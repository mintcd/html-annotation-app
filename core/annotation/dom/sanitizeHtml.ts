const ALLOWED_ELEMENTS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'sub',
  'sup',
  'ul',
]);

const DANGEROUS_CONTENT_ELEMENTS = new Set([
  'audio',
  'button',
  'canvas',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'math',
  'meta',
  'object',
  'option',
  'picture',
  'script',
  'select',
  'source',
  'style',
  'svg',
  'template',
  'textarea',
  'track',
  'video',
]);

const VOID_ELEMENTS = new Set(['br']);
const ATTRIBUTE_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

type ParsedTag = {
  closing: boolean;
  name: string;
  attributes: string;
  selfClosing: boolean;
};

export function sanitizeAnnotationHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('#')) {
    return /[\u0000-\u001F\u007F]/.test(trimmed) ? null : trimmed;
  }

  const compactScheme = trimmed
    .slice(0, Math.min(trimmed.length, 12))
    .replace(/[\u0000-\u001F\u007F\s]+/g, '')
    .toLowerCase();
  if (!compactScheme.startsWith('http:') && !compactScheme.startsWith('https:')) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function sanitizeAnnotationHtml(html: string): string {
  if (!html.trim()) return '';

  let output = '';
  const openElements: string[] = [];
  const droppedElements: string[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const tagStart = html.indexOf('<', cursor);
    if (tagStart === -1) {
      if (droppedElements.length === 0) output += escapeHtmlText(html.slice(cursor));
      break;
    }

    if (droppedElements.length === 0) {
      output += escapeHtmlText(html.slice(cursor, tagStart));
    }

    const tagEnd = findTagEnd(html, tagStart + 1);
    if (tagEnd === -1) {
      if (droppedElements.length === 0) output += '&lt;';
      cursor = tagStart + 1;
      continue;
    }

    const rawTag = html.slice(tagStart + 1, tagEnd);
    const parsed = parseTag(rawTag);
    if (!parsed) {
      const directive = rawTag.trim().startsWith('!') || rawTag.trim().startsWith('?');
      if (!directive && droppedElements.length === 0) {
        output += escapeHtmlText(html.slice(tagStart, tagEnd + 1));
      }
      cursor = tagEnd + 1;
      continue;
    }

    if (droppedElements.length > 0) {
      updateDroppedElements(droppedElements, parsed);
      cursor = tagEnd + 1;
      continue;
    }

    if (DANGEROUS_CONTENT_ELEMENTS.has(parsed.name)) {
      if (!parsed.closing && !parsed.selfClosing) droppedElements.push(parsed.name);
      cursor = tagEnd + 1;
      continue;
    }

    if (!ALLOWED_ELEMENTS.has(parsed.name)) {
      cursor = tagEnd + 1;
      continue;
    }

    if (parsed.closing) {
      output += closeOpenElement(openElements, parsed.name);
      cursor = tagEnd + 1;
      continue;
    }

    const attributes = sanitizeAttributes(parsed);
    output += `<${parsed.name}${attributes}>`;
    if (!VOID_ELEMENTS.has(parsed.name) && !parsed.selfClosing) {
      openElements.push(parsed.name);
    } else if (parsed.selfClosing && !VOID_ELEMENTS.has(parsed.name)) {
      output += `</${parsed.name}>`;
    }

    cursor = tagEnd + 1;
  }

  while (openElements.length > 0) {
    output += `</${openElements.pop()}>`;
  }

  return output.replace(/\s+/g, ' ').trim();
}

function findTagEnd(html: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return index;
  }
  return -1;
}

function parseTag(source: string): ParsedTag | null {
  const trimmed = source.trim();
  if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('?')) return null;

  const closing = trimmed.startsWith('/');
  const body = closing ? trimmed.slice(1).trimStart() : trimmed;
  const match = body.match(/^([A-Za-z][A-Za-z0-9:-]*)([\s\S]*?)$/);
  if (!match) return null;

  const name = match[1].toLowerCase();
  const attributes = match[2] ?? '';
  return {
    closing,
    name,
    attributes,
    selfClosing: /\/\s*$/.test(attributes),
  };
}

function updateDroppedElements(droppedElements: string[], parsed: ParsedTag): void {
  const current = droppedElements[droppedElements.length - 1];
  if (parsed.closing && parsed.name === current) {
    droppedElements.pop();
    return;
  }

  if (!parsed.closing && DANGEROUS_CONTENT_ELEMENTS.has(parsed.name) && !parsed.selfClosing) {
    droppedElements.push(parsed.name);
  }
}

function closeOpenElement(openElements: string[], name: string): string {
  const matchIndex = openElements.lastIndexOf(name);
  if (matchIndex === -1) return '';

  let output = '';
  while (openElements.length > matchIndex) {
    output += `</${openElements.pop()}>`;
  }
  return output;
}

function sanitizeAttributes(parsed: ParsedTag): string {
  if (parsed.name !== 'a' && parsed.name !== 'abbr') return '';

  const attributes: string[] = [];
  for (const [name, value] of readAttributes(parsed.attributes)) {
    const normalizedName = name.toLowerCase();
    if (normalizedName === 'title') {
      attributes.push(`title="${escapeHtmlAttribute(value)}"`);
    } else if (parsed.name === 'a' && normalizedName === 'href') {
      const href = sanitizeAnnotationHref(value);
      if (href) attributes.push(`href="${escapeHtmlAttribute(href)}"`);
    }
  }

  return attributes.length ? ` ${attributes.join(' ')}` : '';
}

function readAttributes(source: string): Array<[string, string]> {
  const attributes: Array<[string, string]> = [];
  const normalized = source.replace(/\/\s*$/, '');
  let match: RegExpExecArray | null;
  ATTRIBUTE_RE.lastIndex = 0;

  while ((match = ATTRIBUTE_RE.exec(normalized))) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    attributes.push([name, doubleQuoted ?? singleQuoted ?? unquoted ?? '']);
  }

  return attributes;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&(?!(?:[A-Za-z][A-Za-z0-9]+|#[0-9]+|#x[0-9A-Fa-f]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
