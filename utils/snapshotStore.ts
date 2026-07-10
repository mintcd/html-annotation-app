export type SnapshotRow = {
  id: string;
  url: string;
  title?: string;
  html: string;
  resources?: string[];
  created_at: number;
};

const DB_NAME = 'annotation-snapshots';
const DB_VERSION = 1;
const STORE = 'snapshots';

let databasePromise: Promise<IDBDatabase> | undefined;
let migrationPromise: Promise<void> | undefined;

function getDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('by_url', 'url');
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
  });

  return databasePromise;
}

async function getReadyDatabase(): Promise<IDBDatabase> {
  const database = await getDatabase();
  if (!migrationPromise) migrationPromise = migrateLegacySnapshots(database);
  await migrationPromise;
  return database;
}

export async function putSnapshot(row: SnapshotRow): Promise<void> {
  const database = await getReadyDatabase();
  const transaction = database.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put(row);
  await transactionDone(transaction);
}

export async function getSnapshotRow(id: string): Promise<SnapshotRow | undefined> {
  const database = await getReadyDatabase();
  const transaction = database.transaction(STORE, 'readonly');
  return requestResult<SnapshotRow | undefined>(transaction.objectStore(STORE).get(id));
}

export async function listSnapshotRowsForUrl(url: string): Promise<SnapshotRow[]> {
  const database = await getReadyDatabase();
  const transaction = database.transaction(STORE, 'readonly');
  return requestResult<SnapshotRow[]>(transaction.objectStore(STORE).index('by_url').getAll(url));
}

async function migrateLegacySnapshots(database: IDBDatabase): Promise<void> {
  const currentCount = await requestResult<number>(
    database.transaction(STORE, 'readonly').objectStore(STORE).count(),
  );
  if (currentCount > 0) return;

  const legacy = await openLegacyDatabase();
  if (!legacy || !legacy.objectStoreNames.contains(STORE)) {
    legacy?.close();
    return;
  }

  try {
    const rows = await requestResult<SnapshotRow[]>(
      legacy.transaction(STORE, 'readonly').objectStore(STORE).getAll(),
    );
    if (!rows.length) return;

    const transaction = database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const row of rows) store.put(row);
    await transactionDone(transaction);
  } finally {
    legacy.close();
  }
}

function openLegacyDatabase(): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    const request = indexedDB.open('annotation-db');
    request.onerror = () => resolve(undefined);
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
