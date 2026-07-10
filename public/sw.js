// node_modules/@mintcd/sync-engine/packages/cli/bin/templates/sw/state.ts
var SW_SELF = self;
var DB_NAME = "annotation-db";
var DB_VERSION = 1;
var API_BASE = "/api";
var SYNC_TAG = "sync-engine-sync";
var MAX_BATCH_SIZE = 50;
var TABLE_SCHEMAS = JSON.parse('{\n  "pages": {\n    "keyPath": "id",\n    "indices": [\n      {\n        "name": "url",\n        "keyPath": "url"\n      },\n      {\n        "name": "title",\n        "keyPath": "title"\n      },\n      {\n        "name": "number_of_scripts",\n        "keyPath": "number_of_scripts"\n      },\n      {\n        "name": "created_at",\n        "keyPath": "created_at"\n      },\n      {\n        "name": "updated_at",\n        "keyPath": "updated_at"\n      },\n      {\n        "name": "number_of_annotations",\n        "keyPath": "number_of_annotations"\n      }\n    ]\n  },\n  "websites": {\n    "keyPath": "id",\n    "indices": [\n      {\n        "name": "origin",\n        "keyPath": "origin"\n      },\n      {\n        "name": "created_at",\n        "keyPath": "created_at"\n      },\n      {\n        "name": "updated_at",\n        "keyPath": "updated_at"\n      }\n    ]\n  },\n  "site_cookies": {\n    "keyPath": "site_id",\n    "indices": [\n      {\n        "name": "cookie",\n        "keyPath": "cookie"\n      },\n      {\n        "name": "updated_at",\n        "keyPath": "updated_at"\n      }\n    ]\n  },\n  "annotations": {\n    "keyPath": "id",\n    "indices": [\n      {\n        "name": "page_id",\n        "keyPath": "page_id"\n      },\n      {\n        "name": "text",\n        "keyPath": "text"\n      },\n      {\n        "name": "html",\n        "keyPath": "html"\n      },\n      {\n        "name": "created_at",\n        "keyPath": "created_at"\n      },\n      {\n        "name": "updated_at",\n        "keyPath": "updated_at"\n      },\n      {\n        "name": "color",\n        "keyPath": "color"\n      },\n      {\n        "name": "comment",\n        "keyPath": "comment"\n      }\n    ]\n  },\n  "operations": {\n    "keyPath": "id",\n    "indices": [\n      {\n        "name": "by_processed",\n        "keyPath": "processed"\n      },\n      {\n        "name": "by_client",\n        "keyPath": [\n          "client_id",\n          "client_op_id"\n        ]\n      },\n      {\n        "name": "by_entity",\n        "keyPath": "entity"\n      },\n      {\n        "name": "by_created_at",\n        "keyPath": "created_at"\n      }\n    ]\n  },\n  "config": {\n    "keyPath": "key",\n    "indices": []\n  }\n}');

// node_modules/@mintcd/sync-engine/packages/core/dist/shared/index.js
var N = { updateRemote: "SYNC_ENGINE_UPDATE_REMOTE", remoteQuery: "SYNC_ENGINE_REMOTE_QUERY", remoteQueryResult: "SYNC_ENGINE_REMOTE_QUERY_RESULT", remoteQueryError: "SYNC_ENGINE_REMOTE_QUERY_ERROR", syncNow: "SYNC_ENGINE_SYNC_NOW", syncNowResult: "SYNC_ENGINE_SYNC_NOW_RESULT", syncNowError: "SYNC_ENGINE_SYNC_NOW_ERROR", databaseChanged: "SYNC_ENGINE_DATABASE_CHANGED", syncStarted: "SYNC_ENGINE_SYNC_STARTED", syncCompleted: "SYNC_ENGINE_SYNC_COMPLETED", syncFailed: "SYNC_ENGINE_SYNC_FAILED", registerSync: "SYNC_ENGINE_REGISTER_SYNC", backgroundSync: "SYNC_ENGINE_BACKGROUND_SYNC" };

// node_modules/@mintcd/sync-engine/packages/cli/bin/templates/sw/primaryKey.ts
function assertPrimaryKeyNotWritten(table, records, action, tableSchemas) {
  const primaryKey = tableSchemas[table]?.keyPath;
  if (typeof primaryKey !== "string" || !primaryKey) {
    throw new Error(`Cannot ${action} ${table}: table has no primary key`);
  }
  for (const record of records) {
    if (record && typeof record === "object" && Object.prototype.hasOwnProperty.call(record, primaryKey)) {
      throw new Error(`Cannot ${action} primary key "${primaryKey}" in table "${table}"; it is generated automatically`);
    }
  }
}

// node_modules/@mintcd/sync-engine/packages/cli/bin/templates/sw/db.ts
var dbPromise;
function createDatabase(db, tx) {
  for (const [storeName, schema] of Object.entries(TABLE_SCHEMAS)) {
    let store;
    if (!db.objectStoreNames.contains(storeName)) {
      store = db.createObjectStore(storeName, { keyPath: schema.keyPath });
    } else if (tx) {
      store = tx.objectStore(storeName);
    } else {
      continue;
    }
    if (!store) continue;
    for (const index of schema.indices) {
      if (!store.indexNames.contains(index.name)) {
        store.createIndex(index.name, index.keyPath, index.options);
      }
    }
  }
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      dbPromise = void 0;
      reject(request.error);
    };
    request.onupgradeneeded = () => createDatabase(request.result, request.transaction);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = void 0;
      };
      resolve(db);
    };
  });
}
function getDB() {
  if (!dbPromise) {
    dbPromise = openDatabase();
  }
  return dbPromise;
}
function isClosingConnectionError(error) {
  return error instanceof DOMException && error.name === "InvalidStateError";
}
async function openTransaction(storeNames, mode) {
  const db = await getDB();
  try {
    return db.transaction(storeNames, mode);
  } catch (error) {
    if (!isClosingConnectionError(error)) throw error;
    db.close();
    dbPromise = void 0;
    const reopened = await getDB();
    return reopened.transaction(storeNames, mode);
  }
}
async function putRow(storeName, value) {
  const schema = TABLE_SCHEMAS[storeName];
  if (schema && typeof schema.keyPath === "string" && (value[schema.keyPath] === void 0 || value[schema.keyPath] === null)) {
    value[schema.keyPath] = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  const tx = await openTransaction(storeName, "readwrite");
  tx.objectStore(storeName).put(value);
  await transactionDone(tx);
}
async function getConfig(key) {
  const tx = await openTransaction("config", "readonly");
  const row = await requestToPromise(tx.objectStore("config").get(key));
  return row ? row.value : void 0;
}
async function setConfig(key, value) {
  await putRow("config", { key, value });
}
function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function getRow(storeName, key) {
  const tx = await openTransaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const req = store.get(key);
  return requestToPromise(req);
}
async function deleteRow(storeName, key) {
  const tx = await openTransaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(key);
  await transactionDone(tx);
}
async function getAllRows(storeName) {
  const tx = await openTransaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const req = store.getAll();
  return requestToPromise(req);
}
async function queryIndex(storeName, indexName, range) {
  const tx = await openTransaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const idx = store.index(indexName);
  if (range === null || typeof range === "boolean") {
    const matchValue = range;
    const fieldPath = idx.keyPath;
    const req2 = store.getAll();
    const rows = await requestToPromise(req2);
    return rows.filter((val) => val?.[fieldPath] === matchValue);
  }
  const cursorRange = range === void 0 ? null : range;
  const req = idx.openCursor(cursorRange);
  const results = [];
  return new Promise((resolve, reject) => {
    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (!cursor) {
        resolve(results);
        return;
      }
      results.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// node_modules/@mintcd/sync-engine/packages/cli/bin/templates/sw/sync.ts
var drainPromise;
var syncNowPromise;
async function executeLocalQuery(rawAst) {
  if (!rawAst || typeof rawAst !== "object") {
    throw new Error("Invalid query payload");
  }
  const ast = rawAst;
  const table = ast.table;
  const where = ast.where;
  let candidates = [];
  const now = Date.now();
  switch (ast.action) {
    case "SELECT": {
      candidates = await fetchCandidates(ast);
      const filtered = candidates.filter((r) => matchWhere(r, where));
      return ast.action === "SELECT" && ast.select && ast.select.length ? filtered.map((r) => {
        const out = {};
        for (const f of ast.select) out[f] = r[f];
        return out;
      }) : filtered;
    }
    case "INSERT": {
      const data = ast.insert;
      const rawItems = Array.isArray(data) ? data : [data];
      if (!rawItems.length) return { affected: 0, queued: 0, opIds: [] };
      assertPrimaryKeyNotWritten(table, rawItems, "insert", TABLE_SCHEMAS);
      const prepared = rawItems.map((d) => ({ ...d }));
      await Promise.all(prepared.map((d) => putRow(table, d)));
      const operations = prepared.map((d) => ({
        entity: table,
        op_type: "insert",
        payload: d,
        created_at: now,
        processed: false,
        attempts: 0
      }));
      await Promise.all(operations.map((op) => putRow("operations", op)));
      return {
        affected: prepared.length,
        queued: operations.length,
        opIds: operations.map((op) => String(op.id))
      };
    }
    case "UPDATE": {
      const updates = ast.update || {};
      assertPrimaryKeyNotWritten(table, [updates], "update", TABLE_SCHEMAS);
      candidates = await fetchCandidates(ast);
      const toUpdateOriginals = candidates.filter((r) => matchWhere(r, ast.where));
      if (!toUpdateOriginals.length) return { affected: 0, queued: 0, opIds: [] };
      const toUpdate = toUpdateOriginals.map((r) => ({ ...r, ...updates }));
      await Promise.all(toUpdate.map((r) => putRow(table, r)));
      const operations = toUpdate.map((r) => ({
        entity: table,
        op_type: "update",
        payload: { id: r.id, ...updates },
        created_at: now,
        processed: false,
        attempts: 0
      }));
      await Promise.all(operations.map((op) => putRow("operations", op)));
      return {
        affected: toUpdate.length,
        queued: operations.length,
        opIds: operations.map((op) => String(op.id))
      };
    }
    case "DELETE": {
      candidates = await fetchCandidates(ast);
      const toDelete = candidates.filter((r) => matchWhere(r, ast.where));
      if (!toDelete.length) return { affected: 0, queued: 0, opIds: [] };
      await Promise.all(toDelete.map((r) => getDeleteForId(ast.table, r.id)));
      const operations = toDelete.map((r) => ({
        entity: table,
        op_type: "delete",
        payload: { id: r.id },
        created_at: now,
        processed: false,
        attempts: 0
      }));
      await Promise.all(operations.map((op) => putRow("operations", op)));
      return {
        affected: toDelete.length,
        queued: operations.length,
        opIds: operations.map((op) => String(op.id))
      };
    }
    default:
      throw new Error(`Unsupported query action: ${ast.action}`);
  }
}
async function drainPendingOperations(reason = "push") {
  if (drainPromise) return drainPromise;
  drainPromise = (async () => {
    const syncId = createSyncId(reason);
    await notifyClients({ type: N.syncStarted, syncId, reason });
    let ops = [];
    let sent = 0;
    const errors = [];
    const touchedTables = /* @__PURE__ */ new Set();
    try {
      ops = await getPendingOperations(MAX_BATCH_SIZE);
      for (const op of ops) {
        const entity = String(op.entity || "");
        if (entity) touchedTables.add(entity);
        try {
          await sendOperation(op);
          await markOperationProcessed(op);
          sent++;
        } catch (error) {
          await markOperationFailed(op, error);
          errors.push({
            opId: op.id || op.client_op_id || "unknown",
            error: toErrorMessage(error)
          });
          if (isTransientError(error)) {
            await registerBackgroundSync();
            throw error;
          }
        }
      }
      const result = {
        sent,
        pending: Math.max(ops.length - sent, 0),
        errors,
        tables: Array.from(touchedTables)
      };
      await notifyClients({
        type: errors.length ? N.syncFailed : N.syncCompleted,
        syncId,
        reason,
        ...result,
        error: errors.length ? `${errors.length} operation(s) failed to sync.` : void 0
      });
      return result;
    } catch (error) {
      await notifyClients({
        type: N.syncFailed,
        syncId,
        reason,
        sent,
        pending: Math.max(ops.length - sent, 0),
        errors,
        tables: Array.from(touchedTables),
        error: toErrorMessage(error)
      });
      throw error;
    }
  })();
  try {
    return await drainPromise;
  } finally {
    drainPromise = void 0;
  }
}
async function pullRemoteOperations() {
  if (syncNowPromise) return syncNowPromise;
  syncNowPromise = (async () => {
    const reason = "pull";
    const syncId = createSyncId(reason);
    await notifyClients({ type: N.syncStarted, syncId, reason });
    try {
      const last = Number(await getConfig("lastRemoteOpsAt") || 0);
      const base = API_BASE.replace(/\/$/, "");
      const response = await fetch(`${base}/operations?since=${encodeURIComponent(String(last))}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        throw new Error(`GET operations failed with ${response.status}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error("Operations endpoint returned a non-array response.");
      }
      let applied = 0;
      let maxAt = last;
      const errors = [];
      const touchedTables = /* @__PURE__ */ new Set();
      for (const rawOperation of payload) {
        const operation = asPayloadRecord(rawOperation);
        try {
          const table = await applyRemoteOperation(operation);
          if (table) {
            touchedTables.add(table);
            applied++;
          }
          const createdAt = Number(operation.created_at) || 0;
          if (createdAt > maxAt) maxAt = createdAt;
        } catch (error) {
          errors.push(toErrorMessage(error));
          break;
        }
      }
      if (maxAt > last) {
        await setConfig("lastRemoteOpsAt", String(maxAt));
      }
      const result = {
        applied,
        errors,
        tables: Array.from(touchedTables)
      };
      if (result.tables.length > 0) {
        await notifyClients({
          type: N.databaseChanged,
          tables: result.tables,
          source: "sync"
        });
      }
      await notifyClients({
        type: errors.length ? N.syncFailed : N.syncCompleted,
        syncId,
        reason,
        ...result,
        error: errors.length ? errors[0] : void 0
      });
      return result;
    } catch (error) {
      await notifyClients({
        type: N.syncFailed,
        syncId,
        reason,
        applied: 0,
        error: toErrorMessage(error)
      });
      throw error;
    }
  })();
  try {
    return await syncNowPromise;
  } finally {
    syncNowPromise = void 0;
  }
}
async function applyRemoteOperation(operation) {
  const entity = typeof operation.entity === "string" ? operation.entity : "";
  if (!entity) throw new Error("Remote operation is missing its entity.");
  const opType = String(operation.op_type || "").toLowerCase();
  const payload = asPayloadRecord(normalizePayload(operation.payload));
  if (opType === "insert") {
    const data = payload.action === "insert" && payload.data ? asPayloadRecord(payload.data) : payload;
    await putRow(entity, data);
    return entity;
  }
  if (opType === "update") {
    const id = payload.id ?? payload.ID;
    if (id !== void 0 && id !== null) {
      const row = asPayloadRecord(await getRow(entity, id));
      const changes = payload.action === "update" && payload.changes ? asPayloadRecord(payload.changes) : payload;
      await putRow(entity, { ...row, ...changes });
      return entity;
    }
  }
  if (opType === "delete" && payload.id !== void 0 && payload.id !== null) {
    await deleteRow(entity, payload.id);
    return entity;
  }
  return void 0;
}
async function sendOperation(op) {
  const entity = String(op.entity || "");
  if (!entity || entity === "operations") return;
  const opType = String(op.op_type || "").toLowerCase();
  const payload = asPayloadRecord(normalizePayload(op.payload));
  const clientId = op.client_id || await getClientId();
  const clientOpId = op.client_op_id || op.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (opType === "insert") {
    const data = payload.action === "insert" && payload.data ? payload.data : payload;
    await apiRequest(entity, "POST", { data, client_id: clientId, client_op_id: clientOpId });
    return;
  }
  if (opType === "update") {
    const id = payload.id;
    const changes = payload.action === "update" && payload.changes ? asPayloadRecord(payload.changes) : payload;
    if (id === void 0 || id === null) throw new Error(`Cannot sync update for ${entity}: missing id`);
    await apiRequest(entity, "PUT", { data: { ...changes, id }, client_id: clientId, client_op_id: clientOpId });
    return;
  }
  if (opType === "delete") {
    const id = payload.id;
    if (id === void 0 || id === null) throw new Error(`Cannot sync delete for ${entity}: missing id`);
    await apiRequest(entity, "DELETE", { id, client_id: clientId, client_op_id: clientOpId });
    return;
  }
  throw new Error(`Unknown operation type: ${op.op_type}`);
}
async function apiRequest(table, method, body) {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(table)}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${method} ${table} failed with ${response.status}: ${text}`);
  }
  return response.json().catch(() => null);
}
async function getPendingOperations(limit) {
  const tx = await openTransaction("operations", "readonly");
  const store = tx.objectStore("operations");
  const rows = await requestToPromise(store.getAll());
  return rows.filter((op) => op && op.processed !== true && !op.sent_at).sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0)).slice(0, limit);
}
async function markOperationProcessed(op) {
  const next = {
    ...op,
    processed: true,
    sent_at: Date.now(),
    last_error: void 0
  };
  await putRow("operations", next);
}
async function markOperationFailed(op, error) {
  const next = {
    ...op,
    attempts: Number(op.attempts || 0) + 1,
    last_error: toErrorMessage(error)
  };
  await putRow("operations", next);
}
async function getDeleteForId(table, key) {
  const tx = await openTransaction(table, "readwrite");
  const store = tx.objectStore(table);
  await requestToPromise(store.delete(key));
}
async function getClientId() {
  const existing = await getConfig("client_id");
  if (existing) return existing;
  const generated = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await setConfig("client_id", generated);
  return generated;
}
function createSyncId(reason) {
  return `${reason}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function normalizePayload(payload) {
  if (typeof payload !== "string") return payload || {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}
function isTransientError(error) {
  const message = toErrorMessage(error);
  return error instanceof TypeError || /failed to fetch|network|offline|timeout|temporar/i.test(message);
}
async function registerBackgroundSync() {
  try {
    const registration = SW_SELF.registration;
    if (registration.sync?.register) {
      await registration.sync.register(SYNC_TAG);
    }
  } catch {
  }
}
function toErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
async function notifyClients(message) {
  const clients = await SW_SELF.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage(message);
  }
}
function asPayloadRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value;
}
function matchWhere(item, where) {
  if (!where) return true;
  if (where.operator === "AND" && where.where) return where.where.every((c) => matchWhere(item, c));
  if (where.operator === "OR" && where.where) return where.where.some((c) => matchWhere(item, c));
  if (where.operator === "=" && where.field) return item[where.field] === where.value;
  if (where.operator === ">" && where.field) return item[where.field] > where.value;
  if (where.operator === "<" && where.field) return item[where.field] < where.value;
  return false;
}
async function fetchCandidates(ast) {
  const table = ast.table;
  const where = ast.where;
  if (!where) return getAllRows(table);
  if (where.operator === "=" && where.field === "id") {
    return getRow(table, where.value).then((r) => r ? [r] : []);
  }
  if (where.operator === "=" && where.field) {
    try {
      return queryIndex(table, where.field, where.value);
    } catch {
      const all2 = await getAllRows(table);
      return all2.filter((r) => matchWhere(r, where));
    }
  }
  const all = await getAllRows(table);
  return all.filter((r) => matchWhere(r, where));
}

// node_modules/@mintcd/sync-engine/packages/cli/bin/templates/sw/index.ts
self.addEventListener("install", () => {
  SW_SELF.skipWaiting();
});
self.addEventListener("activate", (event) => {
  const activateEvent = event;
  activateEvent.waitUntil?.(SW_SELF.clients.claim());
});
self.addEventListener("message", (event) => {
  const messageEvent = event;
  const data = messageEvent.data;
  if (!data || typeof data.type !== "string") return;
  if (data.type === N.registerSync || data.type === "REGISTER_SYNC") {
    messageEvent.waitUntil?.(registerBackgroundSync());
    return;
  }
  if (data.type === N.updateRemote || data.type === N.backgroundSync || data.type === "UPDATE_REMOTE" || data.type === "BACKGROUND_SYNC") {
    const reason = data.type === N.backgroundSync || data.type === "BACKGROUND_SYNC" ? "background" : "push";
    messageEvent.waitUntil?.(drainPendingOperations(reason).catch(async () => {
      await registerBackgroundSync();
    }));
    return;
  }
  if (data.type === N.syncNow) {
    const requestId = typeof data.requestId === "string" ? data.requestId : "";
    const messageWithSource = messageEvent;
    messageEvent.waitUntil?.(executeSyncNowForClient(requestId, messageWithSource));
    return;
  }
  if (data.type === N.remoteQuery) {
    const requestId = typeof data.requestId === "string" ? data.requestId : "";
    const ast = data.ast;
    const messageWithSource = messageEvent;
    messageEvent.waitUntil?.(executeLocalQueryForClient(requestId, ast, messageWithSource));
  }
});
async function executeLocalQueryForClient(requestId, ast, messageEvent) {
  try {
    const queryAst = ast;
    const isMutation = queryAst.action !== "SELECT";
    const result = await executeLocalQuery(ast);
    let syncTask;
    if (isMutation) {
      const table = typeof queryAst.table === "string" ? queryAst.table : void 0;
      await notifyClients({
        type: N.databaseChanged,
        table,
        tables: table ? [table] : void 0,
        action: queryAst.action,
        ast,
        source: "repo"
      });
      syncTask = drainPendingOperations("push").then(() => void 0).catch(async () => {
        await registerBackgroundSync();
      });
    }
    await sendMessageToSource(messageEvent, {
      type: N.remoteQueryResult,
      requestId,
      ast,
      result
    });
    await syncTask;
  } catch (error) {
    await sendMessageToSource(messageEvent, {
      type: N.remoteQueryError,
      requestId,
      ast,
      error: toErrorMessage(error)
    });
  }
}
async function executeSyncNowForClient(requestId, messageEvent) {
  try {
    const result = await pullRemoteOperations();
    await sendMessageToSource(messageEvent, {
      type: N.syncNowResult,
      requestId,
      result
    });
  } catch (error) {
    await sendMessageToSource(messageEvent, {
      type: N.syncNowError,
      requestId,
      error: toErrorMessage(error)
    });
  }
}
async function sendMessageToSource(messageEvent, payload) {
  const source = messageEvent.source;
  if (source && typeof source.postMessage === "function") {
    try {
      source.postMessage(payload);
      return;
    } catch (error) {
    }
  }
  if (messageEvent.ports?.length && typeof messageEvent.ports[0]?.postMessage === "function") {
    messageEvent.ports[0].postMessage(payload);
    return;
  }
  await notifyClients(payload);
}
self.addEventListener("sync", (event) => {
  const syncEvent = event;
  if (!syncEvent.tag || syncEvent.tag !== SYNC_TAG) return;
  syncEvent.waitUntil?.(drainPendingOperations("background"));
});
