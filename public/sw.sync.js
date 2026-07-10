var R=self,Q="annotation-db",V=1,M="/api",A="sync-engine-sync",F=50,S=JSON.parse(`{
  "pages": {
    "keyPath": "id",
    "primaryKeyType": "TEXT",
    "indices": [
      {
        "name": "url",
        "keyPath": "url"
      },
      {
        "name": "title",
        "keyPath": "title"
      },
      {
        "name": "number_of_scripts",
        "keyPath": "number_of_scripts"
      },
      {
        "name": "created_at",
        "keyPath": "created_at"
      },
      {
        "name": "updated_at",
        "keyPath": "updated_at"
      },
      {
        "name": "number_of_annotations",
        "keyPath": "number_of_annotations"
      }
    ]
  },
  "websites": {
    "keyPath": "id",
    "primaryKeyType": "TEXT",
    "indices": [
      {
        "name": "origin",
        "keyPath": "origin"
      },
      {
        "name": "created_at",
        "keyPath": "created_at"
      },
      {
        "name": "updated_at",
        "keyPath": "updated_at"
      }
    ]
  },
  "site_cookies": {
    "keyPath": "site_id",
    "primaryKeyType": "TEXT",
    "indices": [
      {
        "name": "cookie",
        "keyPath": "cookie"
      },
      {
        "name": "updated_at",
        "keyPath": "updated_at"
      }
    ]
  },
  "annotations": {
    "keyPath": "id",
    "primaryKeyType": "TEXT",
    "indices": [
      {
        "name": "page_id",
        "keyPath": "page_id"
      },
      {
        "name": "text",
        "keyPath": "text"
      },
      {
        "name": "html",
        "keyPath": "html"
      },
      {
        "name": "created_at",
        "keyPath": "created_at"
      },
      {
        "name": "updated_at",
        "keyPath": "updated_at"
      },
      {
        "name": "color",
        "keyPath": "color"
      },
      {
        "name": "comment",
        "keyPath": "comment"
      }
    ]
  },
  "operations": {
    "keyPath": "id",
    "primaryKeyType": "TEXT",
    "indices": [
      {
        "name": "by_processed",
        "keyPath": "processed"
      },
      {
        "name": "by_client",
        "keyPath": [
          "client_id",
          "client_op_id"
        ]
      },
      {
        "name": "by_entity",
        "keyPath": "entity"
      },
      {
        "name": "by_created_at",
        "keyPath": "created_at"
      }
    ]
  },
  "config": {
    "keyPath": "key",
    "primaryKeyType": "TEXT",
    "indices": []
  }
}`);var l={updateRemote:"SYNC_ENGINE_UPDATE_REMOTE",remoteQuery:"SYNC_ENGINE_REMOTE_QUERY",remoteQueryResult:"SYNC_ENGINE_REMOTE_QUERY_RESULT",remoteQueryError:"SYNC_ENGINE_REMOTE_QUERY_ERROR",syncNow:"SYNC_ENGINE_SYNC_NOW",syncNowResult:"SYNC_ENGINE_SYNC_NOW_RESULT",syncNowError:"SYNC_ENGINE_SYNC_NOW_ERROR",databaseChanged:"SYNC_ENGINE_DATABASE_CHANGED",syncStarted:"SYNC_ENGINE_SYNC_STARTED",syncCompleted:"SYNC_ENGINE_SYNC_COMPLETED",syncFailed:"SYNC_ENGINE_SYNC_FAILED",registerSync:"SYNC_ENGINE_REGISTER_SYNC",backgroundSync:"SYNC_ENGINE_BACKGROUND_SYNC"};function U(t,e,n,r){let o=r[t]?.keyPath;if(typeof o!="string"||!o)throw new Error(`Cannot ${n} ${t}: table has no primary key`);for(let i of e)if(i&&typeof i=="object"&&Object.prototype.hasOwnProperty.call(i,o))throw new Error(`Cannot ${n} primary key "${o}" in table "${t}"; it is generated automatically`)}var T;function nt(t,e){for(let[n,r]of Object.entries(S)){let o;if(!t.objectStoreNames.contains(n))o=t.createObjectStore(n,{keyPath:r.keyPath});else if(e)o=e.objectStore(n);else continue;if(o)for(let i of r.indices)o.indexNames.contains(i.name)||o.createIndex(i.name,i.keyPath,i.options)}}function rt(){return new Promise((t,e)=>{let n=indexedDB.open(Q,V);n.onerror=()=>{T=void 0,e(n.error)},n.onupgradeneeded=()=>nt(n.result,n.transaction),n.onsuccess=()=>{let r=n.result;r.onversionchange=()=>{r.close(),T=void 0},t(r)}})}function H(){return T||(T=rt()),T}function ot(t){return t instanceof DOMException&&t.name==="InvalidStateError"}async function w(t,e){let n=await H();try{return n.transaction(t,e)}catch(r){if(!ot(r))throw r;return n.close(),T=void 0,(await H()).transaction(t,e)}}async function _(t,e){P(t,e);let n=await w(t,"readwrite");n.objectStore(t).put(e),await O(n)}function P(t,e){let n=S[t];if(n&&typeof n.keyPath=="string"&&(e[n.keyPath]===void 0||e[n.keyPath]===null)){if(!/(TEXT|CHAR|CLOB|UUID)/i.test(n.primaryKeyType||""))throw new Error(`Cannot generate a client primary key for ${t}.${n.keyPath}: SQLite type ${n.primaryKeyType||"unknown"} is not text-compatible`);e[n.keyPath]=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`}}async function L(t){let e=await w("config","readonly"),n=await N(e.objectStore("config").get(t));return n?n.value:void 0}async function $(t,e){await _("config",{key:t,value:e})}function N(t){return new Promise((e,n)=>{t.onsuccess=()=>e(t.result),t.onerror=()=>n(t.error)})}async function C(t,e){let o=(await w(t,"readonly")).objectStore(t).get(e);return N(o)}async function J(t,e){let n=await w(t,"readwrite");n.objectStore(t).delete(e),await O(n)}async function D(t){let r=(await w(t,"readonly")).objectStore(t).getAll();return N(r)}async function X(t,e,n){let o=(await w(t,"readonly")).objectStore(t),i=o.index(e);if(n===null||typeof n=="boolean"){let u=n,d=i.keyPath,y=o.getAll();return(await N(y)).filter(h=>h?.[d]===u)}let s=n===void 0?null:n,a=i.openCursor(s),c=[];return new Promise((u,d)=>{a.onsuccess=y=>{let m=y.target.result;if(!m){u(c);return}c.push(m.value),m.continue()},a.onerror=()=>d(a.error)})}function O(t){return new Promise((e,n)=>{t.oncomplete=()=>e(),t.onerror=()=>n(t.error),t.onabort=()=>n(t.error)})}var b,I;async function z(t){if(!t||typeof t!="object")throw new Error("Invalid query payload");let e=t,n=e.table,r=e.where,o=[],i=Date.now();switch(e.action){case"SELECT":{o=await W(e);let s=o.filter(a=>E(a,r));return e.action==="SELECT"&&e.select&&e.select.length?s.map(a=>{let c={};for(let u of e.select)c[u]=a[u];return c}):s}case"INSERT":{let s=e.insert,a=Array.isArray(s)?s:[s];if(!a.length)return j();U(n,a,"insert",S);let c=a.map(d=>({...d}));for(let d of c)P(n,d);let u=c.map(d=>Y({entity:n,op_type:"insert",payload:{...d},created_at:i,processed:!1,attempts:0}));return await G(n,c,[],u),{affected:c.length,queued:u.length,opIds:u.map(d=>String(d.id)),rows:c}}case"UPDATE":{let s=e.update||{};U(n,[s],"update",S),o=await W(e);let a=o.filter(y=>E(y,e.where));if(!a.length)return j();let c=a.map(y=>({...y,...s})),u=B(n),d=c.map(y=>Y({entity:n,op_type:"update",payload:{[u]:y[u],...s},created_at:i,processed:!1,attempts:0}));return await G(n,c,[],d),{affected:c.length,queued:d.length,opIds:d.map(y=>String(y.id)),rows:c}}case"DELETE":{o=await W(e);let s=o.filter(d=>E(d,e.where));if(!s.length)return j();let a=B(n),c=s.map(d=>d[a]),u=s.map(d=>Y({entity:n,op_type:"delete",payload:{[a]:d[a]},created_at:i,processed:!1,attempts:0}));return await G(n,[],c,u),{affected:s.length,queued:u.length,opIds:u.map(d=>String(d.id)),rows:s}}default:throw new Error(`Unsupported query action: ${e.action}`)}}async function v(t="push"){if(b)return b;b=(async()=>{let e=tt(t);await p({type:l.syncStarted,syncId:e,reason:t});let n=[],r=0,o=[],i=new Set;try{n=await ct(F);for(let a of n){let c=String(a.entity||"");c&&i.add(c);try{await it(a),await dt(a),r++}catch(u){if(await ut(a,u),o.push({opId:a.id||a.client_op_id||"unknown",error:g(u)}),yt(u))throw await k(),u}}r>0&&i.size>0&&await p({type:l.databaseChanged,tables:Array.from(i),source:"sync"});let s={sent:r,pending:Math.max(n.length-r,0),errors:o,tables:Array.from(i)};return await p({type:o.length?l.syncFailed:l.syncCompleted,syncId:e,reason:t,...s,error:o.length?`${o.length} operation(s) failed to sync.`:void 0}),s}catch(s){throw await p({type:l.syncFailed,syncId:e,reason:t,sent:r,pending:Math.max(n.length-r,0),errors:o,tables:Array.from(i),error:g(s)}),s}})();try{return await b}finally{b=void 0}}async function Z(){if(I)return I;I=(async()=>{let t="pull",e=tt(t);await p({type:l.syncStarted,syncId:e,reason:t});try{let n=Number(await L("lastRemoteOpsAt")||0),r=M.replace(/\/$/,""),o=await fetch(`${r}/operations?since=${encodeURIComponent(String(n))}`,{method:"GET",headers:{"Content-Type":"application/json"}});if(!o.ok)throw new Error(`GET operations failed with ${o.status}`);let i=await o.json();if(!Array.isArray(i))throw new Error("Operations endpoint returned a non-array response.");let s=0,a=n,c=[],u=new Set;for(let y of i){let m=f(y);try{let h=await at(m);h&&(u.add(h),s++);let q=Number(m.created_at)||0;q>a&&(a=q)}catch(h){c.push(g(h));break}}a>n&&await $("lastRemoteOpsAt",String(a));let d={applied:s,errors:c,tables:Array.from(u)};return d.tables.length>0&&await p({type:l.databaseChanged,tables:d.tables,source:"sync"}),await p({type:c.length?l.syncFailed:l.syncCompleted,syncId:e,reason:t,...d,error:c.length?c[0]:void 0}),d}catch(n){throw await p({type:l.syncFailed,syncId:e,reason:t,applied:0,error:g(n)}),n}})();try{return await I}finally{I=void 0}}async function at(t){let e=typeof t.entity=="string"?t.entity:"";if(!e)throw new Error("Remote operation is missing its entity.");let n=String(t.op_type||"").toLowerCase(),r=f(et(t.payload)),o=B(e);if(n==="insert"){let s=r.action==="insert"&&r.data?f(r.data):r;return await _(e,s),e}if(n==="update"){let s=r[o]??r.id??r.ID;if(s!=null){let a=f(await C(e,s)),c=r.action==="update"&&r.changes?f(r.changes):r;return await _(e,{...a,...c}),e}}let i=r[o]??r.id;if(n==="delete"&&i!==void 0&&i!==null)return await J(e,i),e}async function it(t){let e=String(t.entity||"");if(!e||e==="operations")return;let n=String(t.op_type||"").toLowerCase(),r=f(et(t.payload)),o=t.client_id||await lt(),i=t.client_op_id||t.id||`${Date.now()}-${Math.random().toString(36).slice(2)}`,s=B(e);if(n==="insert"){let a=r.action==="insert"&&r.data?r.data:r,c=await K(e,"POST",{data:a,client_id:o,client_op_id:i});await st(e,s,i,c);return}if(n==="update"){let a=r[s]??r.id,c=r.action==="update"&&r.changes?f(r.changes):r;if(a==null)throw new Error(`Cannot sync update for ${e}: missing id`);await K(e,"PUT",{data:{...c,[s]:a},client_id:o,client_op_id:i});return}if(n==="delete"){let a=r[s]??r.id;if(a==null)throw new Error(`Cannot sync delete for ${e}: missing id`);await K(e,"DELETE",{id:a,client_id:o,client_op_id:i});return}throw new Error(`Unknown operation type: ${t.op_type}`)}async function K(t,e,n){let r=await fetch(`${M}/${encodeURIComponent(t)}`,{method:e,headers:{"Content-Type":"application/json"},body:JSON.stringify(n)});if(!r.ok){let o=await r.text().catch(()=>"");throw new Error(`${e} ${t} failed with ${r.status}: ${o}`)}return r.json().catch(()=>null)}async function st(t,e,n,r){let o=f(r);if(Object.keys(o).length===0)return;if(typeof o.client_op_id=="string"&&o.client_op_id!==n)throw new Error(`POST ${t} returned a mismatched client_op_id`);let i=o.data&&typeof o.data=="object"?f(o.data):o,s=i[e];if(s==null)throw new Error(`POST ${t} response is missing primary key "${e}"`);let a=f(await C(t,s));await _(t,{...a,...i})}async function ct(t){let n=(await w("operations","readonly")).objectStore("operations");return(await N(n.getAll())).filter(o=>o&&o.processed!==!0&&!o.sent_at).sort((o,i)=>Number(o.created_at||0)-Number(i.created_at||0)).slice(0,t)}async function dt(t){let e={...t,processed:!0,sent_at:Date.now(),last_error:void 0};await _("operations",e)}async function ut(t,e){let n={...t,attempts:Number(t.attempts||0)+1,last_error:g(e)};await _("operations",n)}function Y(t){return P("operations",t),t.client_op_id||(t.client_op_id=String(t.id)),t}async function G(t,e,n,r){let o=Array.from(new Set([t,"operations"])),i=await w(o,"readwrite"),s=i.objectStore(t),a=i.objectStore("operations");for(let c of e)s.put(c);for(let c of n)s.delete(c);for(let c of r)a.put(c);await O(i)}function B(t){let e=S[t]?.keyPath;if(typeof e!="string"||!e)throw new Error(`Table "${t}" has no configured primary key`);return e}function j(){return{affected:0,queued:0,opIds:[],rows:[]}}async function lt(){let t=await L("client_id");if(t)return t;let e=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;return await $("client_id",e),e}function tt(t){return`${t}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`}function et(t){if(typeof t!="string")return t||{};try{return JSON.parse(t)}catch{return{}}}function yt(t){let e=g(t);return t instanceof TypeError||/failed to fetch|network|offline|timeout|temporar/i.test(e)}async function k(){try{let t=R.registration;t.sync?.register&&await t.sync.register(A)}catch{}}function g(t){return t instanceof Error?t.message:String(t)}async function p(t){let e=await R.clients.matchAll({includeUncontrolled:!0});for(let n of e)n.postMessage(t)}function f(t){return typeof t!="object"||t===null||Array.isArray(t)?{}:t}function E(t,e){return e?e.operator==="AND"&&e.where?e.where.every(n=>E(t,n)):e.operator==="OR"&&e.where?e.where.some(n=>E(t,n)):e.operator==="="&&e.field?t[e.field]===e.value:e.operator===">"&&e.field?t[e.field]>e.value:e.operator==="<"&&e.field?t[e.field]<e.value:!1:!0}async function W(t){let e=t.table,n=t.where;if(!n)return D(e);if(n.operator==="="&&n.field==="id")return C(e,n.value).then(o=>o?[o]:[]);if(n.operator==="="&&n.field)try{return X(e,n.field,n.value)}catch{return(await D(e)).filter(i=>E(i,n))}return(await D(e)).filter(o=>E(o,n))}self.addEventListener("install",()=>{R.skipWaiting()});self.addEventListener("activate",t=>{t.waitUntil?.(R.clients.claim())});self.addEventListener("message",t=>{let e=t,n=e.data;if(!(!n||typeof n.type!="string")){if(n.type===l.registerSync||n.type==="REGISTER_SYNC"){e.waitUntil?.(k());return}if(n.type===l.updateRemote||n.type===l.backgroundSync||n.type==="UPDATE_REMOTE"||n.type==="BACKGROUND_SYNC"){let r=n.type===l.backgroundSync||n.type==="BACKGROUND_SYNC"?"background":"push";e.waitUntil?.(v(r).catch(async()=>{await k()}));return}if(n.type===l.syncNow){let r=typeof n.requestId=="string"?n.requestId:"",o=e;e.waitUntil?.(ft(r,o));return}if(n.type===l.remoteQuery){let r=typeof n.requestId=="string"?n.requestId:"",o=n.ast,i=e;e.waitUntil?.(pt(r,o,i))}}});async function pt(t,e,n){try{let r=e,o=r.action!=="SELECT",i=await z(e),s;if(o){let a=typeof r.table=="string"?r.table:void 0;await p({type:l.databaseChanged,table:a,tables:a?[a]:void 0,action:r.action,ast:e,source:"repo"}),s=v("push").then(()=>{}).catch(async()=>{await k()})}await x(n,{type:l.remoteQueryResult,requestId:t,ast:e,result:i}),await s}catch(r){await x(n,{type:l.remoteQueryError,requestId:t,ast:e,error:g(r)})}}async function ft(t,e){try{let n=await Z();await x(e,{type:l.syncNowResult,requestId:t,result:n})}catch(n){await x(e,{type:l.syncNowError,requestId:t,error:g(n)})}}async function x(t,e){let n=t.source;if(n&&typeof n.postMessage=="function")try{n.postMessage(e);return}catch{}if(t.ports?.length&&typeof t.ports[0]?.postMessage=="function"){t.ports[0].postMessage(e);return}await p(e)}self.addEventListener("sync",t=>{let e=t;!e.tag||e.tag!==A||e.waitUntil?.(v("background"))});
