var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
/// <reference lib="webworker" />
/* Service Worker (TypeScript) - compiled to public/sw.js via `npm run build:sw` */
var CACHE_NAME = 'study-space-v1';
var FRAMES_CACHE = 'frames-cache-v1';
var SNAPSHOTS_CACHE = 'snapshots-cache-v1';
var PRECACHE_URLS = ['/offline.html'];
// Narrow the global `self` to a ServiceWorkerGlobalScope for service-worker-specific APIs
var sw = self;
sw.addEventListener('install', function (event) {
    console.log('Service worker installing');
    // Precache essential offline assets and activate immediately
    event.waitUntil((function () { return __awaiter(_this, void 0, void 0, function () {
        var cache, e_1, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, caches.open(CACHE_NAME)];
                case 1:
                    cache = _a.sent();
                    return [4 /*yield*/, cache.addAll(PRECACHE_URLS)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    return [3 /*break*/, 4];
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, sw.skipWaiting()];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 6:
                    e_2 = _a.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); })());
});
sw.addEventListener('activate', function (event) {
    var cacheWhitelist = [CACHE_NAME, FRAMES_CACHE, SNAPSHOTS_CACHE];
    event.waitUntil((function () { return __awaiter(_this, void 0, void 0, function () {
        var keys, e_3, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, caches.keys()];
                case 1:
                    keys = _a.sent();
                    return [4 /*yield*/, Promise.all(keys.map(function (k) { return (cacheWhitelist.includes(k) ? Promise.resolve(true) : caches.delete(k)); }))];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, sw.clients.claim()];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    e_3 = _a.sent();
                    return [3 /*break*/, 6];
                case 6: return [3 /*break*/, 8];
                case 7:
                    e_4 = _a.sent();
                    console.warn('SW activate cleanup failed', e_4);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); })());
});
var actions = {
    updateRemote: 'UPDATE_REMOTE',
    updateRemoteResult: 'UPDATE_REMOTE_RESULT',
    updateRemoteError: 'UPDATE_REMOTE_ERROR',
    registerSync: 'REGISTER_SYNC',
    backgroundSync: 'BACKGROUND_SYNC'
};
function openDB() {
    return new Promise(function (resolve, reject) {
        try {
            var req_1 = indexedDB.open('annotation-db', 1);
            req_1.onupgradeneeded = function () {
                var db = req_1.result;
                var TableSchemas = {
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
                Object.entries(TableSchemas).forEach(function (_a) {
                    var storeName = _a[0], schema = _a[1];
                    var store;
                    if (!db.objectStoreNames.contains(storeName)) {
                        store = db.createObjectStore(storeName, { keyPath: schema.keyPath });
                    }
                    else {
                        try {
                            var tx = req_1.transaction;
                            store = tx ? tx.objectStore(storeName) : undefined;
                        }
                        catch (e) {
                            store = undefined;
                        }
                    }
                    if (store) {
                        (schema.indices || []).forEach(function (idx) {
                            try {
                                if (!store.indexNames.contains(idx.name)) {
                                    store.createIndex(idx.name, idx.keyPath, idx.options);
                                }
                            }
                            catch (e) { /* ignore */ }
                        });
                    }
                });
            };
            req_1.onsuccess = function () { return resolve(req_1.result); };
            req_1.onerror = function () { return reject(req_1.error); };
        }
        catch (e) {
            reject(e);
        }
    });
}
function getAllOperations() {
    var _this = this;
    return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
        var db, tx, store, req_2, e_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, openDB()];
                case 1:
                    db = _a.sent();
                    tx = db.transaction('operations', 'readonly');
                    store = tx.objectStore('operations');
                    req_2 = store.getAll();
                    req_2.onsuccess = function () { return resolve(req_2.result || []); };
                    req_2.onerror = function () { return reject(req_2.error); };
                    return [3 /*break*/, 3];
                case 2:
                    e_5 = _a.sent();
                    reject(e_5);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
function putOperation(op) {
    var _this = this;
    return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
        var db, tx, store, req_3, e_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, openDB()];
                case 1:
                    db = _a.sent();
                    tx = db.transaction('operations', 'readwrite');
                    store = tx.objectStore('operations');
                    req_3 = store.put(op);
                    req_3.onsuccess = function () { return resolve(); };
                    req_3.onerror = function () { return reject(req_3.error); };
                    return [3 /*break*/, 3];
                case 2:
                    e_6 = _a.sent();
                    reject(e_6);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
function notifyClients(message) {
    return __awaiter(this, void 0, void 0, function () {
        var clients, _i, clients_1, c, e_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, sw.clients.matchAll()];
                case 1:
                    clients = _a.sent();
                    for (_i = 0, clients_1 = clients; _i < clients_1.length; _i++) {
                        c = clients_1[_i];
                        try {
                            c.postMessage(message);
                        }
                        catch (e) { /* ignore */ }
                    }
                    return [3 /*break*/, 3];
                case 2:
                    e_7 = _a.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function processPendingOperations() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var ops, pending, batch, _loop_1, _i, batch_1, op;
        if (limit === void 0) { limit = 50; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('SW: processing pending operations');
                    return [4 /*yield*/, getAllOperations()];
                case 1:
                    ops = _a.sent();
                    pending = (ops || []).filter(function (o) { return !o.processed; });
                    if (!pending.length)
                        return [2 /*return*/];
                    pending.sort(function (a, b) { return (Number(a.created_at) || 0) - (Number(b.created_at) || 0); });
                    batch = pending.slice(0, limit);
                    _loop_1 = function (op) {
                        var res, e_8, body, res, e_9, res, e_10, url, db, rtx, store, req_4, e_11, body, res, e_12, body, res, e_13, url, db, rtx, store, req_5, e_14, res, e_15, id, res, e_16, e_17, err_1, e_18;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 48, , 54]);
                                    if (!(op.op_type === 'insert')) return [3 /*break*/, 15];
                                    if (!(op.entity === 'pages')) return [3 /*break*/, 5];
                                    _b.label = 1;
                                case 1:
                                    _b.trys.push([1, 3, , 4]);
                                    console.debug('SW: processing insert pages', op.payload);
                                    return [4 /*yield*/, fetch('/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) })];
                                case 2:
                                    res = _b.sent();
                                    console.debug('SW: insert pages response', res.status, res.ok);
                                    return [3 /*break*/, 4];
                                case 3:
                                    e_8 = _b.sent();
                                    console.warn('SW: insert pages fetch failed', e_8);
                                    throw e_8;
                                case 4: return [3 /*break*/, 14];
                                case 5:
                                    if (!(op.entity === 'annotations')) return [3 /*break*/, 10];
                                    body = {
                                        url: op.payload.page_id,
                                        text: op.payload.text,
                                        html: op.payload.html,
                                        color: op.payload.color,
                                        comment: op.payload.comment,
                                        position: op.payload.position,
                                    };
                                    _b.label = 6;
                                case 6:
                                    _b.trys.push([6, 8, , 9]);
                                    console.debug('SW: processing insert annotation', body);
                                    return [4 /*yield*/, fetch('/api/annotations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })];
                                case 7:
                                    res = _b.sent();
                                    console.debug('SW: insert annotation response', res.status, res.ok);
                                    return [3 /*break*/, 9];
                                case 8:
                                    e_9 = _b.sent();
                                    console.warn('SW: insert annotation fetch failed', e_9);
                                    throw e_9;
                                case 9: return [3 /*break*/, 14];
                                case 10:
                                    if (!(op.entity === 'websites')) return [3 /*break*/, 14];
                                    _b.label = 11;
                                case 11:
                                    _b.trys.push([11, 13, , 14]);
                                    console.debug('SW: processing insert website', op.payload);
                                    return [4 /*yield*/, fetch('/api/websites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) })];
                                case 12:
                                    res = _b.sent();
                                    console.debug('SW: insert website response', res.status, res.ok);
                                    return [3 /*break*/, 14];
                                case 13:
                                    e_10 = _b.sent();
                                    console.warn('SW: insert website fetch failed', e_10);
                                    throw e_10;
                                case 14: return [3 /*break*/, 43];
                                case 15:
                                    if (!(op.op_type === 'update')) return [3 /*break*/, 30];
                                    if (!(op.entity === 'pages')) return [3 /*break*/, 25];
                                    url = (op.payload && op.payload.url) || undefined;
                                    if (!(!url && op.payload && op.payload.id)) return [3 /*break*/, 20];
                                    _b.label = 16;
                                case 16:
                                    _b.trys.push([16, 19, , 20]);
                                    return [4 /*yield*/, openDB()];
                                case 17:
                                    db = _b.sent();
                                    rtx = db.transaction('pages', 'readonly');
                                    store = rtx.objectStore('pages');
                                    req_4 = store.get(op.payload.id);
                                    return [4 /*yield*/, new Promise(function (res, rej) { req_4.onsuccess = function () { return res(req_4.result ? req_4.result.url : undefined); }; req_4.onerror = function () { return rej(req_4.error); }; })];
                                case 18:
                                    url = _b.sent();
                                    return [3 /*break*/, 20];
                                case 19:
                                    e_11 = _b.sent();
                                    return [3 /*break*/, 20];
                                case 20:
                                    body = __assign({ url: url }, (op.payload.changes || {}));
                                    _b.label = 21;
                                case 21:
                                    _b.trys.push([21, 23, , 24]);
                                    console.debug('SW: processing update pages', body);
                                    return [4 /*yield*/, fetch('/api/pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })];
                                case 22:
                                    res = _b.sent();
                                    console.debug('SW: update pages response', res.status, res.ok);
                                    return [3 /*break*/, 24];
                                case 23:
                                    e_12 = _b.sent();
                                    console.warn('SW: update pages fetch failed', e_12);
                                    throw e_12;
                                case 24: return [3 /*break*/, 29];
                                case 25:
                                    if (!(op.entity === 'annotations')) return [3 /*break*/, 29];
                                    body = __assign({ id: op.payload.id }, (op.payload.changes || {}));
                                    _b.label = 26;
                                case 26:
                                    _b.trys.push([26, 28, , 29]);
                                    console.debug('SW: processing update annotation', body);
                                    return [4 /*yield*/, fetch('/api/annotations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })];
                                case 27:
                                    res = _b.sent();
                                    console.debug('SW: update annotation response', res.status, res.ok);
                                    return [3 /*break*/, 29];
                                case 28:
                                    e_13 = _b.sent();
                                    console.warn('SW: update annotation fetch failed', e_13);
                                    throw e_13;
                                case 29: return [3 /*break*/, 43];
                                case 30:
                                    if (!(op.op_type === 'delete')) return [3 /*break*/, 43];
                                    if (!(op.entity === 'pages')) return [3 /*break*/, 39];
                                    url = (op.payload && op.payload.url) || undefined;
                                    if (!(!url && op.payload && op.payload.id)) return [3 /*break*/, 35];
                                    _b.label = 31;
                                case 31:
                                    _b.trys.push([31, 34, , 35]);
                                    return [4 /*yield*/, openDB()];
                                case 32:
                                    db = _b.sent();
                                    rtx = db.transaction('pages', 'readonly');
                                    store = rtx.objectStore('pages');
                                    req_5 = store.get(op.payload.id);
                                    return [4 /*yield*/, new Promise(function (res, rej) { req_5.onsuccess = function () { return res(req_5.result ? req_5.result.url : undefined); }; req_5.onerror = function () { return rej(req_5.error); }; })];
                                case 33:
                                    url = _b.sent();
                                    return [3 /*break*/, 35];
                                case 34:
                                    e_14 = _b.sent();
                                    return [3 /*break*/, 35];
                                case 35:
                                    _b.trys.push([35, 37, , 38]);
                                    console.debug('SW: processing delete page', url);
                                    return [4 /*yield*/, fetch("/api/pages?url=".concat(encodeURIComponent(url || '')), { method: 'DELETE' })];
                                case 36:
                                    res = _b.sent();
                                    console.debug('SW: delete page response', res.status, res.ok);
                                    return [3 /*break*/, 38];
                                case 37:
                                    e_15 = _b.sent();
                                    console.warn('SW: delete page fetch failed', e_15);
                                    throw e_15;
                                case 38: return [3 /*break*/, 43];
                                case 39:
                                    if (!(op.entity === 'annotations')) return [3 /*break*/, 43];
                                    id = op.payload.id;
                                    _b.label = 40;
                                case 40:
                                    _b.trys.push([40, 42, , 43]);
                                    console.debug('SW: processing delete annotation', id);
                                    return [4 /*yield*/, fetch("/api/annotations?id=".concat(encodeURIComponent(id)), { method: 'DELETE' })];
                                case 41:
                                    res = _b.sent();
                                    console.debug('SW: delete annotation response', res.status, res.ok);
                                    return [3 /*break*/, 43];
                                case 42:
                                    e_16 = _b.sent();
                                    console.warn('SW: delete annotation fetch failed', e_16);
                                    throw e_16;
                                case 43:
                                    _b.trys.push([43, 45, , 46]);
                                    op.processed = true;
                                    op.sent_at = Date.now();
                                    return [4 /*yield*/, putOperation(op)];
                                case 44:
                                    _b.sent();
                                    return [3 /*break*/, 46];
                                case 45:
                                    e_17 = _b.sent();
                                    return [3 /*break*/, 46];
                                case 46: return [4 /*yield*/, notifyClients({ type: actions.updateRemoteResult, op: op })];
                                case 47:
                                    _b.sent();
                                    return [3 /*break*/, 54];
                                case 48:
                                    err_1 = _b.sent();
                                    _b.label = 49;
                                case 49:
                                    _b.trys.push([49, 51, , 52]);
                                    op.attempts = (op.attempts || 0) + 1;
                                    op.last_error = String(err_1);
                                    return [4 /*yield*/, putOperation(op)];
                                case 50:
                                    _b.sent();
                                    return [3 /*break*/, 52];
                                case 51:
                                    e_18 = _b.sent();
                                    return [3 /*break*/, 52];
                                case 52: return [4 /*yield*/, notifyClients({ type: actions.updateRemoteError, op: op, error: String(err_1) })];
                                case 53:
                                    _b.sent();
                                    if (err_1 && ((err_1.name === 'TypeError') || String(err_1).includes('Failed to fetch')))
                                        throw err_1;
                                    return [3 /*break*/, 54];
                                case 54: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, batch_1 = batch;
                    _a.label = 2;
                case 2:
                    if (!(_i < batch_1.length)) return [3 /*break*/, 5];
                    op = batch_1[_i];
                    return [5 /*yield**/, _loop_1(op)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/];
            }
        });
    });
}
sw.addEventListener('message', function (event) {
    var _a;
    var data = event.data;
    if (!data || typeof data.type !== 'string')
        return;
    if (data.type === actions.registerSync) {
        try {
            (_a = sw.registration.sync) === null || _a === void 0 ? void 0 : _a.register('annotation-sync');
        }
        catch (e) { /* ignore */ }
        return;
    }
    if (data.type === actions.backgroundSync) {
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var err_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 4]);
                        return [4 /*yield*/, processPendingOperations()];
                    case 1:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 2:
                        err_2 = _b.sent();
                        try {
                            (_a = sw.registration.sync) === null || _a === void 0 ? void 0 : _a.register('annotation-sync');
                        }
                        catch (e) { /* ignore */ }
                        return [4 /*yield*/, notifyClients({ type: actions.updateRemoteError, error: String(err_2), op: { backgroundSync: true } })];
                    case 3:
                        _b.sent();
                        return [2 /*return*/];
                    case 4: return [4 /*yield*/, notifyClients({ type: actions.updateRemoteResult, op: { backgroundSync: true } })];
                    case 5:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); })();
        return;
    }
    if (data.type === actions.updateRemote) {
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var e_19;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, processPendingOperations()];
                    case 1:
                        _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_19 = _b.sent();
                        try {
                            (_a = sw.registration.sync) === null || _a === void 0 ? void 0 : _a.register('annotation-sync');
                        }
                        catch (er) { /* ignore */ }
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); })();
        return;
    }
});
sw.addEventListener('sync', function (ev) {
    if (!ev || ev.tag !== 'annotation-sync')
        return;
    try {
        ev.waitUntil(processPendingOperations());
    }
    catch (e) { /* ignore */ }
});
sw.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET')
        return;
    var url = new URL(request.url);
    // Navigation requests: network-first with offline fallback
    if (request.mode === 'navigate' || ((request.headers.get('accept') || '').includes('text/html'))) {
        event.respondWith((function () { return __awaiter(_this, void 0, void 0, function () {
            var networkResponse, err_3, cache, cached, offline, e_20;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 9]);
                        return [4 /*yield*/, fetch(request)];
                    case 1:
                        networkResponse = _a.sent();
                        return [2 /*return*/, networkResponse];
                    case 2:
                        err_3 = _a.sent();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 7, , 8]);
                        return [4 /*yield*/, caches.open(CACHE_NAME)];
                    case 4:
                        cache = _a.sent();
                        return [4 /*yield*/, cache.match(request)];
                    case 5:
                        cached = _a.sent();
                        if (cached)
                            return [2 /*return*/, cached];
                        return [4 /*yield*/, cache.match('/offline.html')];
                    case 6:
                        offline = _a.sent();
                        if (offline)
                            return [2 /*return*/, offline];
                        return [3 /*break*/, 8];
                    case 7:
                        e_20 = _a.sent();
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, new Response('', { status: 503 })];
                    case 9: return [2 /*return*/];
                }
            });
        }); })());
        return;
    }
    // Snapshot-scoped asset proxy
    if (url.pathname.startsWith('/__snapshot_asset__/')) {
        event.respondWith((function () { return __awaiter(_this, void 0, void 0, function () {
            var cache, direct, e_21, encoded, firstSlash, encodedUrl, originalUrl, cached, keys, _i, keys_1, k, e_22, e_23, e_24;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 18, , 19]);
                        return [4 /*yield*/, caches.open(SNAPSHOTS_CACHE)];
                    case 1:
                        cache = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, cache.match(request)];
                    case 3:
                        direct = _a.sent();
                        if (direct) {
                            console.debug('SW: serving snapshot asset direct match', request.url);
                            return [2 /*return*/, direct];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        e_21 = _a.sent();
                        return [3 /*break*/, 5];
                    case 5:
                        encoded = url.pathname.replace(/^\/__snapshot_asset__\//, '');
                        firstSlash = encoded.indexOf('/');
                        encodedUrl = encoded;
                        if (firstSlash >= 0)
                            encodedUrl = encoded.slice(firstSlash + 1);
                        originalUrl = null;
                        try {
                            originalUrl = decodeURIComponent(encodedUrl);
                        }
                        catch (e) {
                            originalUrl = encodedUrl;
                        }
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 13, , 14]);
                        return [4 /*yield*/, cache.match(originalUrl)];
                    case 7:
                        cached = _a.sent();
                        if (!!cached) return [3 /*break*/, 12];
                        return [4 /*yield*/, cache.keys()];
                    case 8:
                        keys = _a.sent();
                        _i = 0, keys_1 = keys;
                        _a.label = 9;
                    case 9:
                        if (!(_i < keys_1.length)) return [3 /*break*/, 12];
                        k = keys_1[_i];
                        if (!(k && k.url === originalUrl)) return [3 /*break*/, 11];
                        return [4 /*yield*/, cache.match(k)];
                    case 10:
                        cached = _a.sent();
                        if (cached)
                            return [3 /*break*/, 12];
                        _a.label = 11;
                    case 11:
                        _i++;
                        return [3 /*break*/, 9];
                    case 12:
                        if (cached) {
                            console.debug('SW: serving snapshot asset from cache', originalUrl);
                            return [2 /*return*/, cached];
                        }
                        return [3 /*break*/, 14];
                    case 13:
                        e_22 = _a.sent();
                        return [3 /*break*/, 14];
                    case 14:
                        _a.trys.push([14, 16, , 17]);
                        return [4 /*yield*/, fetch(originalUrl || request.url)];
                    case 15: return [2 /*return*/, _a.sent()];
                    case 16:
                        e_23 = _a.sent();
                        return [2 /*return*/, new Response('', { status: 503 })];
                    case 17: return [3 /*break*/, 19];
                    case 18:
                        e_24 = _a.sent();
                        return [2 /*return*/, new Response('', { status: 503 })];
                    case 19: return [2 /*return*/];
                }
            });
        }); })());
        return;
    }
    // Prefer frames cache for proxied site assets
    if (url.pathname.startsWith('/_proxy/')) {
        event.respondWith((function () { return __awaiter(_this, void 0, void 0, function () {
            var cache, direct, any, res, e_25, e_26;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 9, , 10]);
                        return [4 /*yield*/, caches.open(FRAMES_CACHE)];
                    case 1:
                        cache = _a.sent();
                        return [4 /*yield*/, cache.match(request)];
                    case 2:
                        direct = _a.sent();
                        if (direct)
                            return [2 /*return*/, direct];
                        return [4 /*yield*/, caches.match(request)];
                    case 3:
                        any = _a.sent();
                        if (any)
                            return [2 /*return*/, any];
                        return [4 /*yield*/, fetch(request)];
                    case 4:
                        res = _a.sent();
                        if (!(res && res.ok)) return [3 /*break*/, 8];
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, cache.put(request, res.clone())];
                    case 6:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        e_25 = _a.sent();
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, res];
                    case 9:
                        e_26 = _a.sent();
                        return [2 /*return*/, fetch(request)];
                    case 10: return [2 /*return*/];
                }
            });
        }); })());
        return;
    }
    // Cache common static assets
    var staticExts = /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/;
    if (url.pathname.startsWith('/_next/static/') || staticExts.test(url.pathname)) {
        event.respondWith((function () { return __awaiter(_this, void 0, void 0, function () {
            var cached, response, cache, e_27, e_28;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 8, , 9]);
                        return [4 /*yield*/, caches.match(request)];
                    case 1:
                        cached = _a.sent();
                        if (cached)
                            return [2 /*return*/, cached];
                        return [4 /*yield*/, fetch(request)];
                    case 2:
                        response = _a.sent();
                        if (!response || response.status !== 200)
                            return [2 /*return*/, response];
                        return [4 /*yield*/, caches.open(CACHE_NAME)];
                    case 3:
                        cache = _a.sent();
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, cache.put(request, response.clone())];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        e_27 = _a.sent();
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/, response];
                    case 8:
                        e_28 = _a.sent();
                        return [2 /*return*/, new Response('', { status: 503 })];
                    case 9: return [2 /*return*/];
                }
            });
        }); })());
        return;
    }
});
