import type { Row } from '@/app/sync/sync.generated';
import {
  getCurrentSyncRuntime,
  type AppSyncRuntime,
} from './syncRuntime';
import { normalizeUrl } from '../utils/url';

const REMOTE_WEBSITE_TIMEOUT_MS = 5000;
const REMOTE_WEBSITE_POLL_MS = 150;

type AnnotationRow = Row<'annotations'>;
type HighlightColorRow = Row<'highlight_colors'>;
type PageNoteRow = Row<'page_notes'>;
type PageRow = Row<'pages'>;
type WebsiteRow = Row<'websites'>;

const PAGE_NOTE_FORMAT = 'plain_text';
export const FALLBACK_HIGHLIGHT_COLOR = '#87ceeb';
export const INITIAL_HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  { color: '#87ceeb', semantics: 'Reference' },
  { color: '#90ee90', semantics: 'Confirmed' },
  { color: '#ff6b6b', semantics: 'Concern' },
  { color: '#d3d3d3', semantics: 'Follow-up' },
];

type AnnotationInput = {
  id?: string;
  page_id: string;
  text: string;
  html?: string | null;
  color: string;
  comment?: string | null;
  created_at: string;
  updated_at: string;
  position: TextAnchor;
};

type AnnotationPatch = {
  text?: string;
  html?: string | null;
  color?: string;
  comment?: string | null;
  updated_at?: string;
  position?: TextAnchor | null;
};

type SyncFlushMode = 'background' | 'await' | 'none';

type SyncWriteOptions = {
  flush?: SyncFlushMode;
};

type HighlightColorInput = {
  color: string;
  semantics: string;
};

type PageNoteInput = {
  id?: string;
  page_id: string;
  content: string;
  format?: string;
  created_at?: string;
  updated_at?: string;
};

export function syncTimestamp(): string {
  return new Date().toISOString();
}

export async function ensurePage(
  rawUrl: string,
  title = '',
  runtime?: AppSyncRuntime,
): Promise<Page> {
  const url = normalizeUrl(rawUrl);
  const syncRuntime = activeRuntime(runtime);
  const pages = syncRuntime.db.table('pages');
  const existing = pages.all().find((page) => page.url === url);
  if (existing) return normalizePageRow(existing);

  const now = syncTimestamp();
  const page: PageRow = {
    id: crypto.randomUUID(),
    url,
    title,
    number_of_scripts: 0,
    number_of_annotations: 0,
    created_at: now,
    updated_at: now,
  };

  await pages.put(page);
  flushSync('inserted page', syncRuntime);
  return normalizePageRow(page);
}

export async function findPageById(
  id: string,
  runtime?: AppSyncRuntime,
): Promise<Page | undefined> {
  const row = activeRuntime(runtime).db.table('pages').get({ id });
  return row ? normalizePageRow(row) : undefined;
}

export async function updatePageRow(
  id: string,
  changes: Partial<Pick<Page, 'title' | 'number_of_scripts' | 'number_of_annotations' | 'updated_at'>>,
  runtime?: AppSyncRuntime,
): Promise<Page | undefined> {
  const syncRuntime = activeRuntime(runtime);
  const pages = syncRuntime.db.table('pages');
  const existing = pages.get({ id });
  if (!existing) return undefined;

  const next: PageRow = {
    ...existing,
    ...changes,
  };
  await pages.put(next);
  flushSync('updated page', syncRuntime);
  return normalizePageRow(next);
}

export async function deletePageRow(
  id: string,
  runtime?: AppSyncRuntime,
): Promise<void> {
  const syncRuntime = activeRuntime(runtime);
  await syncRuntime.db.table('pages').delete({ id });
  flushSync('deleted page', syncRuntime);
}

export async function getOrCreateWebsite(
  rawOrigin: string,
  runtime?: AppSyncRuntime,
): Promise<Website> {
  const origin = new URL(rawOrigin).origin;
  const syncRuntime = activeRuntime(runtime);
  const websites = syncRuntime.db.table('websites');
  const existing = websites.all().find((website) => website.origin === origin);
  if (existing) return normalizeWebsiteRow(existing);

  const now = syncTimestamp();
  const website: WebsiteRow = {
    id: siteIdForOrigin(origin),
    origin,
    title: null,
    created_at: now,
    updated_at: now,
  };
  await websites.put(website);
  flushSync('inserted website', syncRuntime);
  return normalizeWebsiteRow(website);
}

export async function findWebsiteByOrigin(
  origin: string,
  runtime?: AppSyncRuntime,
): Promise<Website | undefined> {
  const normalizedOrigin = new URL(origin).origin;
  const row = activeRuntime(runtime)
    .db
    .table('websites')
    .all()
    .find((website) => website.origin === normalizedOrigin);
  return row ? normalizeWebsiteRow(row) : undefined;
}

export async function updateWebsiteRow(
  id: string,
  changes: Partial<Pick<Website, 'title' | 'updated_at'>>,
  runtime?: AppSyncRuntime,
): Promise<Website | undefined> {
  const syncRuntime = activeRuntime(runtime);
  const websites = syncRuntime.db.table('websites');
  const existing = websites.get({ id });
  if (!existing) return undefined;

  const next: WebsiteRow = {
    ...existing,
    ...changes,
    title: changes.title === undefined ? existing.title : changes.title || null,
  };
  await websites.put(next);
  flushSync('updated website', syncRuntime);
  return normalizeWebsiteRow(next);
}

export async function ensureWebsiteAvailableForRoute(
  website: Pick<Website, 'id' | 'origin'>,
  timeoutMs = REMOTE_WEBSITE_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: string | undefined;

  while (Date.now() <= deadline) {
    try {
      if (await remoteWebsiteExists(website)) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await wait(REMOTE_WEBSITE_POLL_MS);
  }

  throw new Error(
    lastError
      ? `The site was saved locally, but is not available to the server yet: ${lastError}`
      : 'The site was saved locally, but is not available to the server yet.',
  );
}

export async function createAnnotationRow(
  input: AnnotationInput,
  runtime?: AppSyncRuntime,
): Promise<Annotation> {
  const syncRuntime = activeRuntime(runtime);
  const annotations = syncRuntime.db.table('annotations');
  const row = buildAnnotationRow(input);

  await annotations.put(row);
  flushSync('inserted annotation', syncRuntime);
  return normalizeAnnotationRow(row);
}

export async function updateAnnotationRow(
  id: string,
  changes: AnnotationPatch,
  runtime?: AppSyncRuntime,
  options: SyncWriteOptions = {},
): Promise<Annotation | undefined> {
  const syncRuntime = activeRuntime(runtime);
  const annotations = syncRuntime.db.table('annotations');
  const existing = annotations.get({ id });
  if (!existing) return undefined;

  const anchor = annotationAnchorFields(
    {
      exact: existing.exact,
      prefix: existing.prefix,
      suffix: existing.suffix,
    },
    changes.text,
    changes.position,
  );
  const next: AnnotationRow = {
    ...existing,
    ...anchor,
    ...(changes.html === undefined ? {} : { html: changes.html || null }),
    ...(changes.color === undefined ? {} : { color: changes.color }),
    ...(changes.comment === undefined ? {} : { comment: changes.comment || null }),
    ...(changes.updated_at === undefined ? {} : { updated_at: changes.updated_at }),
  };

  if (annotationRowsEqual(existing, next)) {
    return normalizeAnnotationRow(existing);
  }

  await annotations.put(next);
  await flushSync('updated annotation', syncRuntime, options.flush ?? 'background');
  return normalizeAnnotationRow(next);
}

export async function deleteAnnotationRow(
  id: string,
  runtime?: AppSyncRuntime,
): Promise<void> {
  const syncRuntime = activeRuntime(runtime);
  await syncRuntime.db.table('annotations').delete({ id });
  flushSync('deleted annotation', syncRuntime);
}

export async function upsertHighlightColorRow(
  input: HighlightColorInput,
  runtime?: AppSyncRuntime,
  options: SyncWriteOptions = {},
): Promise<HighlightColor> {
  const color = normalizeHexColor(input.color);
  const semantics = input.semantics.trim();

  if (!color) throw new Error('Enter a valid hex color.');
  if (!semantics) throw new Error('Enter color semantics.');

  const syncRuntime = activeRuntime(runtime);
  const row: HighlightColorRow = { color, semantics };

  await syncRuntime.db.table('highlight_colors').put(row);
  await flushSync('updated highlight color', syncRuntime, options.flush ?? 'background');
  return normalizeHighlightColorRow(row);
}

export async function deleteHighlightColorRow(
  color: string,
  runtime?: AppSyncRuntime,
  options: SyncWriteOptions = {},
): Promise<void> {
  const normalized = normalizeHexColor(color);
  if (!normalized) return;

  const syncRuntime = activeRuntime(runtime);
  await syncRuntime.db.table('highlight_colors').delete({ color: normalized });
  await flushSync('deleted highlight color', syncRuntime, options.flush ?? 'background');
}

export async function upsertPageNoteRow(
  input: PageNoteInput,
  runtime?: AppSyncRuntime,
  options: SyncWriteOptions = {},
): Promise<PageNote> {
  const syncRuntime = activeRuntime(runtime);
  const pageNotes = syncRuntime.db.table('page_notes');
  const existing = input.id
    ? pageNotes.get({ id: input.id })
    : newestPageNoteRow(pageNotes.all().filter((note) => note.page_id === input.page_id));
  const format = input.format ?? existing?.format ?? PAGE_NOTE_FORMAT;

  if (
    existing
    && existing.page_id === input.page_id
    && existing.content === input.content
    && existing.format === format
  ) {
    return normalizePageNoteRow(existing);
  }

  const now = input.updated_at ?? syncTimestamp();
  const row: PageNoteRow = existing
    ? {
        ...existing,
        page_id: input.page_id,
        content: input.content,
        format,
        updated_at: now,
      }
    : {
        id: input.id ?? crypto.randomUUID(),
        page_id: input.page_id,
        content: input.content,
        format,
        created_at: input.created_at ?? now,
        updated_at: now,
      };

  await pageNotes.put(row);
  await flushSync(existing ? 'updated page note' : 'inserted page note', syncRuntime, options.flush ?? 'background');
  return normalizePageNoteRow(row);
}

export async function deletePageNoteRow(
  id: string,
  runtime?: AppSyncRuntime,
  options: SyncWriteOptions = {},
): Promise<void> {
  const syncRuntime = activeRuntime(runtime);
  await syncRuntime.db.table('page_notes').delete({ id });
  await flushSync('deleted page note', syncRuntime, options.flush ?? 'background');
}

export function normalizeAnnotationRow(row: Record<string, unknown>): Annotation {
  const exact = stringValue(row.exact ?? row.text);
  const prefix = stringValue(row.prefix);
  const suffix = stringValue(row.suffix);
  const position = normalizeTextAnchor(row.position)
    ?? { version: 1, start: 0, end: exact.length, exact, prefix, suffix };

  return {
    id: String(row.id ?? ''),
    page_id: String(row.page_id ?? ''),
    text: position.exact,
    html: typeof row.html === 'string' ? row.html : null,
    color: typeof row.color === 'string' ? row.color : FALLBACK_HIGHLIGHT_COLOR,
    comment: typeof row.comment === 'string' ? row.comment : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    position,
  };
}

export function normalizePageNoteRow(row: Record<string, unknown>): PageNote {
  return {
    id: String(row.id ?? ''),
    page_id: String(row.page_id ?? ''),
    content: typeof row.content === 'string' ? row.content : '',
    format: typeof row.format === 'string' && row.format.trim()
      ? row.format
      : PAGE_NOTE_FORMAT,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export function normalizeHighlightColorRow(row: Record<string, unknown>): HighlightColor {
  const color = normalizeHexColor(String(row.color ?? '')) ?? FALLBACK_HIGHLIGHT_COLOR;
  const semantics = stringValue(row.semantics).trim();
  return {
    color,
    semantics: semantics || color,
  };
}

export function normalizeHexColor(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(withoutHash)) {
    return `#${withoutHash.split('').map((character) => `${character}${character}`).join('')}`.toLowerCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(withoutHash)) {
    return `#${withoutHash}`.toLowerCase();
  }

  return null;
}

export function findPageNoteForPage(
  rows: readonly Record<string, unknown>[] | undefined,
  pageId: string,
  pageUrl?: string,
): PageNote | null {
  if (!rows) return null;

  const notes = rows
    .map(normalizePageNoteRow)
    .filter((note) => note.page_id === pageId || (pageUrl !== undefined && note.page_id === pageUrl));

  return newestPageNote(notes);
}

function buildAnnotationRow(input: AnnotationInput): AnnotationRow {
  const anchor = annotationAnchorFields(
    undefined,
    input.text,
    input.position,
  );

  return {
    id: input.id ?? crypto.randomUUID(),
    page_id: input.page_id,
    exact: anchor.exact,
    html: input.html || null,
    created_at: input.created_at,
    updated_at: input.updated_at,
    color: input.color,
    comment: input.comment || null,
    prefix: anchor.prefix,
    suffix: anchor.suffix,
  };
}

function annotationAnchorFields(
  current: Pick<AnnotationRow, 'exact' | 'prefix' | 'suffix'> | undefined,
  text: string | undefined,
  position: TextAnchor | null | undefined,
): Pick<AnnotationRow, 'exact' | 'prefix' | 'suffix'> {
  if (position) {
    return {
      exact: position.exact,
      prefix: position.prefix,
      suffix: position.suffix,
    };
  }

  if (text !== undefined) {
    return {
      exact: text,
      prefix: current?.prefix ?? '',
      suffix: current?.suffix ?? '',
    };
  }

  return current ?? { exact: '', prefix: '', suffix: '' };
}

function annotationRowsEqual(left: AnnotationRow, right: AnnotationRow): boolean {
  return left.id === right.id
    && left.page_id === right.page_id
    && left.exact === right.exact
    && left.html === right.html
    && left.created_at === right.created_at
    && left.updated_at === right.updated_at
    && left.color === right.color
    && left.comment === right.comment
    && left.prefix === right.prefix
    && left.suffix === right.suffix;
}

function newestPageNote(notes: readonly PageNote[]): PageNote | null {
  if (notes.length === 0) return null;

  return [...notes].sort((left, right) =>
    noteTimestamp(right) - noteTimestamp(left),
  )[0] ?? null;
}

function newestPageNoteRow(notes: readonly PageNoteRow[]): PageNoteRow | undefined {
  if (notes.length === 0) return undefined;

  return [...notes].sort((left, right) =>
    noteTimestamp(right) - noteTimestamp(left),
  )[0];
}

function noteTimestamp(note: Pick<PageNote, 'updated_at' | 'created_at'>): number {
  const parsed = Date.parse(note.updated_at || note.created_at || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizePageRow(row: PageRow): Page {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    number_of_scripts: row.number_of_scripts ?? 0,
    number_of_annotations: row.number_of_annotations ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeWebsiteRow(row: WebsiteRow): Website {
  return {
    id: row.id,
    origin: row.origin,
    title: row.title ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function remoteWebsiteExists(website: Pick<Website, 'id' | 'origin'>): Promise<boolean> {
  const params = new URLSearchParams({ id: String(website.id) });
  const response = await fetch(`/api/websites?${params.toString()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Website lookup returned ${response.status}`);
  }

  const rows = await response.json().catch(() => null) as unknown;
  return Array.isArray(rows) && rows.some((row) => (
    row
    && typeof row === 'object'
    && String((row as Website).id) === String(website.id)
    && String((row as Website).origin) === String(website.origin)
  ));
}

function activeRuntime(runtime: AppSyncRuntime | undefined): AppSyncRuntime {
  return runtime ?? getCurrentSyncRuntime();
}

function flushSync(
  label: string,
  runtime: AppSyncRuntime,
  mode: SyncFlushMode = 'background',
): Promise<void> | undefined {
  if (mode === 'none') {
    return undefined;
  }

  const sync = runtime.sync().catch((error: unknown) => {
    console.error(`Failed to flush ${label}`, error);
    throw error;
  });

  if (mode === 'await') {
    return sync;
  }

  void sync.catch(() => undefined);
  return undefined;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeTextAnchor(value: unknown): TextAnchor | undefined {
  let position = value;
  if (typeof position === 'string') {
    try {
      position = JSON.parse(position);
    } catch {
      return undefined;
    }
  }

  if (position && typeof position === 'object') {
    const record = position as Record<string, unknown>;
    if (Number(record.version) === 1) {
      return toTextAnchor(record);
    }
  }

  return undefined;
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

function siteIdForOrigin(origin: string): string {
  const url = new URL(origin);
  const slug = `${url.hostname}${url.port ? `-${url.port}` : ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || crypto.randomUUID();
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
