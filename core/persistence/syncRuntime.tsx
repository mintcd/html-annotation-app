"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SyncEnginePhase, SyncEngineSnapshot } from "@mintcd/sync-engine/client";
import type { PwaWorkerSnapshot } from "@mintcd/sync-engine/pwa/client";
import { createSyncEngine, logoutSync, type Engine } from "@/sync/client";
import type { Row, TableName } from "@/sync/types";
import { syncSessionForUserId, type SyncSession } from "./syncIdentity";
import { createSyncClientLifecycle } from "./syncClientLifecycle";
import { collectSyncRows } from "./syncQueries";
import {
  browserSessionStorage,
  cacheVerifiedSyncSession,
  readCachedSyncSession,
} from "./syncSessionCache";

type AppSyncPhase = SyncEnginePhase | "opening";
type SyncStatusResult = {
  readonly status: string;
  readonly isSyncing: boolean;
  readonly pendingCount: number;
  readonly error: unknown;
  readonly session: SyncSession;
  readonly sessionReady: boolean;
  readonly refreshSession: () => Promise<SyncSession>;
};

type SyncRowsResult<Table extends TableName> = {
  readonly data: Row<Table>[] | undefined;
  readonly loading: boolean;
  readonly error: string | undefined;
};

export interface AppSyncRuntime {
  readonly db: Engine | undefined;
  readonly ready: boolean;
  readonly phase: AppSyncPhase;
  readonly pendingCount: number;
  readonly revision: number;
  readonly error: unknown;
  readonly session: SyncSession;
  readonly sessionReady: boolean;
  readonly refreshSession: () => Promise<SyncSession>;
  readonly sync: () => Promise<void>;
  readonly assertActive: () => void;
}

const SyncRuntimeContext = createContext<AppSyncRuntime | undefined>(undefined);
let currentRuntime: AppSyncRuntime | undefined;
let lifecycle: ReturnType<typeof createSyncClientLifecycle<Engine>> | undefined;

function getLifecycle(previousSession: SyncSession | undefined) {
  return lifecycle ??= createSyncClientLifecycle({
    create: (identity, initialize) => createSyncEngine({
      ...identity,
      ...(initialize ? { initialize: true } : {}),
    }),
    logout: () => logoutSync(),
    ...(previousSession?.authenticated ? {
      previousIdentity: { accountId: previousSession.userId, streamId: previousSession.streamId },
    } : {}),
  });
}

type ResolvedSession = { session: SyncSession; verified: boolean; generation: number };
type ClientState = {
  identity: string;
  engine: Engine;
  snapshot: SyncEngineSnapshot;
  worker: PwaWorkerSnapshot;
};

export function SyncEngineProvider({ children }: { children: ReactNode }) {
  const [resolved, setResolved] = useState<ResolvedSession>({
    session: syncSessionForUserId(undefined), verified: false, generation: 0,
  });
  const [sessionReady, setSessionReady] = useState(false);
  const [client, setClient] = useState<ClientState>();
  const [openingError, setOpeningError] = useState<unknown>();
  const [sessionError, setSessionError] = useState<unknown>();
  const lastSession = useRef<SyncSession | undefined>(undefined);
  const sessionRequest = useRef(0);
  const sessionGeneration = useRef(0);

  const loadSession = useCallback(async (): Promise<Omit<ResolvedSession, 'generation'>> => {
    const storage = browserSessionStorage();
    const cached = lastSession.current ?? readCachedSyncSession(storage);
    getLifecycle(cached);
    const offlineSession = () => ({
      session: cached ?? syncSessionForUserId(undefined), verified: false,
    });
    if (typeof navigator !== "undefined" && !navigator.onLine) return offlineSession();

    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Session endpoint returned HTTP ${response.status}`);
      const body = (await response.json()) as Partial<SyncSession>;
      const identity = syncSessionForUserId(typeof body.userId === "string" ? body.userId : undefined);
      const session = typeof body.username === "string" && body.username.trim()
        ? { ...identity, username: body.username }
        : identity;
      return { session, verified: true };
    } catch (error) {
      if (error instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine)) {
        return offlineSession();
      }
      throw error;
    }
  }, []);

  const applySession = useCallback((next: Omit<ResolvedSession, 'generation'>) => {
    const previous = lastSession.current;
    if (!previous || previous.userId !== next.session.userId || previous.streamId !== next.session.streamId) {
      sessionGeneration.current += 1;
      // Imperative saves must stop using the previous identity immediately.
      currentRuntime = undefined;
    }
    lastSession.current = next.session;
    if (next.verified) cacheVerifiedSyncSession(browserSessionStorage(), next.session);
    setSessionError(undefined);
    setResolved({ ...next, generation: sessionGeneration.current });
    setSessionReady(true);
  }, []);

  const refreshSession = useCallback(async (): Promise<SyncSession> => {
    const request = ++sessionRequest.current;
    const next = await loadSession();
    if (request === sessionRequest.current) applySession(next);
    return next.session;
  }, [applySession, loadSession]);

  useEffect(() => {
    let cancelled = false;
    const request = ++sessionRequest.current;
    void loadSession().then(next => {
      if (!cancelled && request === sessionRequest.current) applySession(next);
    }).catch(error => {
      if (cancelled || request !== sessionRequest.current) return;
      setSessionError(error);
      setResolved({
        session: lastSession.current ?? readCachedSyncSession(browserSessionStorage()) ?? syncSessionForUserId(undefined),
        verified: false,
        generation: sessionGeneration.current,
      });
      setSessionReady(true);
    });
    const reconnect = () => { void refreshSession().catch(setSessionError); };
    window.addEventListener("online", reconnect);
    return () => {
      cancelled = true;
      window.removeEventListener("online", reconnect);
    };
  }, [applySession, loadSession, refreshSession]);

  const { session, verified, generation } = resolved;
  const identity = `${session.userId}\0${session.streamId}`;

  useEffect(() => {
    if (!sessionReady) return;
    let active = true;
    let owned: Engine | undefined;
    let unsubscribe: (() => void) | undefined;
    let unsubscribeWorker: (() => void) | undefined;
    setOpeningError(undefined);
    setClient(undefined);
    const manager = getLifecycle(lastSession.current);
    void manager.open(
      session.authenticated ? { accountId: session.userId, streamId: session.streamId } : undefined,
      verified,
      () => active,
    ).then(engine => {
      if (!engine) return;
      if (!active) {
        void manager.close(engine).catch(error => console.error("Failed to close sync client", error));
        return;
      }
      owned = engine;
      const update = () => {
        if (active) setClient({
          identity, engine, snapshot: engine.getSnapshot(), worker: engine.getWorkerSnapshot(),
        });
      };
      unsubscribe = engine.subscribe(update);
      unsubscribeWorker = engine.subscribeWorker(update);
      update();
    }).catch(error => {
      if (active) setOpeningError(error);
    });

    return () => {
      active = false;
      unsubscribe?.();
      unsubscribeWorker?.();
      void manager.close(owned).catch(error => console.error("Failed to close sync client", error));
    };
  }, [identity, session.authenticated, session.streamId, session.userId, sessionReady, verified]);

  // Account transitions must stop exposing the old client before close finishes.
  const activeClient = client?.identity === identity ? client : undefined;
  const engine = activeClient?.engine;
  const snapshot = activeClient?.snapshot;
  const worker = activeClient?.worker;
  const error = openingError ?? sessionError ?? snapshot?.lastError ?? worker?.lastError;
  const phase: AppSyncPhase = openingError ? "error"
    : !sessionReady || (session.authenticated && !engine) ? "opening"
      : worker?.phase === "syncing" ? "syncing"
        : worker?.phase === "error" ? "error"
          : snapshot?.phase ?? "idle";
  const assertActive = useCallback(() => {
    if (generation !== sessionGeneration.current) throw new Error("Sync session changed");
    if (!engine || engine.getSnapshot().phase === "closed") throw new Error("Sync client is not ready");
  }, [engine, generation]);
  const sync = useCallback(async () => {
    if (!engine) {
      if (session.authenticated) throw new Error("Sync client is not ready");
      return;
    }
    assertActive();
    await engine.sync();
  }, [assertActive, engine, session.authenticated]);

  const runtime = useMemo<AppSyncRuntime>(() => ({
    db: engine,
    ready: engine !== undefined,
    phase,
    pendingCount: (snapshot?.replica.pendingCount ?? 0) + (snapshot?.replica.acceptedAwaitingCount ?? 0),
    revision: snapshot?.replica.revision ?? 0,
    error,
    session,
    sessionReady,
    refreshSession,
    sync,
    assertActive,
  }), [assertActive, engine, error, phase, refreshSession, session, sessionReady, snapshot, sync]);

  useEffect(() => {
    currentRuntime = runtime;
    return () => { if (currentRuntime === runtime) currentRuntime = undefined; };
  }, [runtime]);

  return <SyncRuntimeContext.Provider value={runtime}>{children}</SyncRuntimeContext.Provider>;
}

export function useSyncRuntime(): AppSyncRuntime {
  const runtime = useContext(SyncRuntimeContext);
  if (!runtime) throw new Error("SyncEngineProvider is missing");
  return runtime;
}

export function getCurrentSyncRuntime(): AppSyncRuntime {
  if (!currentRuntime) throw new Error("SyncEngineProvider is not ready");
  return currentRuntime;
}

export function useSyncStatus(): SyncStatusResult {
  const runtime = useSyncRuntime();
  return {
    status: runtime.phase,
    isSyncing: runtime.phase === "opening" || runtime.phase === "syncing" || runtime.phase === "retrying",
    pendingCount: runtime.pendingCount,
    error: runtime.error,
    session: runtime.session,
    sessionReady: runtime.sessionReady,
    refreshSession: runtime.refreshSession,
  };
}

export function useSyncRows<Table extends TableName>(tableName: Table): SyncRowsResult<Table> {
  const runtime = useSyncRuntime();
  const engine = runtime.db;
  const [result, setResult] = useState<{
    engine: Engine;
    table: Table;
    data?: Row<Table>[];
    error?: string;
  }>();

  useEffect(() => {
    if (!engine) return;
    let active = true;
    void collectSyncRows(engine.from(tableName)).then(rows => {
      // All fields are selected; TypeScript cannot relate the generic mapped row aliases.
      if (active) setResult({ engine, table: tableName, data: rows as unknown as Row<Table>[] });
    }).catch(error => {
      if (active) setResult({ engine, table: tableName, error: error instanceof Error ? error.message : String(error) });
    });
    return () => { active = false; };
  }, [engine, runtime.revision, tableName]);

  if (result?.engine === engine && result?.table === tableName) {
    return { data: result.data, loading: false, error: result.error };
  }
  return {
    data: engine ? undefined : [],
    loading: runtime.phase === "opening" || !!engine,
    error: runtime.error ? (runtime.error instanceof Error ? runtime.error.message : String(runtime.error)) : undefined,
  };
}
