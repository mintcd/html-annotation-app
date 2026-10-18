import { syncSessionForUserId, type SyncSession } from './syncIdentity.ts';

export const SYNC_SESSION_CACHE_KEY = 'html-annotation:last-verified-session';

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readCachedSyncSession(storage: SessionStorage | undefined): SyncSession | undefined {
  try {
    const raw = storage?.getItem(SYNC_SESSION_CACHE_KEY);
    if (!raw) return undefined;
    const stored: unknown = JSON.parse(raw);
    if (!stored || typeof stored !== 'object') return undefined;
    const value = stored as Partial<SyncSession>;
    if (typeof value.userId !== 'string' || value.authenticated !== true) return undefined;
    const session = syncSessionForUserId(value.userId);
    if (!session.authenticated) return undefined;
    return typeof value.username === 'string' && value.username.trim()
      ? { ...session, username: value.username }
      : session;
  } catch {
    return undefined;
  }
}

export function cacheVerifiedSyncSession(storage: SessionStorage | undefined, session: SyncSession): void {
  try {
    if (session.authenticated) storage?.setItem(SYNC_SESSION_CACHE_KEY, JSON.stringify(session));
    else storage?.removeItem(SYNC_SESSION_CACHE_KEY);
  } catch {
    // Storage availability must not turn a verified login into a failed login.
  }
}

export function browserSessionStorage(): SessionStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
