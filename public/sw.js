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
    var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
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
// Narrow the global `self` to a ServiceWorkerGlobalScope for service-worker-specific APIs
var sw = self;
sw.addEventListener('install', function (event) {
    console.log('Service worker installing');
    // Ensure the worker activates immediately
    try {
        event.waitUntil(sw.skipWaiting());
    }
    catch (e) { /* ignore */ }
});
sw.addEventListener('activate', function (event) {
    var cacheWhitelist = [CACHE_NAME, FRAMES_CACHE, SNAPSHOTS_CACHE];
    event.waitUntil((function () {
        return __awaiter(_this, void 0, void 0, function () {
            var keys, e_1, e_2;
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
                        e_1 = _a.sent();
                        return [3 /*break*/, 6];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        e_2 = _a.sent();
                        console.warn('SW activate cleanup failed', e_2);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    })());
});
sw.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET')
        return;
    var url = new URL(request.url);
    // Snapshot-scoped asset proxy
    if (url.pathname.startsWith('/__snapshot_asset__/')) {
        event.respondWith((function () {
            return __awaiter(_this, void 0, void 0, function () {
                var cache, direct, e_3, encoded, firstSlash, encodedUrl, originalUrl, cached, keys, _i, keys_1, k, e_4, e_5, e_6;
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
                            e_3 = _a.sent();
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
                            e_4 = _a.sent();
                            return [3 /*break*/, 14];
                        case 14:
                            _a.trys.push([14, 16, , 17]);
                            return [4 /*yield*/, fetch(originalUrl || request.url)];
                        case 15: return [2 /*return*/, _a.sent()];
                        case 16:
                            e_5 = _a.sent();
                            return [2 /*return*/, new Response('', { status: 503 })];
                        case 17: return [3 /*break*/, 19];
                        case 18:
                            e_6 = _a.sent();
                            return [2 /*return*/, new Response('', { status: 503 })];
                        case 19: return [2 /*return*/];
                    }
                });
            });
        })());
        return;
    }
    // Prefer frames cache for proxied site assets
    if (url.pathname.startsWith('/_proxy/')) {
        event.respondWith((function () {
            return __awaiter(_this, void 0, void 0, function () {
                var cache, direct, any, res, e_7, e_8;
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
                            e_7 = _a.sent();
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/, res];
                        case 9:
                            e_8 = _a.sent();
                            return [2 /*return*/, fetch(request)];
                        case 10: return [2 /*return*/];
                    }
                });
            });
        })());
        return;
    }
    // Cache common static assets
    var staticExts = /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/;
    if (url.pathname.startsWith('/_next/static/') || staticExts.test(url.pathname)) {
        event.respondWith((function () {
            return __awaiter(_this, void 0, void 0, function () {
                var cached, response, cache, e_9, e_10;
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
                            e_9 = _a.sent();
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/, response];
                        case 8:
                            e_10 = _a.sent();
                            return [2 /*return*/, new Response('', { status: 503 })];
                        case 9: return [2 /*return*/];
                    }
                });
            });
        })());
        return;
    }
});
