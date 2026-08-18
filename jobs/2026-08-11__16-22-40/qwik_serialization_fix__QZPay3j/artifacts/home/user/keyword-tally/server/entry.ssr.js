import{j as v,h as je,s as De,k as Ae,F as re,l as Ie,c as oe,i as k,m as se,n as Te,o as Re,_ as D,d as A,p as Be,q as Oe,r as Qe,u as R,t as Ue,a as V,v as _,w as Je,S as Fe,x as We,y as _e,z as q,g as ze,A as qe,B as Ye,C as he}from"./q-D8DWIzup.js";const K={manifestHash:"bgkt24",core:"q-D5dof_24.js",preloader:"q-CSnWScGr.js",qwikLoader:"q-CuPr1DR2.js",bundleGraphAsset:"assets/DAyaUxOa-bundle-graph.json",injections:[],mapping:{s_NUd0QumBCTs:"q-CBsZCnzY.js",s_vN8T5Coz610:"q-CJz1Cs7J.js",s_Fg5wZO6EaNM:"q-DiV8YUM6.js",s_2KEETSViWuA:"q-CBsZCnzY.js",s_pRHwCHWydvo:"q-v8feb2hq.js",s_B7xr08toqkQ:"q-D5dof_24.js",s_B8qOioLdJX8:"q-CJz1Cs7J.js",s_BoEfpUEQrYw:"q-DAeoOwSs.js",s_JO0yswVgcHU:"q-CBsZCnzY.js",s_M3WpijamNLQ:"q-b79n_VX5.js",s_R0QXgxTHqxw:"q-CbExb3Bt.js",s_d0TWQexPt2I:"q-v8feb2hq.js",s_dpDpEum9a7s:"q-GONl9bzG.js",s_xQC7YXcGkLQ:"q-CggycJlG.js",s_bqWUeipyS94:"q-CJz1Cs7J.js",s_HxhML3AaKq8:"q-DGFBf47y.js",s_LLB105avld4:"q-BdPGijS-.js",s_d6UvUtODYP0:"q-DTgekDJ-.js",s_r1aScedE0lo:"q-7EYAxjT-.js",s_0zV53GNJmik:"q-DAeoOwSs.js",s_HP1NEVdANIc:"q-CbExb3Bt.js",s_NEgxlMXYYyY:"q-CJz1Cs7J.js",s_QpNtkxY1dCg:"q-CJz1Cs7J.js",s_haPLUdIPzVw:"q-v8feb2hq.js",s_kGwWFAHbROo:"q-D5dof_24.js",s_vNKt0Q0v7Fs:"q-v8feb2hq.js",s_vqQWw0GkzNg:"q-CbExb3Bt.js"}};/**
 * @license
 * @builder.io/qwik/server 1.15.0
 * Copyright Builder.io, Inc. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/QwikDev/qwik/blob/main/LICENSE
 */var Ge=(t=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(t,{get:(e,n)=>(typeof require<"u"?require:e)[n]}):t)(function(t){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+t+'" is not supported')}),He="<sync>";function Ve(t,e){const n=e==null?void 0:e.mapper,r=t.symbolMapper?t.symbolMapper:(s,i,a)=>{var c;if(n){const f=Q(s),l=n[f];if(!l){if(f===He)return[f,""];if((c=globalThis.__qwik_reg_symbols)==null?void 0:c.has(f))return[s,"_"];if(a)return[s,`${a}?qrl=${s}`];console.error("Cannot resolve symbol",s,"in",n,a)}return l}};return{isServer:!0,async importSymbol(s,i,a){var m;const c=Q(a),f=(m=globalThis.__qwik_reg_symbols)==null?void 0:m.get(c);if(f)return f;let l=String(i);l.endsWith(".js")||(l+=".js");const u=Ge(l);if(!(a in u))throw new Error(`Q-ERROR: missing symbol '${a}' in module '${l}'.`);return u[a]},raf:()=>(console.error("server can not rerender"),Promise.resolve()),nextTick:s=>new Promise(i=>{setTimeout(()=>{i(s())})}),chunkForSymbol(s,i,a){return r(s,n,a)}}}async function Xe(t,e){const n=Ve(t,e);De(n)}var Q=t=>{const e=t.lastIndexOf("_");return e>-1?t.slice(e+1):t},Ke="q:instance",U={$DEBUG$:!1,$invPreloadProbability$:.65},Ze=Date.now(),Me=/\.[mc]?js$/,$e=0,et=1,tt=2,nt=3,Z,M,rt=(t,e)=>({$name$:t,$state$:Me.test(t)?$e:nt,$deps$:Ee?e==null?void 0:e.map(n=>({...n,$factor$:1})):e,$inverseProbability$:1,$createdTs$:Date.now(),$waitedMs$:0,$loadedMs$:0}),ot=t=>{const e=new Map;let n=0;for(;n<t.length;){const r=t[n++],o=[];let s,i=1;for(;s=t[n],typeof s=="number";)s<0?i=-s/10:o.push({$name$:t[s],$importProbability$:i,$factor$:1}),n++;e.set(r,o)}return e},Se=t=>{let e=ee.get(t);if(!e){let n;if(M){if(n=M.get(t),!n)return;n.length||(n=void 0)}e=rt(t,n),ee.set(t,e)}return e},st=(t,e)=>{e&&("debug"in e&&(U.$DEBUG$=!!e.debug),typeof e.preloadProbability=="number"&&(U.$invPreloadProbability$=1-e.preloadProbability)),!(Z!=null||!t)&&(Z="",M=ot(t))},ee=new Map,Ee,J,Pe=0,I=[],at=(...t)=>{console.log(`Preloader ${Date.now()-Ze}ms ${Pe}/${I.length} queued>`,...t)},it=()=>{ee.clear(),J=!1,Ee=!0,Pe=0,I.length=0},ct=()=>{J&&(I.sort((t,e)=>t.$inverseProbability$-e.$inverseProbability$),J=!1)},lt=()=>{ct();let t=.4;const e=[];for(const n of I){const r=Math.round((1-n.$inverseProbability$)*10);r!==t&&(t=r,e.push(t)),e.push(n.$name$)}return e},Ce=(t,e,n)=>{if(n!=null&&n.has(t))return;const r=t.$inverseProbability$;if(t.$inverseProbability$=e,!(r-t.$inverseProbability$<.01)&&(Z!=null&&t.$state$<tt&&t.$inverseProbability$<U.$invPreloadProbability$&&(t.$state$===$e&&(t.$state$=et,I.push(t),U.$DEBUG$&&at(`queued ${Math.round((1-t.$inverseProbability$)*100)}%`,t.$name$)),J=!0),t.$deps$)){n||(n=new Set),n.add(t);const o=1-t.$inverseProbability$;for(const s of t.$deps$){const i=Se(s.$name$);if(i.$inverseProbability$===0)continue;let a;if(s.$importProbability$>.5&&(o===1||o>=.99&&te<100))te++,a=Math.min(.01,1-s.$importProbability$);else{const c=1-s.$importProbability$*o,f=s.$factor$,l=c/f;a=Math.max(.02,i.$inverseProbability$*l),s.$factor$=l}Ce(i,a,n)}}},be=(t,e)=>{const n=Se(t);n&&n.$inverseProbability$>e&&Ce(n,e)},te,ut=(t,e)=>{if(!(t!=null&&t.length))return;te=0;let n=e?1-e:.4;if(Array.isArray(t))for(let r=t.length-1;r>=0;r--){const o=t[r];typeof o=="number"?n=1-o/10:be(o,n)}else be(t,n)};function ft(t){const e=[],n=r=>{if(r)for(const o of r)e.includes(o.url)||(e.push(o.url),o.imports&&n(o.imports))};return n(t),e}var dt=t=>{var n;const e=Ie();return(n=t==null?void 0:t.qrls)==null?void 0:n.map(r=>{var a;const o=r.$refSymbol$||r.$symbol$,s=r.$chunk$,i=e.chunkForSymbol(o,s,(a=r.dev)==null?void 0:a.file);return i?i[1]:s}).filter(Boolean)};function mt(t,e,n){const r=e.prefetchStrategy;if(r===null)return[];if(!(n!=null&&n.manifest.bundleGraph))return dt(t);if(typeof(r==null?void 0:r.symbolsToPrefetch)=="function")try{const s=r.symbolsToPrefetch({manifest:n.manifest});return ft(s)}catch(s){console.error("getPrefetchUrls, symbolsToPrefetch()",s)}const o=new Set;for(const s of(t==null?void 0:t.qrls)||[]){const i=Q(s.$refSymbol$||s.$symbol$);i&&i.length>=10&&o.add(i)}return[...o]}var pt=(t,e)=>{if(!(e!=null&&e.manifest.bundleGraph))return[...new Set(t)];it();let n=.99;for(const r of t.slice(0,15))ut(r,n),n*=.85;return lt()},ne=(t,e)=>{if(e==null)return null;const n=`${t}${e}`.split("/"),r=[];for(const o of n)o===".."&&r.length>0?r.pop():r.push(o);return r.join("/")},ht=(t,e,n,r,o)=>{var c;const s=ne(t,(c=e==null?void 0:e.manifest)==null?void 0:c.preloader),i="/"+(e==null?void 0:e.manifest.bundleGraphAsset);if(s&&i&&n!==!1){const f=typeof n=="object"?{debug:n.debug,preloadProbability:n.ssrPreloadProbability}:void 0;st(e==null?void 0:e.manifest.bundleGraph,f);const l=[];n!=null&&n.debug&&l.push("d:1"),n!=null&&n.maxIdlePreloads&&l.push(`P:${n.maxIdlePreloads}`),n!=null&&n.preloadProbability&&l.push(`Q:${n.preloadProbability}`);const u=l.length?`,{${l.join(",")}}`:"",m=`let b=fetch("${i}");import("${s}").then(({l})=>l(${JSON.stringify(t)},b${u}));`;r.push(v("link",{rel:"modulepreload",href:s}),v("link",{rel:"preload",href:i,as:"fetch",crossorigin:"anonymous"}),v("script",{type:"module",async:!0,dangerouslySetInnerHTML:m,nonce:o}))}const a=ne(t,e==null?void 0:e.manifest.core);a&&r.push(v("link",{rel:"modulepreload",href:a}))},bt=(t,e,n,r,o)=>{if(r.length===0||n===!1)return null;const{ssrPreloads:s,ssrPreloadProbability:i}=yt(typeof n=="boolean"?void 0:n);let a=s;const c=[],f=[],l=e==null?void 0:e.manifest.manifestHash;if(a){const p=e==null?void 0:e.manifest.preloader,d=e==null?void 0:e.manifest.core,x=pt(r,e);let w=4;const N=i*10;for(const h of x)if(typeof h=="string"){if(w<N)break;if(h===p||h===d)continue;if(f.push(h),--a===0)break}else w=h}const u=ne(t,l&&(e==null?void 0:e.manifest.preloader));let y=f.length?`${JSON.stringify(f)}.map((l,e)=>{e=document.createElement('link');e.rel='modulepreload';e.href=${JSON.stringify(t)}+l;document.head.appendChild(e)});`:"";return u&&(y+=`window.addEventListener('load',f=>{f=_=>import("${u}").then(({p})=>p(${JSON.stringify(r)}));try{requestIdleCallback(f,{timeout:2000})}catch(e){setTimeout(f,200)}})`),y&&c.push(v("script",{type:"module","q:type":"preload",async:!0,dangerouslySetInnerHTML:y,nonce:o})),c.length>0?v(re,{children:c}):null},vt=(t,e,n,r,o)=>{var s;if(n.preloader!==!1){const i=mt(e,n,r);if(i.length>0){const a=bt(t,r,n.preloader,i,(s=n.serverData)==null?void 0:s.nonce);a&&o.push(a)}}};function yt(t){return{...gt,...t}}var gt={ssrPreloads:7,ssrPreloadProbability:.5,debug:!1,maxIdlePreloads:25,preloadProbability:.35},wt='const t=document,e=window,n=new Set,o=new Set([t]);let r;const s=(t,e)=>Array.from(t.querySelectorAll(e)),i=t=>{const e=[];return o.forEach((n=>e.push(...s(n,t)))),e},a=t=>{g(t),s(t,"[q\\\\:shadowroot]").forEach((t=>{const e=t.shadowRoot;e&&a(e)}))},c=t=>t&&"function"==typeof t.then;let l=!0;const f=(t,e,n=e.type)=>{let o=l;i("[on"+t+"\\\\:"+n+"]").forEach((r=>{o=!0,b(r,t,e,n)})),o||window[t.slice(1)].removeEventListener(n,"-window"===t?d:_)},p=e=>{if(void 0===e._qwikjson_){let n=(e===t.documentElement?t.body:e).lastElementChild;for(;n;){if("SCRIPT"===n.tagName&&"qwik/json"===n.getAttribute("type")){e._qwikjson_=JSON.parse(n.textContent.replace(/\\\\x3C(\\/?script)/gi,"<$1"));break}n=n.previousElementSibling}}},u=(t,e)=>new CustomEvent(t,{detail:e}),b=async(e,n,o,r=o.type)=>{const s="on"+n+":"+r;e.hasAttribute("preventdefault:"+r)&&o.preventDefault(),e.hasAttribute("stoppropagation:"+r)&&o.stopPropagation();const i=e._qc_,a=i&&i.li.filter((t=>t[0]===s));if(a&&a.length>0){for(const t of a){const n=t[1].getFn([e,o],(()=>e.isConnected))(o,e),r=o.cancelBubble;c(n)&&await n,r&&o.stopPropagation()}return}const l=e.getAttribute(s);if(l){const n=e.closest("[q\\\\:container]"),r=n.getAttribute("q:base"),s=n.getAttribute("q:version")||"unknown",i=n.getAttribute("q:manifest-hash")||"dev",a=new URL(r,t.baseURI);for(const f of l.split("\\n")){const l=new URL(f,a),u=l.href,b=l.hash.replace(/^#?([^?[|]*).*$/,"$1")||"default",q=performance.now();let _,d,w;const m=f.startsWith("#"),y={qBase:r,qManifest:i,qVersion:s,href:u,symbol:b,element:e,reqTime:q};if(m){const e=n.getAttribute("q:instance");_=(t["qFuncs_"+e]||[])[Number.parseInt(b)],_||(d="sync",w=Error("sym:"+b))}else{h("qsymbol",y);const t=l.href.split("#")[0];try{const e=import(t);p(n),_=(await e)[b],_||(d="no-symbol",w=Error(`${b} not in ${t}`))}catch(t){d||(d="async"),w=t}}if(!_){h("qerror",{importError:d,error:w,...y}),console.error(w);break}const g=t.__q_context__;if(e.isConnected)try{t.__q_context__=[e,o,l];const n=_(o,e);c(n)&&await n}catch(t){h("qerror",{error:t,...y})}finally{t.__q_context__=g}}}},h=(e,n)=>{t.dispatchEvent(u(e,n))},q=t=>t.replace(/([A-Z])/g,(t=>"-"+t.toLowerCase())),_=async t=>{let e=q(t.type),n=t.target;for(f("-document",t,e);n&&n.getAttribute;){const o=b(n,"",t,e);let r=t.cancelBubble;c(o)&&await o,r||(r=r||t.cancelBubble||n.hasAttribute("stoppropagation:"+t.type)),n=t.bubbles&&!0!==r?n.parentElement:null}},d=t=>{f("-window",t,q(t.type))},w=()=>{var s;const c=t.readyState;if(!r&&("interactive"==c||"complete"==c)&&(o.forEach(a),r=1,h("qinit"),(null!=(s=e.requestIdleCallback)?s:e.setTimeout).bind(e)((()=>h("qidle"))),n.has("qvisible"))){const t=i("[on\\\\:qvisible]"),e=new IntersectionObserver((t=>{for(const n of t)n.isIntersecting&&(e.unobserve(n.target),b(n.target,"",u("qvisible",n)))}));t.forEach((t=>e.observe(t)))}},m=(t,e,n,o=!1)=>{t.addEventListener(e,n,{capture:o,passive:!1})};let y;const g=(...t)=>{l=!0,clearTimeout(y),y=setTimeout((()=>l=!1),2e4);for(const r of t)"string"==typeof r?n.has(r)||(o.forEach((t=>m(t,r,_,!0))),m(e,r,d,!0),n.add(r)):o.has(r)||(n.forEach((t=>m(r,t,_,!0))),o.add(r))};if(!("__q_context__"in t)){t.__q_context__=0;const r=e.qwikevents;r&&(Array.isArray(r)?g(...r):g("click","input")),e.qwikevents={events:n,roots:o,push:g},m(t,"readystatechange",w),w()}',_t=`const doc = document;
const win = window;
const events = /* @__PURE__ */ new Set();
const roots = /* @__PURE__ */ new Set([doc]);
let hasInitialized;
const nativeQuerySelectorAll = (root, selector) => Array.from(root.querySelectorAll(selector));
const querySelectorAll = (query) => {
  const elements = [];
  roots.forEach((root) => elements.push(...nativeQuerySelectorAll(root, query)));
  return elements;
};
const findShadowRoots = (fragment) => {
  processEventOrNode(fragment);
  nativeQuerySelectorAll(fragment, "[q\\\\:shadowroot]").forEach((parent) => {
    const shadowRoot = parent.shadowRoot;
    shadowRoot && findShadowRoots(shadowRoot);
  });
};
const isPromise = (promise) => promise && typeof promise.then === "function";
let doNotClean = true;
const broadcast = (infix, ev, type = ev.type) => {
  let found = doNotClean;
  querySelectorAll("[on" + infix + "\\\\:" + type + "]").forEach((el) => {
    found = true;
    dispatch(el, infix, ev, type);
  });
  if (!found) {
    window[infix.slice(1)].removeEventListener(
      type,
      infix === "-window" ? processWindowEvent : processDocumentEvent
    );
  }
};
const resolveContainer = (containerEl) => {
  if (containerEl._qwikjson_ === void 0) {
    const parentJSON = containerEl === doc.documentElement ? doc.body : containerEl;
    let script = parentJSON.lastElementChild;
    while (script) {
      if (script.tagName === "SCRIPT" && script.getAttribute("type") === "qwik/json") {
        containerEl._qwikjson_ = JSON.parse(
          script.textContent.replace(/\\\\x3C(\\/?script)/gi, "<$1")
        );
        break;
      }
      script = script.previousElementSibling;
    }
  }
};
const createEvent = (eventName, detail) => new CustomEvent(eventName, {
  detail
});
const dispatch = async (element, onPrefix, ev, eventName = ev.type) => {
  const attrName = "on" + onPrefix + ":" + eventName;
  if (element.hasAttribute("preventdefault:" + eventName)) {
    ev.preventDefault();
  }
  if (element.hasAttribute("stoppropagation:" + eventName)) {
    ev.stopPropagation();
  }
  const ctx = element._qc_;
  const relevantListeners = ctx && ctx.li.filter((li) => li[0] === attrName);
  if (relevantListeners && relevantListeners.length > 0) {
    for (const listener of relevantListeners) {
      const results = listener[1].getFn([element, ev], () => element.isConnected)(ev, element);
      const cancelBubble = ev.cancelBubble;
      if (isPromise(results)) {
        await results;
      }
      if (cancelBubble) {
        ev.stopPropagation();
      }
    }
    return;
  }
  const attrValue = element.getAttribute(attrName);
  if (attrValue) {
    const container = element.closest("[q\\\\:container]");
    const qBase = container.getAttribute("q:base");
    const qVersion = container.getAttribute("q:version") || "unknown";
    const qManifest = container.getAttribute("q:manifest-hash") || "dev";
    const base = new URL(qBase, doc.baseURI);
    for (const qrl of attrValue.split("\\n")) {
      const url = new URL(qrl, base);
      const href = url.href;
      const symbol = url.hash.replace(/^#?([^?[|]*).*$/, "$1") || "default";
      const reqTime = performance.now();
      let handler;
      let importError;
      let error;
      const isSync = qrl.startsWith("#");
      const eventData = {
        qBase,
        qManifest,
        qVersion,
        href,
        symbol,
        element,
        reqTime
      };
      if (isSync) {
        const hash = container.getAttribute("q:instance");
        handler = (doc["qFuncs_" + hash] || [])[Number.parseInt(symbol)];
        if (!handler) {
          importError = "sync";
          error = new Error("sym:" + symbol);
        }
      } else {
        emitEvent("qsymbol", eventData);
        const uri = url.href.split("#")[0];
        try {
          const module = import(
                        uri
          );
          resolveContainer(container);
          handler = (await module)[symbol];
          if (!handler) {
            importError = "no-symbol";
            error = new Error(\`\${symbol} not in \${uri}\`);
          }
        } catch (err) {
          importError || (importError = "async");
          error = err;
        }
      }
      if (!handler) {
        emitEvent("qerror", {
          importError,
          error,
          ...eventData
        });
        console.error(error);
        break;
      }
      const previousCtx = doc.__q_context__;
      if (element.isConnected) {
        try {
          doc.__q_context__ = [element, ev, url];
          const results = handler(ev, element);
          if (isPromise(results)) {
            await results;
          }
        } catch (error2) {
          emitEvent("qerror", { error: error2, ...eventData });
        } finally {
          doc.__q_context__ = previousCtx;
        }
      }
    }
  }
};
const emitEvent = (eventName, detail) => {
  doc.dispatchEvent(createEvent(eventName, detail));
};
const camelToKebab = (str) => str.replace(/([A-Z])/g, (a) => "-" + a.toLowerCase());
const processDocumentEvent = async (ev) => {
  let type = camelToKebab(ev.type);
  let element = ev.target;
  broadcast("-document", ev, type);
  while (element && element.getAttribute) {
    const results = dispatch(element, "", ev, type);
    let cancelBubble = ev.cancelBubble;
    if (isPromise(results)) {
      await results;
    }
    cancelBubble || (cancelBubble = cancelBubble || ev.cancelBubble || element.hasAttribute("stoppropagation:" + ev.type));
    element = ev.bubbles && cancelBubble !== true ? element.parentElement : null;
  }
};
const processWindowEvent = (ev) => {
  broadcast("-window", ev, camelToKebab(ev.type));
};
const processReadyStateChange = () => {
  var _a;
  const readyState = doc.readyState;
  if (!hasInitialized && (readyState == "interactive" || readyState == "complete")) {
    roots.forEach(findShadowRoots);
    hasInitialized = 1;
    emitEvent("qinit");
    const riC = (_a = win.requestIdleCallback) != null ? _a : win.setTimeout;
    riC.bind(win)(() => emitEvent("qidle"));
    if (events.has("qvisible")) {
      const results = querySelectorAll("[on\\\\:qvisible]");
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            dispatch(entry.target, "", createEvent("qvisible", entry));
          }
        }
      });
      results.forEach((el) => observer.observe(el));
    }
  }
};
const addEventListener = (el, eventName, handler, capture = false) => {
  el.addEventListener(eventName, handler, { capture, passive: false });
};
let cleanTimer;
const processEventOrNode = (...eventNames) => {
  doNotClean = true;
  clearTimeout(cleanTimer);
  cleanTimer = setTimeout(() => doNotClean = false, 2e4);
  for (const eventNameOrNode of eventNames) {
    if (typeof eventNameOrNode === "string") {
      if (!events.has(eventNameOrNode)) {
        roots.forEach(
          (root) => addEventListener(root, eventNameOrNode, processDocumentEvent, true)
        );
        addEventListener(win, eventNameOrNode, processWindowEvent, true);
        events.add(eventNameOrNode);
      }
    } else {
      if (!roots.has(eventNameOrNode)) {
        events.forEach(
          (eventName) => addEventListener(eventNameOrNode, eventName, processDocumentEvent, true)
        );
        roots.add(eventNameOrNode);
      }
    }
  }
};
if (!("__q_context__" in doc)) {
  doc.__q_context__ = 0;
  const qwikevents = win.qwikevents;
  if (qwikevents) {
    if (Array.isArray(qwikevents)) {
      processEventOrNode(...qwikevents);
    } else {
      processEventOrNode("click", "input");
    }
  }
  win.qwikevents = {
    events,
    roots,
    push: processEventOrNode
  };
  addEventListener(doc, "readystatechange", processReadyStateChange);
  processReadyStateChange();
}`;function qt(t={}){return t.debug?_t:wt}function X(){if(typeof performance>"u")return()=>0;const t=performance.now();return()=>(performance.now()-t)/1e6}function $t(t){let e=t.base;return typeof t.base=="function"&&(e=t.base(t)),typeof e=="string"?(e.endsWith("/")||(e+="/"),e):"/build/"}var St="<!DOCTYPE html>";async function Et(t,e){var ae,ie,ce;let n=e.stream,r=0,o=0,s=0,i=0,a="",c;const f=((ae=e.streaming)==null?void 0:ae.inOrder)??{strategy:"auto",maximunInitialChunk:5e4,maximunChunk:3e4},l=e.containerTagName??"html",u=e.containerAttributes??{},m=n,y=X(),p=$t(e),d=Ct(e.manifest);function x(){a&&(m.write(a),a="",r=0,s++,s===1&&(i=y()))}function w(b){const g=b.length;r+=g,o+=g,a+=b}switch(f.strategy){case"disabled":n={write:w};break;case"direct":n=m;break;case"auto":let b=0,g=!1;const le=f.maximunChunk??0,H=f.maximunInitialChunk??0;n={write(j){j==="<!--qkssr-f-->"?g||(g=!0):j==="<!--qkssr-pu-->"?b++:j==="<!--qkssr-po-->"?b--:w(j),b===0&&(g||r>=(s===0?H:le))&&(g=!1,x())}};break}l==="html"?n.write(St):n.write("<!--cq-->"),d||console.warn("Missing client manifest, loading symbols in the client might 404. Please ensure the client build has run and generated the manifest for the server build."),await Xe(e,d);const N=d==null?void 0:d.manifest.injections,h=N?N.map(b=>v(b.tag,b.attributes??{})):[],L=((ie=e.qwikLoader)==null?void 0:ie.include)??"auto",$=d==null?void 0:d.manifest.qwikLoader;let W=!1;L!=="never"&&$&&(h.unshift(v("link",{rel:"modulepreload",href:`${p}${$}`}),v("script",{type:"module",async:!0,src:`${p}${$}`})),W=!0),ht(p,d,e.preloader,h,(ce=e.serverData)==null?void 0:ce.nonce);const z=X(),Y=[];let T=0,S=0;await je(t,{stream:n,containerTagName:l,containerAttributes:u,serverData:e.serverData,base:p,beforeContent:h,beforeClose:async(b,g,le,H)=>{var fe,de,me,pe;T=z();const j=X();c=await Ae(b,g,void 0,H);const P=[];vt(p,c,e,d,P);const Ne=JSON.stringify(c.state,void 0,void 0);if(P.push(v("script",{type:"qwik/json",dangerouslySetInnerHTML:kt(Ne),nonce:(fe=e.serverData)==null?void 0:fe.nonce})),c.funcs.length>0){const C=u[Ke];P.push(v("script",{"q:func":"qwik/json",dangerouslySetInnerHTML:Lt(C,c.funcs),nonce:(de=e.serverData)==null?void 0:de.nonce}))}const Le=!c||c.mode!=="static";if(!W&&(L==="always"||L==="auto"&&Le)){const C=qt({debug:e.debug});P.push(v("script",{id:"qwikloader",async:!0,type:"module",dangerouslySetInnerHTML:C,nonce:(me=e.serverData)==null?void 0:me.nonce}))}const ue=Array.from(g.$events$,C=>JSON.stringify(C));if(ue.length>0){const C=`(window.qwikevents||(window.qwikevents=[])).push(${ue.join(",")})`;P.push(v("script",{dangerouslySetInnerHTML:C,nonce:(pe=e.serverData)==null?void 0:pe.nonce}))}return xt(Y,b),S=j(),v(re,{children:P})},manifestHash:(d==null?void 0:d.manifest.manifestHash)||"dev"+Pt()}),l!=="html"&&n.write("<!--/cq-->"),x();const G=c.resources.some(b=>b._cache!==1/0);return{prefetchResources:void 0,snapshotResult:c,flushes:s,manifest:d==null?void 0:d.manifest,size:o,isStatic:!G,timing:{render:T,snapshot:S,firstFlush:i}}}function Pt(){return Math.random().toString(36).slice(2)}function Ct(t){const e=t?{...K,...t}:K;if(!e||"mapper"in e)return e;if(e.mapping){const n={};return Object.entries(e.mapping).forEach(([r,o])=>{n[Q(r)]=[r,o]}),{mapper:n,manifest:e,injections:e.injections||[]}}}var kt=t=>t.replace(/<(\/?script)/gi,"\\x3C$1");function xt(t,e){var n;for(const r of e){const o=(n=r.$componentQrl$)==null?void 0:n.getSymbol();o&&!t.includes(o)&&t.push(o)}}var Nt='document["qFuncs_HASH"]=';function Lt(t,e){return Nt.replace("HASH",t)+`[${e.join(`,
`)}]`}const jt=q("qc-s"),Dt=q("qc-c"),ke=q("qc-ic"),At=q("qc-h"),It=q("qc-l"),Tt=q("qc-n"),Rt=q("qc-a"),Bt=q("qc-ir"),Ot=q("qc-p"),Qt=We(ze("s_d6UvUtODYP0")),Ut=()=>{if(!se("containerAttributes"))throw new Error("PrefetchServiceWorker component must be rendered on the server.");Te();const e=Re(ke);if(e.value&&e.value.length>0){const n=e.value.length;let r=null;for(let o=n-1;o>=0;o--)e.value[o].default&&(r=D(e.value[o].default,{children:r},1,"7W_0"));return D(re,{children:[r,A("script",{"document:onQCInit$":Qt,"document:onQInit$":Be(()=>{((o,s)=>{var i;if(!o._qcs&&s.scrollRestoration==="manual"){o._qcs=!0;const a=(i=s.state)==null?void 0:i._qCityScroll;a&&o.scrollTo(a.x,a.y),document.dispatchEvent(new Event("qcinit"))}})(window,history)},'()=>{((w,h)=>{if(!w._qcs&&h.scrollRestoration==="manual"){w._qcs=true;const s=h.state?._qCityScroll;if(s){w.scrollTo(s.x,s.y);}document.dispatchEvent(new Event("qcinit"));}})(window,history);}')},null,null,2,"7W_1")]},1,"7W_2")}return Oe},Jt=oe(k(Ut,"s_dpDpEum9a7s")),Ft=(t,e)=>new URL(t,e.href),ve=(t,e)=>t.origin===e.origin,ye=t=>t.endsWith("/")?t:t+"/",Wt=({pathname:t},{pathname:e})=>{const n=Math.abs(t.length-e.length);return n===0?t===e:n===1&&ye(t)===ye(e)},zt=(t,e)=>t.search===e.search,F=(t,e)=>zt(t,e)&&Wt(t,e),Yt=t=>t&&typeof t.then=="function",Gt=(t,e,n,r)=>{const o=xe(),i={head:o,withLocale:a=>he(r,a),resolveValue:a=>{const c=a.__id;if(a.__brand==="server_loader"&&!(c in t.loaders))throw new Error("You can not get the returned data of a loader that has not been executed for this request.");const f=t.loaders[c];if(Yt(f))throw new Error("Loaders returning a promise can not be resolved for the head function.");return f},...e};for(let a=n.length-1;a>=0;a--){const c=n[a]&&n[a].head;c&&(typeof c=="function"?ge(o,he(r,()=>c(i))):typeof c=="object"&&ge(o,c))}return i.head},ge=(t,e)=>{typeof e.title=="string"&&(t.title=e.title),B(t.meta,e.meta),B(t.links,e.links),B(t.styles,e.styles),B(t.scripts,e.scripts),Object.assign(t.frontmatter,e.frontmatter)},B=(t,e)=>{if(Array.isArray(e))for(const n of e){if(typeof n.key=="string"){const r=t.findIndex(o=>o.key===n.key);if(r>-1){t[r]=n;continue}}t.push(n)}},xe=()=>({title:"",meta:[],links:[],styles:[],scripts:[],frontmatter:{}}),Ht=()=>_e(se("qwikcity")),we={},O={navCount:0},Vt=":root{view-transition-name:none}",Xt=t=>{},Kt=async(t,e)=>{const[n,r,o,s]=qe(),{type:i="link",forceReload:a=t===void 0,replaceState:c=!1,scroll:f=!0}=typeof e=="object"?e:{forceReload:e};O.navCount++;const l=o.value.dest,u=t===void 0?l:typeof t=="number"?t:Ft(t,s.url);if(we.$cbs$&&(a||typeof u=="number"||!F(u,l)||!ve(u,l))){const m=O.navCount,y=await Promise.all([...we.$cbs$.values()].map(p=>p(u)));if(m!==O.navCount||y.some(Boolean)){m===O.navCount&&i==="popstate"&&history.pushState(null,"",l);return}}if(typeof u!="number"&&ve(u,l)&&!(!a&&F(u,l)))return o.value={type:i,dest:u,forceReload:a,replaceState:c,scroll:f},n.value=void 0,s.isNavigating=!0,new Promise(m=>{r.r=m})},Zt=({track:t})=>{const[e,n,r,o,s,i,a,c,f,l,u]=qe();async function m(){const[p,d]=t(()=>[l.value,e.value]),x=Ye(""),w=u.url,N=d?"form":p.type;p.replaceState;let h,L,$=null;if(h=new URL(p.dest,u.url),$=s.loadedRoute,L=s.response,$){const[W,z,Y,T]=$,S=Y,G=S[S.length-1];p.dest.search&&F(h,w)&&(h.search=p.dest.search),F(h,w)||(u.prevUrl=w),u.url=h,u.params={...z},l.untrackedValue={type:N,dest:h};const E=Gt(L,u,S,x);n.headings=G.headings,n.menu=T,r.value=_e(S),o.links=E.links,o.meta=E.meta,o.styles=E.styles,o.scripts=E.scripts,o.title=E.title,o.frontmatter=E.frontmatter}}return m()},Mt=t=>{Qe(k(Vt,"s_bqWUeipyS94"));const e=Ht();if(!(e!=null&&e.params))throw new Error("Missing Qwik City Env Data for help visit https://github.com/QwikDev/qwik/issues/6237");const n=se("url");if(!n)throw new Error("Missing Qwik URL Env Data");if(e.ev.originalUrl.pathname!==e.ev.url.pathname)throw new Error('enableRequestRewrite is an experimental feature and is not enabled. Please enable the feature flag by adding `experimental: ["enableRequestRewrite"]` to your qwikVite plugin options.');const r=new URL(n),o=R({url:r,params:e.params,isNavigating:!1,prevUrl:void 0},{deep:!1}),s={},i=Ue(R(e.response.loaders,{deep:!1})),a=V({type:"initial",dest:r,forceReload:!1,replaceState:!1,scroll:!0}),c=R(xe),f=R({headings:void 0,menu:void 0}),l=V(),u=e.response.action,m=u?e.response.loaders[u]:void 0,y=V(m?{id:u,data:e.response.formData,output:{result:m,status:e.response.status}}:void 0),p=k(Xt,"s_NEgxlMXYYyY"),d=k(Kt,"s_QpNtkxY1dCg",[y,s,a,o]);return _(Dt,f),_(ke,l),_(At,c),_(It,o),_(Tt,d),_(jt,i),_(Rt,y),_(Bt,a),_(Ot,p),Je(k(Zt,"s_vN8T5Coz610",[y,f,l,c,e,d,i,s,t,a,o])),D(Fe,null,3,"7W_3")},en=oe(k(Mt,"s_B8qOioLdJX8")),tn=()=>D(en,{children:[A("head",null,null,[A("meta",null,{charSet:"utf-8"},null,3,null),A("title",null,null,"Keyword Tally",3,null)],3,null),A("body",null,{lang:"en"},D(Jt,null,3,"vC_0"),1,null)]},1,"vC_1"),nn=oe(k(tn,"s_M3WpijamNLQ"));function sn(t){return Et(D(nn,null,3,"TT_0"),{manifest:K,...t,containerAttributes:{lang:"en",...t.containerAttributes}})}export{sn as default};
