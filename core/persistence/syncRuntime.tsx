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
import {
  useSyncEngine,
} from "@mintcd/sync-engine/client/react";
import type {
  SyncDatabase,
  SyncClientSnapshot,
} from "@mintcd/sync-engine/client";
import { finalConfig } from "@/app/sync/sync.generated";
import {
  syncSessionForUserId,
  type SyncSession,
} from "./syncIdentity";
import type {
  replicaSchema,
  Row,
  TableName,
} from "@/app/sync/sync.generated";

type ReplicaSchema = typeof replicaSchema;

const MAX_RETRYABLE_SYNC_ATTEMPTS = 5;
const RETRYABLE_SYNC_BASE_DELAY_MS = 120;

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
  readonly db: SyncDatabase<ReplicaSchema>;
  readonly ready: boolean;
  readonly phase: "opening" | SyncClientSnapshot<ReplicaSchema>["phase"];
  readonly pendingCount: number;
  readonly revision: number;
  readonly error: unknown;
  readonly session: SyncSession;
  readonly sessionReady: boolean;
  readonly refreshSession: () => Promise<SyncSession>;
  readonly sync: () => Promise<void>;
}

const SyncRuntimeContext = createContext<AppSyncRuntime | undefined>(undefined);
let currentRuntime: AppSyncRuntime | undefined;

export function SyncEngineProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => syncSessionForUserId(undefined));
  const [sessionReady, setSessionReady] = useState(false);
  const [clientId] = useState(readOrCreateClientId);
  const rawSyncRef = useRef<() => Promise<void>>(() => (
    Promise.reject(new Error("sync engine client is not ready"))
  ));
  const syncQueueRef = useRef<{
    requested: boolean;
    promise: Promise<void> | undefined;
  }>({
    requested: false,
    promise: undefined,
  });

  const loadSession = useCallback(async (): Promise<SyncSession> => {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`session endpoint returned HTTP ${response.status}`);
    }
    const body = (await response.json()) as Partial<SyncSession>;
    return syncSessionForUserId(
      typeof body.userId === "string" ? body.userId : undefined,
    );
  }, []);

  const refreshSession = useCallback(async (): Promise<SyncSession> => {
    const nextSession = await loadSession();
    setSession(nextSession);
    setSessionReady(true);
    return nextSession;
  }, [loadSession]);

  useEffect(() => {
    let cancelled = false;
    void loadSession()
      .then((nextSession) => {
        if (cancelled) {
          return;
        }
        setSession(nextSession);
        setSessionReady(true);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.warn("Failed to resolve sync session; using anonymous stream", error);
        setSession(syncSessionForUserId(undefined));
        setSessionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [loadSession]);

  const sync = useSyncEngine({
    config: finalConfig,
    streamId: session.streamId,
    clientId,
    credentials: "same-origin",
    initialSync: false,
    serviceWorker: {
      syncOnBackgroundMessage: false,
      syncOnMutation: false,
    },
    onClientError(error) {
      console.error("Failed to open sync client", error);
    },
    onSyncError(error) {
      console.error("Sync failed", error);
    },
  });

  useEffect(() => {
    rawSyncRef.current = sync.sync;
  }, [sync.sync]);

  const queuedSync = useCallback(() => {
    syncQueueRef.current.requested = true;

    if (syncQueueRef.current.promise !== undefined) {
      return syncQueueRef.current.promise;
    }

    const promise = (async () => {
      while (syncQueueRef.current.requested) {
        syncQueueRef.current.requested = false;
        await syncWithRetry(() => rawSyncRef.current());
      }
    })().finally(() => {
      if (syncQueueRef.current.promise === promise) {
        syncQueueRef.current.promise = undefined;
      }
    });

    syncQueueRef.current.promise = promise;
    return promise;
  }, []);

  useEffect(() => {
    if (sync.ready) {
      void queuedSync().catch((error) => {
        console.error("Sync failed", error);
      });
    }
  }, [queuedSync, sync.ready, session.streamId]);

  const runtime = useMemo<AppSyncRuntime>(() => {
    const pendingCount =
      sync.pendingProposalCount + sync.acceptedAwaitingConfirmationCount;
    return {
      db: sync.db,
      ready: sync.ready,
      phase: sync.phase,
      pendingCount,
      revision: sync.revision,
      error: sync.error,
      session,
      sessionReady,
      refreshSession,
      sync: queuedSync,
    };
  }, [
    queuedSync,
    refreshSession,
    session,
    sessionReady,
    sync.acceptedAwaitingConfirmationCount,
    sync.db,
    sync.error,
    sync.pendingProposalCount,
    sync.phase,
    sync.ready,
    sync.revision,
  ]);

  useEffect(() => {
    currentRuntime = runtime;
    return () => {
      if (currentRuntime === runtime) {
        currentRuntime = undefined;
      }
    };
  }, [runtime]);

  return (
    <SyncRuntimeContext.Provider value={runtime}>
      {children}
    </SyncRuntimeContext.Provider>
  );
}

export function useSyncRuntime(): AppSyncRuntime {
  const runtime = useContext(SyncRuntimeContext);
  if (runtime === undefined) {
    throw new Error("SyncEngineProvider is missing");
  }
  return runtime;
}

export function getCurrentSyncRuntime(): AppSyncRuntime {
  if (currentRuntime === undefined) {
    throw new Error("SyncEngineProvider is not ready");
  }
  return currentRuntime;
}

export function useSyncStatus(): SyncStatusResult {
  const runtime = useSyncRuntime();
  return {
    status: runtime.ready ? runtime.phase : "opening",
    isSyncing: runtime.phase === "opening" || runtime.phase === "syncing",
    pendingCount: runtime.pendingCount,
    error: runtime.error,
    session: runtime.session,
    sessionReady: runtime.sessionReady,
    refreshSession: runtime.refreshSession,
  };
}

export function useSyncRows<Table extends TableName>(
  tableName: Table,
): SyncRowsResult<Table> {
  const runtime = useSyncRuntime();
  const revision = runtime.revision;

  return useMemo(() => {
    void revision;
    try {
      return {
        data: [...runtime.db.table(tableName).all()],
        loading: !runtime.ready,
        error: undefined,
      };
    } catch (error) {
      return {
        data: undefined,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [revision, runtime.db, runtime.ready, tableName]);
}

function readOrCreateClientId(): string {
  if (typeof window === "undefined") {
    return "server-render";
  }

  const key = "html-annotation-sync-client-id";
  const existing = window.localStorage.getItem(key);
  if (existing !== null && existing !== "") {
    return existing;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

async function syncWithRetry(sync: () => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRYABLE_SYNC_ATTEMPTS; attempt += 1) {
    try {
      await sync();
      return;
    } catch (error) {
      if (
        attempt === MAX_RETRYABLE_SYNC_ATTEMPTS - 1
        || !isRetryableSyncConflict(error)
      ) {
        throw error;
      }

      await wait(retryDelayMs(attempt));
    }
  }
}

function isRetryableSyncConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("D1 sync stream changed while committing")
    || message.includes("retry the sync request");
}

function retryDelayMs(attempt: number): number {
  const exponentialDelay = RETRYABLE_SYNC_BASE_DELAY_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * RETRYABLE_SYNC_BASE_DELAY_MS);
  return exponentialDelay + jitter;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
