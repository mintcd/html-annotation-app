import { eq } from '@mintcd/sync-engine';
import { db } from './engine';
import { generatePageId } from './api-helpers';
import { normalizeUrl, originToSlug } from './url';

export function syncTimestamp(): string {
  return new Date().toISOString();
}

export async function ensurePage(rawUrl: string, title = ''): Promise<Page> {
  const url = normalizeUrl(rawUrl);
  const existing = await db.select().from('pages').where(eq('url', url)).execute();
  if (existing[0]) return existing[0] as Page;

  const now = syncTimestamp();
  const page: Page = {
    id: await generatePageId(url),
    url,
    title,
    number_of_scripts: 0,
    number_of_annotations: 0,
    created_at: now,
    updated_at: now,
  };

  await db.insert(page).from('pages').execute();
  return page;
}

export async function getOrCreateWebsite(rawOrigin: string): Promise<Website> {
  const origin = new URL(rawOrigin).origin;
  const existing = await db.select().from('websites').where(eq('origin', origin)).execute();
  if (existing[0]) return existing[0] as Website;

  const baseSlug = originToSlug(origin);
  let id = baseSlug;
  let suffix = 1;

  while ((await db.select('id').from('websites').where(eq('id', id)).execute()).length > 0) {
    suffix += 1;
    id = `${baseSlug}-${suffix}`;
  }

  const now = syncTimestamp();
  const website: Website = { id, origin, created_at: now, updated_at: now };
  await db.insert(website).from('websites').execute();
  return website;
}

export function normalizeAnnotationRow(row: Record<string, unknown>): Annotation {
  return {
    id: String(row.id ?? ''),
    page_id: String(row.page_id ?? ''),
    text: String(row.text ?? ''),
    html: typeof row.html === 'string' ? row.html : null,
    color: typeof row.color === 'string' ? row.color : '#87ceeb',
    comment: typeof row.comment === 'string' ? row.comment : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    position: normalizePosition(row.position),
  };
}

function normalizePosition(value: unknown): Annotation['position'] {
  let position = value;
  if (typeof position === 'string') {
    try {
      position = JSON.parse(position);
    } catch {
      return undefined;
    }
  }

  if (Array.isArray(position)) {
    const [startPosition, endPosition, startOffset, endOffset] = position;
    return toPosition(startPosition, endPosition, startOffset, endOffset);
  }

  if (position && typeof position === 'object') {
    const record = position as Record<string, unknown>;
    if (Number(record.version) === 1) {
      return toTextAnchor(record);
    }
    return toPosition(
      record.startPosition ?? record.start_pos ?? record[0],
      record.endPosition ?? record.end_pos ?? record[1],
      record.startOffset ?? record.start_offset ?? record[2],
      record.endOffset ?? record.end_offset ?? record[3],
    );
  }

  return undefined;
}

function toPosition(
  startPosition: unknown,
  endPosition: unknown,
  startOffset: unknown,
  endOffset: unknown,
): Annotation['position'] {
  const values = [startPosition, endPosition, startOffset, endOffset].map(Number);
  if (
    values.some((value) => !Number.isInteger(value) || value < 0)
    || values[1] < values[0]
  ) return undefined;
  return {
    startPosition: values[0],
    endPosition: values[1],
    startOffset: values[2],
    endOffset: values[3],
  };
}

function toTextAnchor(record: Record<string, unknown>): TextAnchor | undefined {
  const start = Number(record.start);
  const end = Number(record.end);
  const exact = typeof record.exact === 'string' ? record.exact : '';
  const prefix = typeof record.prefix === 'string' ? record.prefix : '';
  const suffix = typeof record.suffix === 'string' ? record.suffix : '';

  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end <= start
    || end - start !== exact.length
    || exact.length === 0
  ) return undefined;

  return { version: 1, start, end, exact, prefix, suffix };
}
