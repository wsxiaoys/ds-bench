import{j as v,g as Le,s as Re,h as je,F as re,k as De,c as oe,i as C,l as se,m as Ie,n as Te,_ as R,d as j,o as Be,p as Oe,q as Qe,u as T,r as Ue,a as V,t as w,v as Fe,S as We,w as Ye,x as we,y as q,f as He,z as qe,A as Ge,B as he}from"./q-jmJ71lJE.js";const X={manifestHash:"t3w17v",core:"q-BAzpheAS.js",preloader:"q-CSnWScGr.js",qwikLoader:"q-CuPr1DR2.js",bundleGraphAsset:"assets/BgVmq4YH-bundle-graph.json",injections:[],mapping:{s_NUd0QumBCTs:"q-BdmiFOyZ.js",s_vN8T5Coz610:"q-cgQYR5h2.js",s_Fg5wZO6EaNM:"q-C7dGI02E.js",s_2KEETSViWuA:"q-BdmiFOyZ.js",s_pRHwCHWydvo:"q-DS2-bGA_.js",s_B7xr08toqkQ:"q-BAzpheAS.js",s_B8qOioLdJX8:"q-cgQYR5h2.js",s_BoEfpUEQrYw:"q-UKHWGlFn.js",s_JO0yswVgcHU:"q-BdmiFOyZ.js",s_M3WpijamNLQ:"q-Be7M4AK-.js",s_R0QXgxTHqxw:"q-Cbbbob_e.js",s_d0TWQexPt2I:"q-DS2-bGA_.js",s_dpDpEum9a7s:"q-Dy-nBEO8.js",s_xQC7YXcGkLQ:"q-DqF2R_RN.js",s_bqWUeipyS94:"q-cgQYR5h2.js",s_HxhML3AaKq8:"q-BLtYaBnY.js",s_LLB105avld4:"q-SxEejBCa.js",s_d6UvUtODYP0:"q-DTgekDJ-.js",s_r1aScedE0lo:"q-CZwRbmLE.js",s_0zV53GNJmik:"q-UKHWGlFn.js",s_HP1NEVdANIc:"q-Cbbbob_e.js",s_NEgxlMXYYyY:"q-cgQYR5h2.js",s_QpNtkxY1dCg:"q-cgQYR5h2.js",s_haPLUdIPzVw:"q-DS2-bGA_.js",s_kGwWFAHbROo:"q-BAzpheAS.js",s_vNKt0Q0v7Fs:"q-DS2-bGA_.js",s_vqQWw0GkzNg:"q-Cbbbob_e.js"}};/**
 * @license
 * @builder.io/qwik/server 1.15.0
 * Copyright Builder.io, Inc. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/QwikDev/qwik/blob/main/LICENSE
 */var ze=(t=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(t,{get:(e,n)=>(typeof require<"u"?require:e)[n]}):t)(function(t){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+t+'" is not supported')}),Je="<sync>";function Ve(t,e){const n=e==null?void 0:e.mapper,r=t.symbolMapper?t.symbolMapper:(s,i,a)=>{var c;if(n){const d=Q(s),l=n[d];if(!l){if(d===Je)return[d,""];if((c=globalThis.__qwik_reg_symbols)==null?void 0:c.has(d))return[s,"_"];if(a)return[s,`${a}?qrl=${s}`];console.error("Cannot resolve symbol",s,"in",n,a)}return l}};return{isServer:!0,async importSymbol(s,i,a){var m;const c=Q(a),d=(m=globalThis.__qwik_reg_symbols)==null?void 0:m.get(c);if(d)return d;let l=String(i);l.endsWith(".js")||(l+=".js");const u=ze(l);if(!(a in u))throw new Error(`Q-ERROR: missing symbol '${a}' in module '${l}'.`);return u[a]},raf:()=>(console.error("server can not rerender"),Promise.resolve()),nextTick:s=>new Promise(i=>{setTimeout(()=>{i(s())})}),chunkForSymbol(s,i,a){return r(s,n,a)}}}async function Ke(t,e){const n=Ve(t,e);Re(n)}var Q=t=>{const e=t.lastIndexOf("_");return e>-1?t.slice(e+1):t},Xe="q:instance",U={$DEBUG$:!1,$invPreloadProbability$:.65},Ze=Date.now(),Me=/\.[mc]?js$/,$e=0,et=1,tt=2,nt=3,Z,M,rt=(t,e)=>({$name$:t,$state$:Me.test(t)?$e:nt,$deps$:Ee?e==null?void 0:e.map(n=>({...n,$factor$:1})):e,$inverseProbability$:1,$createdTs$:Date.now(),$waitedMs$:0,$loadedMs$:0}),ot=t=>{const e=new Map;let n=0;for(;n<t.length;){const r=t[n++],o=[];let s,i=1;for(;s=t[n],typeof s=="number";)s<0?i=-s/10:o.push({$name$:t[s],$importProbability$:i,$factor$:1}),n++;e.set(r,o)}return e},Se=t=>{let e=ee.get(t);if(!e){let n;if(M){if(n=M.get(t),!n)return;n.length||(n=void 0)}e=rt(t,n),ee.set(t,e)}return e},st=(t,e)=>{e&&("debug"in e&&(U.$DEBUG$=!!e.debug),typeof e.preloadProbability=="number"&&(U.$invPreloadProbability$=1-e.preloadProbability)),!(Z!=null||!t)&&(Z="",M=ot(t))},ee=new Map,Ee,F,Pe=0,D=[],at=(...t)=>{console.log(`Preloader ${Date.now()-Ze}ms ${Pe}/${D.length} queued>`,...t)},it=()=>{ee.clear(),F=!1,Ee=!0,Pe=0,D.length=0},ct=()=>{F&&(D.sort((t,e)=>t.$inverseProbability$-e.$inverseProbability$),F=!1)},lt=()=>{ct();let t=.4;const e=[];for(const n of D){const r=Math.round((1-n.$inverseProbability$)*10);r!==t&&(t=r,e.push(t)),e.push(n.$name$)}return e},ke=(t,e,n)=>{if(n!=null&&n.has(t))return;const r=t.$inverseProbability$;if(t.$inverseProbability$=e,!(r-t.$inverseProbability$<.01)&&(Z!=null&&t.$state$<tt&&t.$inverseProbability$<U.$invPreloadProbability$&&(t.$state$===$e&&(t.$state$=et,D.push(t),U.$DEBUG$&&at(`queued ${Math.round((1-t.$inverseProbability$)*100)}%`,t.$name$)),F=!0),t.$deps$)){n||(n=new Set),n.add(t);const o=1-t.$inverseProbability$;for(const s of t.$deps$){const i=Se(s.$name$);if(i.$inverseProbability$===0)continue;let a;if(s.$importProbability$>.5&&(o===1||o>=.99&&te<100))te++,a=Math.min(.01,1-s.$importProbability$);else{const c=1-s.$importProbability$*o,d=s.$factor$,l=c/d;a=Math.max(.02,i.$inverseProbability$*l),s.$factor$=l}ke(i,a,n)}}},be=(t,e)=>{const n=Se(t);n&&n.$inverseProbability$>e&&ke(n,e)},te,ut=(t,e)=>{if(!(t!=null&&t.length))return;te=0;let n=e?1-e:.4;if(Array.isArray(t))for(let r=t.length-1;r>=0;r--){const o=t[r];typeof o=="number"?n=1-o/10:be(o,n)}else be(t,n)};function dt(t){const e=[],n=r=>{if(r)for(const o of r)e.includes(o.url)||(e.push(o.url),o.imports&&n(o.imports))};return n(t),e}var ft=t=>{var n;const e=De();return(n=t==null?void 0:t.qrls)==null?void 0:n.map(r=>{var a;const o=r.$refSymbol$||r.$symbol$,s=r.$chunk$,i=e.chunkForSymbol(o,s,(a=r.dev)==null?void 0:a.file);return i?i[1]:s}).filter(Boolean)};function mt(t,e,n){const r=e.prefetchStrategy;if(r===null)return[];if(!(n!=null&&n.manifest.bundleGraph))return ft(t);if(typeof(r==null?void 0:r.symbolsToPrefetch)=="function")try{const s=r.symbolsToPrefetch({manifest:n.manifest});return dt(s)}catch(s){console.error("getPrefetchUrls, symbolsToPrefetch()",s)}const o=new Set;for(const s of(t==null?void 0:t.qrls)||[]){const i=Q(s.$refSymbol$||s.$symbol$);i&&i.length>=10&&o.add(i)}return[...o]}var pt=(t,e)=>{if(!(e!=null&&e.manifest.bundleGraph))return[...new Set(t)];it();let n=.99;for(const r of t.slice(0,15))ut(r,n),n*=.85;return lt()},ne=(t,e)=>{if(e==null)return null;const n=`${t}${e}`.split("/"),r=[];for(const o of n)o===".."&&r.length>0?r.pop():r.push(o);return r.join("/")},ht=(t,e,n,r,o)=>{var c;const s=ne(t,(c=e==null?void 0:e.manifest)==null?void 0:c.preloader),i="/"+(e==null?void 0:e.manifest.bundleGraphAsset);if(s&&i&&n!==!1){const d=typeof n=="object"?{debug:n.debug,preloadProbability:n.ssrPreloadProbability}:void 0;st(e==null?void 0:e.manifest.bundleGraph,d);const l=[];n!=null&&n.debug&&l.push("d:1"),n!=null&&n.maxIdlePreloads&&l.push(`P:${n.maxIdlePreloads}`),n!=null&&n.preloadProbability&&l.push(`Q:${n.preloadProbability}`);const u=l.length?`,{${l.join(",")}}`:"",m=`let b=fetch("${i}");import("${s}").then(({l})=>l(${JSON.stringify(t)},b${u}));`;r.push(v("link",{rel:"modulepreload",href:s}),v("link",{rel:"preload",href:i,as:"fetch",crossorigin:"anonymous"}),v("script",{type:"module",async:!0,dangerouslySetInnerHTML:m,nonce:o}))}const a=ne(t,e==null?void 0:e.manifest.core);a&&r.push(v("link",{rel:"modulepreload",href:a}))},bt=(t,e,n,r,o)=>{if(r.length===0||n===!1)return null;const{ssrPreloads:s,ssrPreloadProbability:i}=yt(typeof n=="boolean"?void 0:n);let a=s;const c=[],d=[],l=e==null?void 0:e.manifest.manifestHash;if(a){const p=e==null?void 0:e.manifest.preloader,f=e==null?void 0:e.manifest.core,x=pt(r,e);let _=4;const N=i*10;for(const h of x)if(typeof h=="string"){if(_<N)break;if(h===p||h===f)continue;if(d.push(h),--a===0)break}else _=h}const u=ne(t,l&&(e==null?void 0:e.manifest.preloader));let y=d.length?`${JSON.stringify(d)}.map((l,e)=>{e=document.createElement('link');e.rel='modulepreload';e.href=${JSON.stringify(t)}+l;document.head.appendChild(e)});`:"";return u&&(y+=`window.addEventListener('load',f=>{f=_=>import("${u}").then(({p})=>p(${JSON.stringify(r)}));try{requestIdleCallback(f,{timeout:2000})}catch(e){setTimeout(f,200)}})`),y&&c.push(v("script",{type:"module","q:type":"preload",async:!0,dangerouslySetInnerHTML:y,nonce:o})),c.length>0?v(re,{children:c}):null},vt=(t,e,n,r,o)=>{var s;if(n.preloader!==!1){const i=mt(e,n,r);if(i.length>0){const a=bt(t,r,n.preloader,i,(s=n.serverData)==null?void 0:s.nonce);a&&o.push(a)}}};function yt(t){return{...gt,...t}}var gt={ssrPreloads:7,ssrPreloadProbability:.5,debug:!1,maxIdlePreloads:25,preloadProbability:.35},_t='const t=document,e=window,n=new Set,o=new Set([t]);let r;const s=(t,e)=>Array.from(t.querySelectorAll(e)),i=t=>{const e=[];return o.forEach((n=>e.push(...s(n,t)))),e},a=t=>{g(t),s(t,"[q\\\\:shadowroot]").forEach((t=>{const e=t.shadowRoot;e&&a(e)}))},c=t=>t&&"function"==typeof t.then;let l=!0;const f=(t,e,n=e.type)=>{let o=l;i("[on"+t+"\\\\:"+n+"]").forEach((r=>{o=!0,b(r,t,e,n)})),o||window[t.slice(1)].removeEventListener(n,"-window"===t?d:_)},p=e=>{if(void 0===e._qwikjson_){let n=(e===t.documentElement?t.body:e).lastElementChild;for(;n;){if("SCRIPT"===n.tagName&&"qwik/json"===n.getAttribute("type")){e._qwikjson_=JSON.parse(n.textContent.replace(/\\\\x3C(\\/?script)/gi,"<$1"));break}n=n.previousElementSibling}}},u=(t,e)=>new CustomEvent(t,{detail:e}),b=async(e,n,o,r=o.type)=>{const s="on"+n+":"+r;e.hasAttribute("preventdefault:"+r)&&o.preventDefault(),e.hasAttribute("stoppropagation:"+r)&&o.stopPropagation();const i=e._qc_,a=i&&i.li.filter((t=>t[0]===s));if(a&&a.length>0){for(const t of a){const n=t[1].getFn([e,o],(()=>e.isConnected))(o,e),r=o.cancelBubble;c(n)&&await n,r&&o.stopPropagation()}return}const l=e.getAttribute(s);if(l){const n=e.closest("[q\\\\:container]"),r=n.getAttribute("q:base"),s=n.getAttribute("q:version")||"unknown",i=n.getAttribute("q:manifest-hash")||"dev",a=new URL(r,t.baseURI);for(const f of l.split("\\n")){const l=new URL(f,a),u=l.href,b=l.hash.replace(/^#?([^?[|]*).*$/,"$1")||"default",q=performance.now();let _,d,w;const m=f.startsWith("#"),y={qBase:r,qManifest:i,qVersion:s,href:u,symbol:b,element:e,reqTime:q};if(m){const e=n.getAttribute("q:instance");_=(t["qFuncs_"+e]||[])[Number.parseInt(b)],_||(d="sync",w=Error("sym:"+b))}else{h("qsymbol",y);const t=l.href.split("#")[0];try{const e=import(t);p(n),_=(await e)[b],_||(d="no-symbol",w=Error(`${b} not in ${t}`))}catch(t){d||(d="async"),w=t}}if(!_){h("qerror",{importError:d,error:w,...y}),console.error(w);break}const g=t.__q_context__;if(e.isConnected)try{t.__q_context__=[e,o,l];const n=_(o,e);c(n)&&await n}catch(t){h("qerror",{error:t,...y})}finally{t.__q_context__=g}}}},h=(e,n)=>{t.dispatchEvent(u(e,n))},q=t=>t.replace(/([A-Z])/g,(t=>"-"+t.toLowerCase())),_=async t=>{let e=q(t.type),n=t.target;for(f("-document",t,e);n&&n.getAttribute;){const o=b(n,"",t,e);let r=t.cancelBubble;c(o)&&await o,r||(r=r||t.cancelBubble||n.hasAttribute("stoppropagation:"+t.type)),n=t.bubbles&&!0!==r?n.parentElement:null}},d=t=>{f("-window",t,q(t.type))},w=()=>{var s;const c=t.readyState;if(!r&&("interactive"==c||"complete"==c)&&(o.forEach(a),r=1,h("qinit"),(null!=(s=e.requestIdleCallback)?s:e.setTimeout).bind(e)((()=>h("qidle"))),n.has("qvisible"))){const t=i("[on\\\\:qvisible]"),e=new IntersectionObserver((t=>{for(const n of t)n.isIntersecting&&(e.unobserve(n.target),b(n.target,"",u("qvisible",n)))}));t.forEach((t=>e.observe(t)))}},m=(t,e,n,o=!1)=>{t.addEventListener(e,n,{capture:o,passive:!1})};let y;const g=(...t)=>{l=!0,clearTimeout(y),y=setTimeout((()=>l=!1),2e4);for(const r of t)"string"==typeof r?n.has(r)||(o.forEach((t=>m(t,r,_,!0))),m(e,r,d,!0),n.add(r)):o.has(r)||(n.forEach((t=>m(r,t,_,!0))),o.add(r))};if(!("__q_context__"in t)){t.__q_context__=0;const r=e.qwikevents;r&&(Array.isArray(r)?g(...r):g("click","input")),e.qwikevents={events:n,roots:o,push:g},m(t,"readystatechange",w),w()}',wt=`const doc = document;
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
}`;function qt(t={}){return t.debug?wt:_t}function K(){if(typeof performance>"u")return()=>0;const t=performance.now();return()=>(performance.now()-t)/1e6}function $t(t){let e=t.base;return typeof t.base=="function"&&(e=t.base(t)),typeof e=="string"?(e.endsWith("/")||(e+="/"),e):"/build/"}var St="<!DOCTYPE html>";async function Et(t,e){var ae,ie,ce;let n=e.stream,r=0,o=0,s=0,i=0,a="",c;const d=((ae=e.streaming)==null?void 0:ae.inOrder)??{strategy:"auto",maximunInitialChunk:5e4,maximunChunk:3e4},l=e.containerTagName??"html",u=e.containerAttributes??{},m=n,y=K(),p=$t(e),f=kt(e.manifest);function x(){a&&(m.write(a),a="",r=0,s++,s===1&&(i=y()))}function _(b){const g=b.length;r+=g,o+=g,a+=b}switch(d.strategy){case"disabled":n={write:_};break;case"direct":n=m;break;case"auto":let b=0,g=!1;const le=d.maximunChunk??0,J=d.maximunInitialChunk??0;n={write(L){L==="<!--qkssr-f-->"?g||(g=!0):L==="<!--qkssr-pu-->"?b++:L==="<!--qkssr-po-->"?b--:_(L),b===0&&(g||r>=(s===0?J:le))&&(g=!1,x())}};break}l==="html"?n.write(St):n.write("<!--cq-->"),f||console.warn("Missing client manifest, loading symbols in the client might 404. Please ensure the client build has run and generated the manifest for the server build."),await Ke(e,f);const N=f==null?void 0:f.manifest.injections,h=N?N.map(b=>v(b.tag,b.attributes??{})):[],A=((ie=e.qwikLoader)==null?void 0:ie.include)??"auto",$=f==null?void 0:f.manifest.qwikLoader;let Y=!1;A!=="never"&&$&&(h.unshift(v("link",{rel:"modulepreload",href:`${p}${$}`}),v("script",{type:"module",async:!0,src:`${p}${$}`})),Y=!0),ht(p,f,e.preloader,h,(ce=e.serverData)==null?void 0:ce.nonce);const H=K(),G=[];let I=0,S=0;await Le(t,{stream:n,containerTagName:l,containerAttributes:u,serverData:e.serverData,base:p,beforeContent:h,beforeClose:async(b,g,le,J)=>{var de,fe,me,pe;I=H();const L=K();c=await je(b,g,void 0,J);const P=[];vt(p,c,e,f,P);const Ne=JSON.stringify(c.state,void 0,void 0);if(P.push(v("script",{type:"qwik/json",dangerouslySetInnerHTML:Ct(Ne),nonce:(de=e.serverData)==null?void 0:de.nonce})),c.funcs.length>0){const k=u[Xe];P.push(v("script",{"q:func":"qwik/json",dangerouslySetInnerHTML:At(k,c.funcs),nonce:(fe=e.serverData)==null?void 0:fe.nonce}))}const Ae=!c||c.mode!=="static";if(!Y&&(A==="always"||A==="auto"&&Ae)){const k=qt({debug:e.debug});P.push(v("script",{id:"qwikloader",async:!0,type:"module",dangerouslySetInnerHTML:k,nonce:(me=e.serverData)==null?void 0:me.nonce}))}const ue=Array.from(g.$events$,k=>JSON.stringify(k));if(ue.length>0){const k=`(window.qwikevents||(window.qwikevents=[])).push(${ue.join(",")})`;P.push(v("script",{dangerouslySetInnerHTML:k,nonce:(pe=e.serverData)==null?void 0:pe.nonce}))}return xt(G,b),S=L(),v(re,{children:P})},manifestHash:(f==null?void 0:f.manifest.manifestHash)||"dev"+Pt()}),l!=="html"&&n.write("<!--/cq-->"),x();const z=c.resources.some(b=>b._cache!==1/0);return{prefetchResources:void 0,snapshotResult:c,flushes:s,manifest:f==null?void 0:f.manifest,size:o,isStatic:!z,timing:{render:I,snapshot:S,firstFlush:i}}}function Pt(){return Math.random().toString(36).slice(2)}function kt(t){const e=t?{...X,...t}:X;if(!e||"mapper"in e)return e;if(e.mapping){const n={};return Object.entries(e.mapping).forEach(([r,o])=>{n[Q(r)]=[r,o]}),{mapper:n,manifest:e,injections:e.injections||[]}}}var Ct=t=>t.replace(/<(\/?script)/gi,"\\x3C$1");function xt(t,e){var n;for(const r of e){const o=(n=r.$componentQrl$)==null?void 0:n.getSymbol();o&&!t.includes(o)&&t.push(o)}}var Nt='document["qFuncs_HASH"]=';function At(t,e){return Nt.replace("HASH",t)+`[${e.join(`,
`)}]`}const Lt=q("qc-s"),Rt=q("qc-c"),Ce=q("qc-ic"),jt=q("qc-h"),Dt=q("qc-l"),It=q("qc-n"),Tt=q("qc-a"),Bt=q("qc-ir"),Ot=q("qc-p"),Qt=Ye(He("s_d6UvUtODYP0")),Ut=()=>{if(!se("containerAttributes"))throw new Error("PrefetchServiceWorker component must be rendered on the server.");Ie();const e=Te(Ce);if(e.value&&e.value.length>0){const n=e.value.length;let r=null;for(let o=n-1;o>=0;o--)e.value[o].default&&(r=R(e.value[o].default,{children:r},1,"7W_0"));return R(re,{children:[r,j("script",{"document:onQCInit$":Qt,"document:onQInit$":Be(()=>{((o,s)=>{var i;if(!o._qcs&&s.scrollRestoration==="manual"){o._qcs=!0;const a=(i=s.state)==null?void 0:i._qCityScroll;a&&o.scrollTo(a.x,a.y),document.dispatchEvent(new Event("qcinit"))}})(window,history)},'()=>{((w,h)=>{if(!w._qcs&&h.scrollRestoration==="manual"){w._qcs=true;const s=h.state?._qCityScroll;if(s){w.scrollTo(s.x,s.y);}document.dispatchEvent(new Event("qcinit"));}})(window,history);}')},null,null,2,"7W_1")]},1,"7W_2")}return Oe},Ft=oe(C(Ut,"s_dpDpEum9a7s")),Wt=(t,e)=>new URL(t,e.href),ve=(t,e)=>t.origin===e.origin,ye=t=>t.endsWith("/")?t:t+"/",Yt=({pathname:t},{pathname:e})=>{const n=Math.abs(t.length-e.length);return n===0?t===e:n===1&&ye(t)===ye(e)},Ht=(t,e)=>t.search===e.search,W=(t,e)=>Ht(t,e)&&Yt(t,e),Gt=t=>t&&typeof t.then=="function",zt=(t,e,n,r)=>{const o=xe(),i={head:o,withLocale:a=>he(r,a),resolveValue:a=>{const c=a.__id;if(a.__brand==="server_loader"&&!(c in t.loaders))throw new Error("You can not get the returned data of a loader that has not been executed for this request.");const d=t.loaders[c];if(Gt(d))throw new Error("Loaders returning a promise can not be resolved for the head function.");return d},...e};for(let a=n.length-1;a>=0;a--){const c=n[a]&&n[a].head;c&&(typeof c=="function"?ge(o,he(r,()=>c(i))):typeof c=="object"&&ge(o,c))}return i.head},ge=(t,e)=>{typeof e.title=="string"&&(t.title=e.title),B(t.meta,e.meta),B(t.links,e.links),B(t.styles,e.styles),B(t.scripts,e.scripts),Object.assign(t.frontmatter,e.frontmatter)},B=(t,e)=>{if(Array.isArray(e))for(const n of e){if(typeof n.key=="string"){const r=t.findIndex(o=>o.key===n.key);if(r>-1){t[r]=n;continue}}t.push(n)}},xe=()=>({title:"",meta:[],links:[],styles:[],scripts:[],frontmatter:{}}),Jt=()=>we(se("qwikcity")),_e={},O={navCount:0},Vt=":root{view-transition-name:none}",Kt=t=>{},Xt=async(t,e)=>{const[n,r,o,s]=qe(),{type:i="link",forceReload:a=t===void 0,replaceState:c=!1,scroll:d=!0}=typeof e=="object"?e:{forceReload:e};O.navCount++;const l=o.value.dest,u=t===void 0?l:typeof t=="number"?t:Wt(t,s.url);if(_e.$cbs$&&(a||typeof u=="number"||!W(u,l)||!ve(u,l))){const m=O.navCount,y=await Promise.all([..._e.$cbs$.values()].map(p=>p(u)));if(m!==O.navCount||y.some(Boolean)){m===O.navCount&&i==="popstate"&&history.pushState(null,"",l);return}}if(typeof u!="number"&&ve(u,l)&&!(!a&&W(u,l)))return o.value={type:i,dest:u,forceReload:a,replaceState:c,scroll:d},n.value=void 0,s.isNavigating=!0,new Promise(m=>{r.r=m})},Zt=({track:t})=>{const[e,n,r,o,s,i,a,c,d,l,u]=qe();async function m(){const[p,f]=t(()=>[l.value,e.value]),x=Ge(""),_=u.url,N=f?"form":p.type;p.replaceState;let h,A,$=null;if(h=new URL(p.dest,u.url),$=s.loadedRoute,A=s.response,$){const[Y,H,G,I]=$,S=G,z=S[S.length-1];p.dest.search&&W(h,_)&&(h.search=p.dest.search),W(h,_)||(u.prevUrl=_),u.url=h,u.params={...H},l.untrackedValue={type:N,dest:h};const E=zt(A,u,S,x);n.headings=z.headings,n.menu=I,r.value=we(S),o.links=E.links,o.meta=E.meta,o.styles=E.styles,o.scripts=E.scripts,o.title=E.title,o.frontmatter=E.frontmatter}}return m()},Mt=t=>{Qe(C(Vt,"s_bqWUeipyS94"));const e=Jt();if(!(e!=null&&e.params))throw new Error("Missing Qwik City Env Data for help visit https://github.com/QwikDev/qwik/issues/6237");const n=se("url");if(!n)throw new Error("Missing Qwik URL Env Data");if(e.ev.originalUrl.pathname!==e.ev.url.pathname)throw new Error('enableRequestRewrite is an experimental feature and is not enabled. Please enable the feature flag by adding `experimental: ["enableRequestRewrite"]` to your qwikVite plugin options.');const r=new URL(n),o=T({url:r,params:e.params,isNavigating:!1,prevUrl:void 0},{deep:!1}),s={},i=Ue(T(e.response.loaders,{deep:!1})),a=V({type:"initial",dest:r,forceReload:!1,replaceState:!1,scroll:!0}),c=T(xe),d=T({headings:void 0,menu:void 0}),l=V(),u=e.response.action,m=u?e.response.loaders[u]:void 0,y=V(m?{id:u,data:e.response.formData,output:{result:m,status:e.response.status}}:void 0),p=C(Kt,"s_NEgxlMXYYyY"),f=C(Xt,"s_QpNtkxY1dCg",[y,s,a,o]);return w(Rt,d),w(Ce,l),w(jt,c),w(Dt,o),w(It,f),w(Lt,i),w(Tt,y),w(Bt,a),w(Ot,p),Fe(C(Zt,"s_vN8T5Coz610",[y,d,l,c,e,f,i,s,t,a,o])),R(We,null,3,"7W_3")},en=oe(C(Mt,"s_B8qOioLdJX8")),tn=()=>R(en,{children:[j("head",null,null,[j("meta",null,{charSet:"utf-8"},null,3,null),j("title",null,null,"Keyword Tally",3,null)],3,null),j("body",null,{lang:"en"},R(Ft,null,3,"vC_0"),1,null)]},1,"vC_1"),nn=oe(C(tn,"s_M3WpijamNLQ"));function sn(t){return Et(R(nn,null,3,"TT_0"),{manifest:X,...t,containerAttributes:{lang:"en",...t.containerAttributes}})}export{sn as default};
