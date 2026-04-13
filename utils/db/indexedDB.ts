import type { LocalSchema, Store } from './LocalSchema';

const DB_NAME = 'annotation-db';
const DB_VERSION = 1;

const TableSchemas: Record<string, { keyPath: string | string[]; indices: Array<{ name: string; keyPath: string | string[]; options?: any }> }> = {
  pages: {
    keyPath: 'id',
    indices: [
      { name: 'url', keyPath: 'url' },
      { name: 'by_created', keyPath: 'created_at' },
    ]
  },
  annotations: {
    keyPath: 'id',
    indices: [
      { name: 'page_id', keyPath: 'page_id' },
      { name: 'by_created', keyPath: 'created_at' }
    ]
  },
  operations: {
    keyPath: 'id',
    indices: [
      { name: 'by_processed', keyPath: 'processed' },
      { name: 'by_client', keyPath: ['client_id', 'client_op_id'] },
      { name: 'by_entity', keyPath: 'entity' },
      { name: 'by_created_at', keyPath: 'created_at' },
    ]
  },
  websites: {
    keyPath: 'id',
    indices: [
      { name: 'by_origin', keyPath: 'origin' }
    ]
  },
  snapshots: {
    keyPath: 'id',
    indices: [
      { name: 'by_url', keyPath: 'url' }
    ]
  },
  config: {
    keyPath: 'key',
    indices: []
  }
};

function createDatabase(db: IDBDatabase, tx: IDBTransaction | null): void {
  Object.entries(TableSchemas).forEach(([storeName, schema]) => {
    let store: IDBObjectStore;
    if (!db.objectStoreNames.contains(storeName)) {
      store = db.createObjectStore(storeName, { keyPath: schema.keyPath });
    } else if (tx) {
      store = tx.objectStore(storeName);
    } else {
      return;
    }

    schema.indices.forEach(idx => {
      if (!store.indexNames.contains(idx.name)) {
        store.createIndex(idx.name, idx.keyPath, idx.options);
      }
    });
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => {
      dbPromise = undefined as any;
      console.error(req.error);
      reject(req.error);
    };
    req.onblocked = () => console.error('IndexedDB open blocked');
    req.onupgradeneeded = () => {
      createDatabase(req.result, req.transaction);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => { dbPromise = undefined as any; };
      db.onversionchange = () => {
        db.close();
        dbPromise = undefined as any;
      };
      resolve(db);
    };
  });
}

let dbPromise: Promise<IDBDatabase>;

export function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

export function resetDbConnection(): void {
  dbPromise = undefined as any;
}

export function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('IndexedDB delete blocked');
  });
}

export async function getRow<T extends Store>(storeName: T, key: IDBValidKey | IDBKeyRange): Promise<LocalSchema[T] | undefined> {
  let db = await getDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const req = store.get(key as any);
  const res = await reqToPromise(req);
  return res as LocalSchema[T] | undefined;
}

export async function putRow<T extends Store>(storeName: T, value: LocalSchema[T]): Promise<void> {
  let db = await getDB();
  try {
    const schema = TableSchemas[String(storeName)];
    if (schema && typeof schema.keyPath === 'string') {
      const kp = schema.keyPath as string;
      const v = value as any;
      if (v[kp] === undefined || v[kp] === null) {
        v[kp] = Date.now().toString();
      }
    }
  } catch (e) { /* ignore */ }

  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName as any);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    try {
      try { console.debug('indexedDB.putRow ->', storeName, value); } catch (e) { /* ignore */ }
      const req = store.put(value as any);
      req.onerror = () => reject(req.error);
    } catch (e) {
      try { console.error('indexedDB.putRow error ->', storeName, e); } catch (er) { /* ignore */ }
      reject(e);
    }
  });
}

export async function deleteRow<T extends Store>(storeName: T, key: IDBValidKey | IDBKeyRange): Promise<void> {
  let db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName as any);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    try {
      const req = store.delete(key as any);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

export async function getAllRows<T extends Store>(storeName: T): Promise<LocalSchema[T][]> {
  let db = await getDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName as any);
  const req = store.getAll();
  const res = await reqToPromise(req);
  return res as LocalSchema[T][];
}

export async function getConfig(key: string): Promise<string | undefined> {
  const db = await getDB();
  const tx = db.transaction('config', 'readonly');
  const store = tx.objectStore('config');
  const req = store.get(key);
  const res = await reqToPromise(req);
  return res ? (res as any).value : undefined;
}

export async function setConfig(key: string, value: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('config', 'readwrite');
  const store = tx.objectStore('config');
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    store.put({ key, value });
  });
}

export async function queryIndex<T extends Store, R = any>(
  storeName: T,
  indexName: string,
  range?: IDBKeyRange | IDBValidKey | boolean,
  direction: IDBCursorDirection = 'next'
): Promise<R[]> {
  let db = await getDB();
  const tx = db.transaction(storeName as any, 'readonly');
  const store = tx.objectStore(storeName as any);
  const idx = (store as any).index(indexName);

  if (range === null || typeof range === 'boolean') {
    const matchValue = range;
    const fieldPath = idx.keyPath as string;
    const req = store.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const all = req.result as any[];
        const results = all.filter(val => val && val[fieldPath] === matchValue) as R[];
        if (direction === 'prev' || direction === 'prevunique') results.reverse();
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  const cursorRange = range === undefined ? null : range as IDBValidKey | IDBKeyRange;
  const req = idx.openCursor(cursorRange, direction);
  const results: R[] = [];
  return new Promise((resolve, reject) => {
    req.onsuccess = (ev) => {
      const cursor = (ev.target as IDBRequest).result as IDBCursorWithValue | null;
      if (!cursor) return resolve(results);
      results.push(cursor.value as R);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export default {
  getRow,
  putRow,
  deleteRow,
  getAllRows,
  queryIndex,
  getConfig,
  setConfig,
  deleteDatabase,
  getDB,
};
