var h=self,W="annotation-db",Q=1,M="/api",k="sync-engine-sync",V=50,N=JSON.parse(`{
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
}`);var l={updateRemote:"SYNC_ENGINE_UPDATE_REMOTE",remoteQuery:"SYNC_ENGINE_REMOTE_QUERY",remoteQueryResult:"SYNC_ENGINE_REMOTE_QUERY_RESULT",remoteQueryError:"SYNC_ENGINE_REMOTE_QUERY_ERROR",syncNow:"SYNC_ENGINE_SYNC_NOW",syncNowResult:"SYNC_ENGINE_SYNC_NOW_RESULT",syncNowError:"SYNC_ENGINE_SYNC_NOW_ERROR",databaseChanged:"SYNC_ENGINE_DATABASE_CHANGED",syncStarted:"SYNC_ENGINE_SYNC_STARTED",syncCompleted:"SYNC_ENGINE_SYNC_COMPLETED",syncFailed:"SYNC_ENGINE_SYNC_FAILED",registerSync:"SYNC_ENGINE_REGISTER_SYNC",backgroundSync:"SYNC_ENGINE_BACKGROUND_SYNC"};var R;function et(t,e){for(let[n,r]of Object.entries(N)){let o;if(!t.objectStoreNames.contains(n))o=t.createObjectStore(n,{keyPath:r.keyPath});else if(e)o=e.objectStore(n);else continue;if(o)for(let s of r.indices)o.indexNames.contains(s.name)||o.createIndex(s.name,s.keyPath,s.options)}}function nt(){return new Promise((t,e)=>{let n=indexedDB.open(W,Q);n.onerror=()=>{R=void 0,e(n.error)},n.onupgradeneeded=()=>et(n.result,n.transaction),n.onsuccess=()=>{let r=n.result;r.onversionchange=()=>{r.close(),R=void 0},t(r)}})}function F(){return R||(R=nt()),R}function rt(t){return t instanceof DOMException&&t.name==="InvalidStateError"}async function g(t,e){let n=await F();try{return n.transaction(t,e)}catch(r){if(!rt(r))throw r;return n.close(),R=void 0,(await F()).transaction(t,e)}}async function S(t,e){C(t,e);let n=await g(t,"readwrite");n.objectStore(t).put(e),await O(n)}function C(t,e){let n=N[t];if(n&&typeof n.keyPath=="string"&&(e[n.keyPath]===void 0||e[n.keyPath]===null)){if(!/(TEXT|CHAR|CLOB|UUID)/i.test(n.primaryKeyType||""))throw new Error(`Cannot generate a client primary key for ${t}.${n.keyPath}: SQLite type ${n.primaryKeyType||"unknown"} is not text-compatible`);e[n.keyPath]=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`}}async function U(t){let e=await g("config","readonly"),n=await T(e.objectStore("config").get(t));return n?n.value:void 0}async function L(t,e){await S("config",{key:t,value:e})}function T(t){return new Promise((e,n)=>{t.onsuccess=()=>e(t.result),t.onerror=()=>n(t.error)})}async function D(t,e){let o=(await g(t,"readonly")).objectStore(t).get(e);return T(o)}async function H(t,e){let n=await g(t,"readwrite");n.objectStore(t).delete(e),await O(n)}async function P(t){let r=(await g(t,"readonly")).objectStore(t).getAll();return T(r)}async function J(t,e,n){let o=(await g(t,"readonly")).objectStore(t),s=o.index(e);if(n===null||typeof n=="boolean"){let u=n,d=s.keyPath,y=o.getAll();return(await T(y)).filter(E=>E?.[d]===u)}let i=n===void 0?null:n,a=s.openCursor(i),c=[];return new Promise((u,d)=>{a.onsuccess=y=>{let m=y.target.result;if(!m){u(c);return}c.push(m.value),m.continue()},a.onerror=()=>d(a.error)})}function O(t){return new Promise((e,n)=>{t.oncomplete=()=>e(),t.onerror=()=>n(t.error),t.onabort=()=>n(t.error)})}var b,I;async function X(t){if(!t||typeof t!="object")throw new Error("Invalid query payload");let e=t,n=e.table,r=e.where,o=[],s=Date.now();switch(e.action){case"SELECT":{o=await j(e);let i=o.filter(a=>_(a,r));return e.action==="SELECT"&&e.select&&e.select.length?i.map(a=>{let c={};for(let u of e.select)c[u]=a[u];return c}):i}case"INSERT":{let i=e.insert,a=Array.isArray(i)?i:[i];if(!a.length)return G();let c=a.map(d=>({...d}));for(let d of c)C(n,d);let u=c.map(d=>$({entity:n,op_type:"insert",payload:{...d},created_at:s,processed:!1,attempts:0}));return await K(n,c,[],u),{affected:c.length,queued:u.length,opIds:u.map(d=>String(d.id)),rows:c}}case"UPDATE":{let i=e.update||{};o=await j(e);let a=o.filter(y=>_(y,e.where));if(!a.length)return G();let c=a.map(y=>({...y,...i})),u=B(n),d=c.map(y=>$({entity:n,op_type:"update",payload:{[u]:y[u],...i},created_at:s,processed:!1,attempts:0}));return await K(n,c,[],d),{affected:c.length,queued:d.length,opIds:d.map(y=>String(y.id)),rows:c}}case"DELETE":{o=await j(e);let i=o.filter(d=>_(d,e.where));if(!i.length)return G();let a=B(n),c=i.map(d=>d[a]),u=i.map(d=>$({entity:n,op_type:"delete",payload:{[a]:d[a]},created_at:s,processed:!1,attempts:0}));return await K(n,[],c,u),{affected:i.length,queued:u.length,opIds:u.map(d=>String(d.id)),rows:i}}default:throw new Error(`Unsupported query action: ${e.action}`)}}async function v(t="push"){if(b)return b;b=(async()=>{let e=Z(t);await p({type:l.syncStarted,syncId:e,reason:t});let n=[],r=0,o=[],s=new Set;try{n=await st(V);for(let a of n){let c=String(a.entity||"");c&&s.add(c);try{await at(a),await ct(a),r++}catch(u){if(await dt(a,u),o.push({opId:a.id||a.client_op_id||"unknown",error:w(u)}),lt(u))throw await A(),u}}r>0&&s.size>0&&await p({type:l.databaseChanged,tables:Array.from(s),source:"sync"});let i={sent:r,pending:Math.max(n.length-r,0),errors:o,tables:Array.from(s)};return await p({type:o.length?l.syncFailed:l.syncCompleted,syncId:e,reason:t,...i,error:o.length?`${o.length} operation(s) failed to sync.`:void 0}),i}catch(i){throw await p({type:l.syncFailed,syncId:e,reason:t,sent:r,pending:Math.max(n.length-r,0),errors:o,tables:Array.from(s),error:w(i)}),i}})();try{return await b}finally{b=void 0}}async function z(){if(I)return I;I=(async()=>{let t="pull",e=Z(t);await p({type:l.syncStarted,syncId:e,reason:t});try{let n=Number(await U("lastRemoteOpsAt")||0),r=M.replace(/\/$/,""),o=await fetch(`${r}/operations?since=${encodeURIComponent(String(n))}`,{method:"GET",headers:{"Content-Type":"application/json"}});if(!o.ok)throw new Error(`GET operations failed with ${o.status}`);let s=await o.json();if(!Array.isArray(s))throw new Error("Operations endpoint returned a non-array response.");let i=0,a=n,c=[],u=new Set;for(let y of s){let m=f(y);try{let E=await ot(m);E&&(u.add(E),i++);let q=Number(m.created_at)||0;q>a&&(a=q)}catch(E){c.push(w(E));break}}a>n&&await L("lastRemoteOpsAt",String(a));let d={applied:i,errors:c,tables:Array.from(u)};return d.tables.length>0&&await p({type:l.databaseChanged,tables:d.tables,source:"sync"}),await p({type:c.length?l.syncFailed:l.syncCompleted,syncId:e,reason:t,...d,error:c.length?c[0]:void 0}),d}catch(n){throw await p({type:l.syncFailed,syncId:e,reason:t,applied:0,error:w(n)}),n}})();try{return await I}finally{I=void 0}}async function ot(t){let e=typeof t.entity=="string"?t.entity:"";if(!e)throw new Error("Remote operation is missing its entity.");let n=String(t.op_type||"").toLowerCase(),r=f(tt(t.payload)),o=B(e);if(n==="insert"){let i=r.action==="insert"&&r.data?f(r.data):r;return await S(e,i),e}if(n==="update"){let i=r[o]??r.id??r.ID;if(i!=null){let a=f(await D(e,i)),c=r.action==="update"&&r.changes?f(r.changes):r;return await S(e,{...a,...c}),e}}let s=r[o]??r.id;if(n==="delete"&&s!==void 0&&s!==null)return await H(e,s),e}async function at(t){let e=String(t.entity||"");if(!e||e==="operations")return;let n=String(t.op_type||"").toLowerCase(),r=f(tt(t.payload)),o=t.client_id||await ut(),s=t.client_op_id||t.id||`${Date.now()}-${Math.random().toString(36).slice(2)}`,i=B(e);if(n==="insert"){let a=r.action==="insert"&&r.data?r.data:r,c=await Y(e,"POST",{data:a,client_id:o,client_op_id:s});await it(e,i,s,c);return}if(n==="update"){let a=r[i]??r.id,c=r.action==="update"&&r.changes?f(r.changes):r;if(a==null)throw new Error(`Cannot sync update for ${e}: missing id`);await Y(e,"PUT",{data:{...c,[i]:a},client_id:o,client_op_id:s});return}if(n==="delete"){let a=r[i]??r.id;if(a==null)throw new Error(`Cannot sync delete for ${e}: missing id`);await Y(e,"DELETE",{id:a,client_id:o,client_op_id:s});return}throw new Error(`Unknown operation type: ${t.op_type}`)}async function Y(t,e,n){let r=await fetch(`${M}/${encodeURIComponent(t)}`,{method:e,headers:{"Content-Type":"application/json"},body:JSON.stringify(n)});if(!r.ok){let o=await r.text().catch(()=>"");throw new Error(`${e} ${t} failed with ${r.status}: ${o}`)}return r.json().catch(()=>null)}async function it(t,e,n,r){let o=f(r);if(Object.keys(o).length===0)return;if(typeof o.client_op_id=="string"&&o.client_op_id!==n)throw new Error(`POST ${t} returned a mismatched client_op_id`);let s=o.data&&typeof o.data=="object"?f(o.data):o,i=s[e];if(i==null)throw new Error(`POST ${t} response is missing primary key "${e}"`);let a=f(await D(t,i));await S(t,{...a,...s})}async function st(t){let n=(await g("operations","readonly")).objectStore("operations");return(await T(n.getAll())).filter(o=>o&&o.processed!==!0&&!o.sent_at).sort((o,s)=>Number(o.created_at||0)-Number(s.created_at||0)).slice(0,t)}async function ct(t){let e={...t,processed:!0,sent_at:Date.now(),last_error:void 0};await S("operations",e)}async function dt(t,e){let n={...t,attempts:Number(t.attempts||0)+1,last_error:w(e)};await S("operations",n)}function $(t){return C("operations",t),t.client_op_id||(t.client_op_id=String(t.id)),t}async function K(t,e,n,r){let o=Array.from(new Set([t,"operations"])),s=await g(o,"readwrite"),i=s.objectStore(t),a=s.objectStore("operations");for(let c of e)i.put(c);for(let c of n)i.delete(c);for(let c of r)a.put(c);await O(s)}function B(t){let e=N[t]?.keyPath;if(typeof e!="string"||!e)throw new Error(`Table "${t}" has no configured primary key`);return e}function G(){return{affected:0,queued:0,opIds:[],rows:[]}}async function ut(){let t=await U("client_id");if(t)return t;let e=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;return await L("client_id",e),e}function Z(t){return`${t}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`}function tt(t){if(typeof t!="string")return t||{};try{return JSON.parse(t)}catch{return{}}}function lt(t){let e=w(t);return t instanceof TypeError||/failed to fetch|network|offline|timeout|temporar/i.test(e)}async function A(){try{let t=h.registration;t.sync?.register&&await t.sync.register(k)}catch{}}function w(t){return t instanceof Error?t.message:String(t)}async function p(t){let e=await h.clients.matchAll({includeUncontrolled:!0});for(let n of e)n.postMessage(t)}function f(t){return typeof t!="object"||t===null||Array.isArray(t)?{}:t}function _(t,e){return e?e.operator==="AND"&&e.where?e.where.every(n=>_(t,n)):e.operator==="OR"&&e.where?e.where.some(n=>_(t,n)):e.operator==="="&&e.field?t[e.field]===e.value:e.operator===">"&&e.field?t[e.field]>e.value:e.operator==="<"&&e.field?t[e.field]<e.value:!1:!0}async function j(t){let e=t.table,n=t.where;if(!n)return P(e);if(n.operator==="="&&n.field==="id")return D(e,n.value).then(o=>o?[o]:[]);if(n.operator==="="&&n.field)try{return J(e,n.field,n.value)}catch{return(await P(e)).filter(s=>_(s,n))}return(await P(e)).filter(o=>_(o,n))}self.addEventListener("install",()=>{h.skipWaiting()});self.addEventListener("activate",t=>{t.waitUntil?.(h.clients.claim())});self.addEventListener("message",t=>{let e=t,n=e.data;if(!(!n||typeof n.type!="string")){if(n.type===l.registerSync||n.type==="REGISTER_SYNC"){e.waitUntil?.(A());return}if(n.type===l.updateRemote||n.type===l.backgroundSync||n.type==="UPDATE_REMOTE"||n.type==="BACKGROUND_SYNC"){let r=n.type===l.backgroundSync||n.type==="BACKGROUND_SYNC"?"background":"push";e.waitUntil?.(v(r).catch(async()=>{await A()}));return}if(n.type===l.syncNow){let r=typeof n.requestId=="string"?n.requestId:"",o=e;e.waitUntil?.(pt(r,o));return}if(n.type===l.remoteQuery){let r=typeof n.requestId=="string"?n.requestId:"",o=n.ast,s=e;e.waitUntil?.(yt(r,o,s))}}});async function yt(t,e,n){try{let r=e,o=r.action!=="SELECT",s=await X(e),i;if(o){let a=typeof r.table=="string"?r.table:void 0;await p({type:l.databaseChanged,table:a,tables:a?[a]:void 0,action:r.action,ast:e,source:"repo"}),i=v("push").then(()=>{}).catch(async()=>{await A()})}await x(n,{type:l.remoteQueryResult,requestId:t,ast:e,result:s}),await i}catch(r){await x(n,{type:l.remoteQueryError,requestId:t,ast:e,error:w(r)})}}async function pt(t,e){try{let n=await z();await x(e,{type:l.syncNowResult,requestId:t,result:n})}catch(n){await x(e,{type:l.syncNowError,requestId:t,error:w(n)})}}async function x(t,e){let n=t.source;if(n&&typeof n.postMessage=="function")try{n.postMessage(e);return}catch{}if(t.ports?.length&&typeof t.ports[0]?.postMessage=="function"){t.ports[0].postMessage(e);return}await p(e)}self.addEventListener("sync",t=>{let e=t;!e.tag||e.tag!==k||e.waitUntil?.(v("background"))});
