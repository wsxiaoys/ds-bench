import{j as v,d as Ae,s as be,e as Ne,F as re,g as xe,c as oe,i as C,u as se,f as Ie,h as je,k as I,b as R,l as Re,S as Le,m as Be,n as T,o as De,p as V,q as $,r as Te,t as Oe,w as Ue,x as ve,y as S,z as Fe,A as ye,B as Qe,C as ue}from"./q-DKOF4qnc.js";const K={manifestHash:"pd4hpe",core:"q-B7a016dI.js",preloader:"q-DoNi8vyY.js",qwikLoader:"q-naDMFAHy.js",bundleGraphAsset:"assets/P9-yXgi5-bundle-graph.json",injections:[],mapping:{s_VqdmCb830JE:"q-BGaXwGmR.js",s_ywT8MBPZSLE:"q-0FGqWLeq.js",s_hLIkr6For0A:"q-DRjW3hiR.js",s_MRI6TE2FBmQ:"q-BQdCZwxa.js",s_1nvBbqm8rv0:"q-D1OqkiPX.js",s_Dyc3NVEuHOA:"q-Dl3ZZk-m.js",s_JBlkrZuAnvk:"q-DWcd2450.js",s_X2dN10myrPM:"q-BjVeyWN-.js",s_bHZWuyJGORo:"q-0FGqWLeq.js",s_jvybUipfwTA:"q-BGaXwGmR.js",s_kdKHYpe00Bs:"q-BcUNtOmh.js",s_rHy321kICAo:"q-CjaX7LIQ.js",s_0S001XID1T8:"q-BGaXwGmR.js",s_3Y8h14ptAEs:"q-CNAFemFE.js",s_IR16AtvBauw:"q-DpQFIi2a.js",s_XYv09pkbRnM:"q-BQtTnS_2.js",s_uk0UpfO8Zdw:"q-SvjmIWig.js",s_83FaWKCqUKk:"q-BGaXwGmR.js",s_BZn2jV5J03s:"q-0FGqWLeq.js",s_MPvY7ssXksc:"q-BcUNtOmh.js",s_eoVvrfARMeI:"q-BcUNtOmh.js",s_fA0q61zziYY:"q-BjVeyWN-.js",s_kUPS7nDpPTU:"q-BjVeyWN-.js",s_nFJdkBsXn4w:"q-BGaXwGmR.js",s_spvFRxee2Dk:"q-BcUNtOmh.js",s_ysv6Nj0P0rw:"q-D1OqkiPX.js"}};/**
 * @license
 * @builder.io/qwik/server 1.20.0
 * Copyright Builder.io, Inc. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/QwikDev/qwik/blob/main/LICENSE
 */var Ge=!1,We="",Je=(t,...e)=>{const n=He(Ge,t,...e);debugger;return n},Xe=t=>t,He=(t,e,...n)=>{const o=e instanceof Error?e:new Error(e);return console.error("%cQWIK ERROR",We,o.message,...Xe(n),o.stack),o},Ve=(t,...e)=>`Code(${t}) https://github.com/QwikDev/qwik/blob/main/packages/qwik/src/core/error/error.ts#L${8+t}`,ze=11,Ke=(t,...e)=>{const n=Ve(t,...e);return Je(n,...e)},Ye="<sync>";function we(t,e){const n=e==null?void 0:e.mapper,o=t.symbolMapper?t.symbolMapper:(s,i,a)=>{var c;if(n){const f=F(s),l=n[f];if(!l){if(f===Ye)return[f,""];if((c=globalThis.__qwik_reg_symbols)==null?void 0:c.has(f))return[s,"_"];if(a)return[s,`${a}?qrl=${s}`];console.error("Cannot resolve symbol",s,"in",n,a)}return l}};return{isServer:!0,async importSymbol(s,i,a){var l;const c=F(a),f=(l=globalThis.__qwik_reg_symbols)==null?void 0:l.get(c);if(f)return f;throw Ke(ze,a)},raf:()=>(console.error("server can not rerender"),Promise.resolve()),nextTick:s=>new Promise(i=>{setTimeout(()=>{i(s())})}),chunkForSymbol(s,i,a){return o(s,n,a)}}}async function Ze(t,e){const n=we(t,e);be(n)}var F=t=>{const e=t.lastIndexOf("_");return e>-1?t.slice(e+1):t},Me="q:instance",Y={$DEBUG$:!1,$invPreloadProbability$:.65},et=Date.now(),tt=/\.[mc]?js$/,ge=0,nt=1,rt=2,ot=3,Z,M,st=(t,e)=>({$name$:t,$state$:tt.test(t)?ge:ot,$deps$:_e?e==null?void 0:e.map(n=>({...n,$factor$:1})):e,$inverseProbability$:1,$createdTs$:Date.now(),$waitedMs$:0,$loadedMs$:0}),at=t=>{const e=new Map;let n=0;for(;n<t.length;){const o=t[n++],r=[];let s,i=1;for(;s=t[n],typeof s=="number";)s<0?i=-s/10:r.push({$name$:t[s],$importProbability$:i,$factor$:1}),n++;e.set(o,r)}return e},qe=t=>{let e=ee.get(t);if(!e){let n;if(M){if(n=M.get(t),!n)return;n.length||(n=void 0)}e=st(t,n),ee.set(t,e)}return e},it=(t,e)=>{e&&("debug"in e&&(Y.$DEBUG$=!!e.debug),typeof e.preloadProbability=="number"&&(Y.$invPreloadProbability$=1-e.preloadProbability)),!(Z!=null||!t)&&(Z="",M=at(t))},ee=new Map,_e,Q,$e=0,L=[],ct=(...t)=>{console.log(`Preloader ${Date.now()-et}ms ${$e}/${L.length} queued>`,...t)},lt=()=>{ee.clear(),Q=!1,_e=!0,$e=0,L.length=0},ut=()=>{Q&&(L.sort((t,e)=>t.$inverseProbability$-e.$inverseProbability$),Q=!1)},ft=()=>{ut();let t=.4;const e=[];for(const n of L){const o=Math.round((1-n.$inverseProbability$)*10);o!==t&&(t=o,e.push(t)),e.push(n.$name$)}return e},Se=(t,e,n)=>{if(n!=null&&n.has(t))return;const o=t.$inverseProbability$;if(t.$inverseProbability$=e,!(o-t.$inverseProbability$<.01)&&(Z!=null&&t.$state$<rt&&(t.$state$===ge&&(t.$state$=nt,L.push(t),Y.$DEBUG$&&ct(`queued ${Math.round((1-t.$inverseProbability$)*100)}%`,t.$name$)),Q=!0),t.$deps$)){n||(n=new Set),n.add(t);const r=1-t.$inverseProbability$;for(const s of t.$deps$){const i=qe(s.$name$);if(i.$inverseProbability$===0)continue;let a;if(r===1||r>=.99&&te<100)te++,a=Math.min(.01,1-s.$importProbability$);else{const c=1-s.$importProbability$*r,f=s.$factor$,l=c/f;a=Math.max(.02,i.$inverseProbability$*l),s.$factor$=l}Se(i,a,n)}}},fe=(t,e)=>{const n=qe(t);n&&n.$inverseProbability$>e&&Se(n,e)},te,mt=(t,e)=>{if(!(t!=null&&t.length))return;te=0;let n=e?1-e:.4;if(Array.isArray(t))for(let o=t.length-1;o>=0;o--){const r=t[o];typeof r=="number"?n=1-r/10:fe(r,n)}else fe(t,n)};function dt(t){const e=[],n=o=>{if(o)for(const r of o)e.includes(r.url)||(e.push(r.url),r.imports&&n(r.imports))};return n(t),e}var pt=t=>{var o;const e=xe(),n=(o=t==null?void 0:t.qrls)==null?void 0:o.map(r=>{var c;const s=r.$refSymbol$||r.$symbol$,i=r.$chunk$,a=e.chunkForSymbol(s,i,(c=r.dev)==null?void 0:c.file);return a?a[1]:i}).filter(Boolean);return[...new Set(n)]};function ht(t,e,n){const o=e.prefetchStrategy;if(o===null)return[];if(!(n!=null&&n.manifest.bundleGraph))return pt(t);if(typeof(o==null?void 0:o.symbolsToPrefetch)=="function")try{const s=o.symbolsToPrefetch({manifest:n.manifest});return dt(s)}catch(s){console.error("getPrefetchUrls, symbolsToPrefetch()",s)}const r=new Set;for(const s of(t==null?void 0:t.qrls)||[]){const i=F(s.$refSymbol$||s.$symbol$);i&&i.length>=10&&r.add(i)}return[...r]}var bt=(t,e)=>{if(!(e!=null&&e.manifest.bundleGraph))return[...new Set(t)];lt();let n=.99;for(const o of t.slice(0,15))mt(o,n),n*=.85;return ft()},ne=(t,e)=>{if(e==null)return null;const n=`${t}${e}`.split("/"),o=[];for(const r of n)r===".."&&o.length>0?o.pop():o.push(r);return o.join("/")},vt=(t,e,n,o,r)=>{var c;const s=ne(t,(c=e==null?void 0:e.manifest)==null?void 0:c.preloader),i="/"+(e==null?void 0:e.manifest.bundleGraphAsset);if(s&&i&&n!==!1){const f=typeof n=="object"?{debug:n.debug,preloadProbability:n.ssrPreloadProbability}:void 0;it(e==null?void 0:e.manifest.bundleGraph,f);const l=[];n!=null&&n.debug&&l.push("d:1"),n!=null&&n.maxIdlePreloads&&l.push(`P:${n.maxIdlePreloads}`),n!=null&&n.preloadProbability&&l.push(`Q:${n.preloadProbability}`);const u=l.length?`,{${l.join(",")}}`:"",d=`let b=fetch("${i}");import("${s}").then(({l})=>l(${JSON.stringify(t)},b${u}));`;o.push(v("link",{rel:"modulepreload",href:s,nonce:r,crossorigin:"anonymous"}),v("link",{rel:"preload",href:i,as:"fetch",crossorigin:"anonymous",nonce:r}),v("script",{type:"module",async:!0,dangerouslySetInnerHTML:d,nonce:r}))}const a=ne(t,e==null?void 0:e.manifest.core);a&&o.push(v("link",{rel:"modulepreload",href:a,nonce:r}))},yt=(t,e,n,o,r)=>{if(o.length===0||n===!1)return null;const{ssrPreloads:s,ssrPreloadProbability:i}=gt(typeof n=="boolean"?void 0:n);let a=s;const c=[],f=[],l=e==null?void 0:e.manifest.manifestHash;if(a){const p=e==null?void 0:e.manifest.preloader,m=e==null?void 0:e.manifest.core,w=bt(o,e);let q=4;const A=i*10;for(const b of w)if(typeof b=="string"){if(q<A)break;if(b===p||b===m)continue;if(f.push(b),--a===0)break}else q=b}const u=ne(t,l&&(e==null?void 0:e.manifest.preloader));let y=f.length?`${JSON.stringify(f)}.map((l,e)=>{e=document.createElement('link');e.rel='modulepreload';e.href=${JSON.stringify(t)}+l;document.head.appendChild(e)});`:"";return u&&(y+=`window.addEventListener('load',f=>{f=_=>import("${u}").then(({p})=>p(${JSON.stringify(o)}));try{requestIdleCallback(f,{timeout:2000})}catch(e){setTimeout(f,200)}})`),y&&c.push(v("script",{type:"module","q:type":"preload",async:!0,dangerouslySetInnerHTML:y,nonce:r})),c.length>0?v(re,{children:c}):null},wt=(t,e,n,o,r)=>{var s;if(n.preloader!==!1){const i=ht(e,n,o);if(i.length>0){const a=yt(t,o,n.preloader,i,(s=n.serverData)==null?void 0:s.nonce);a&&r.push(a)}}};function gt(t){return{...qt,...t}}var qt={ssrPreloads:7,ssrPreloadProbability:.5,debug:!1,maxIdlePreloads:25,preloadProbability:.35},_t='const t=document,e=window,n=new Set,o=new Set([t]);let r;const s=(t,e)=>Array.from(t.querySelectorAll(e)),a=t=>{const e=[];return o.forEach(n=>e.push(...s(n,t))),e},i=t=>{w(t),s(t,"[q\\\\:shadowroot]").forEach(t=>{const e=t.shadowRoot;e&&i(e)})},c=t=>t&&"function"==typeof t.then,l=(t,e,n=e.type)=>{a("[on"+t+"\\\\:"+n+"]").forEach(o=>{b(o,t,e,n)})},f=e=>{if(void 0===e._qwikjson_){let n=(e===t.documentElement?t.body:e).lastElementChild;for(;n;){if("SCRIPT"===n.tagName&&"qwik/json"===n.getAttribute("type")){e._qwikjson_=JSON.parse(n.textContent.replace(/\\\\x3C(\\/?script)/gi,"<$1"));break}n=n.previousElementSibling}}},p=(t,e)=>new CustomEvent(t,{detail:e}),b=async(e,n,o,r=o.type)=>{const s="on"+n+":"+r;e.hasAttribute("preventdefault:"+r)&&o.preventDefault(),e.hasAttribute("stoppropagation:"+r)&&o.stopPropagation();const a=e._qc_,i=a&&a.li.filter(t=>t[0]===s);if(i&&i.length>0){for(const t of i){const n=t[1].getFn([e,o],()=>e.isConnected)(o,e),r=o.cancelBubble;c(n)&&await n,r&&o.stopPropagation()}return}const l=e.getAttribute(s);if(l){const n=e.closest("[q\\\\:container]"),r=n.getAttribute("q:base"),s=n.getAttribute("q:version")||"unknown",a=n.getAttribute("q:manifest-hash")||"dev",i=new URL(r,t.baseURI);for(const p of l.split("\\n")){const l=new URL(p,i),b=l.href,h=l.hash.replace(/^#?([^?[|]*).*$/,"$1")||"default",q=performance.now();let _,d,y;const w=p.startsWith("#"),g={qBase:r,qManifest:a,qVersion:s,href:b,symbol:h,element:e,reqTime:q};if(w){const e=n.getAttribute("q:instance");_=(t["qFuncs_"+e]||[])[Number.parseInt(h)],_||(d="sync",y=Error("sym:"+h))}else{u("qsymbol",g);const t=l.href.split("#")[0];try{const e=import(t);f(n),_=(await e)[h],_||(d="no-symbol",y=Error(`${h} not in ${t}`))}catch(t){d||(d="async"),y=t}}if(!_){u("qerror",{importError:d,error:y,...g}),console.error(y);break}const m=t.__q_context__;if(e.isConnected)try{t.__q_context__=[e,o,l];const n=_(o,e);c(n)&&await n}catch(t){u("qerror",{error:t,...g})}finally{t.__q_context__=m}}}},u=(e,n)=>{t.dispatchEvent(p(e,n))},h=t=>t.replace(/([A-Z])/g,t=>"-"+t.toLowerCase()),q=async t=>{let e=h(t.type),n=t.target;for(l("-document",t,e);n&&n.getAttribute;){const o=b(n,"",t,e);let r=t.cancelBubble;c(o)&&await o,r||(r=r||t.cancelBubble||n.hasAttribute("stoppropagation:"+t.type)),n=t.bubbles&&!0!==r?n.parentElement:null}},_=t=>{l("-window",t,h(t.type))},d=()=>{const s=t.readyState;if(!r&&("interactive"==s||"complete"==s)&&(o.forEach(i),r=1,u("qinit"),(e.requestIdleCallback??e.setTimeout).bind(e)(()=>u("qidle")),n.has("qvisible"))){const t=a("[on\\\\:qvisible]"),e=new IntersectionObserver(t=>{for(const n of t)n.isIntersecting&&(e.unobserve(n.target),b(n.target,"",p("qvisible",n)))});t.forEach(t=>e.observe(t))}},y=(t,e,n,o=!1)=>{t.addEventListener(e,n,{capture:o,passive:!1})},w=(...t)=>{for(const r of t)"string"==typeof r?n.has(r)||(o.forEach(t=>y(t,r,q,!0)),y(e,r,_,!0),n.add(r)):o.has(r)||(n.forEach(t=>y(r,t,q,!0)),o.add(r))};if(!("__q_context__"in t)){t.__q_context__=0;const r=e.qwikevents;r&&(Array.isArray(r)?w(...r):w("click","input")),e.qwikevents={events:n,roots:o,push:w},y(t,"readystatechange",d),d()}',$t=`const doc = document;
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
const broadcast = (infix, ev, type = ev.type) => {
  querySelectorAll("[on" + infix + "\\\\:" + type + "]").forEach((el) => {
    dispatch(el, infix, ev, type);
  });
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
  const readyState = doc.readyState;
  if (!hasInitialized && (readyState == "interactive" || readyState == "complete")) {
    roots.forEach(findShadowRoots);
    hasInitialized = 1;
    emitEvent("qinit");
    const riC = win.requestIdleCallback ?? win.setTimeout;
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
const processEventOrNode = (...eventNames) => {
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
}`;function St(t={}){return t.debug?$t:_t}function z(){if(typeof performance>"u")return()=>0;const t=performance.now();return()=>(performance.now()-t)/1e6}function kt(t){let e=t.base;return typeof t.base=="function"&&(e=t.base(t)),typeof e=="string"?(e.endsWith("/")||(e+="/"),e):"/build/"}var Et="<!DOCTYPE html>";async function Pt(t,e){var ae,ie;let n=e.stream,o=0,r=0,s=0,i=0,a="",c;const f=((ae=e.streaming)==null?void 0:ae.inOrder)??{strategy:"auto",maximunInitialChunk:5e4,maximunChunk:3e4},l=e.containerTagName??"html",u=e.containerAttributes??{},d=n,y=z(),p=kt(e),m=ke(e.manifest),w=(ie=e.serverData)==null?void 0:ie.nonce;function q(){a&&(d.write(a),a="",o=0,s++,s===1&&(i=y()))}function A(h){const g=h.length;o+=g,r+=g,a+=h}switch(f.strategy){case"disabled":n={write:A};break;case"direct":n=d;break;case"auto":let h=0,g=!1;const ce=f.maximunChunk??0,H=f.maximunInitialChunk??0;n={write(N){N==="<!--qkssr-f-->"?g||(g=!0):N==="<!--qkssr-pu-->"?h++:N==="<!--qkssr-po-->"?h--:A(N),h===0&&(g||o>=(s===0?H:ce))&&(g=!1,q())}};break}l==="html"?n.write(Et):n.write("<!--cq-->"),m||console.warn("Missing client manifest, loading symbols in the client might 404. Please ensure the client build has run and generated the manifest for the server build."),await Ze(e,m);const b=m==null?void 0:m.manifest.injections,k=b?b.map(h=>v(h.tag,h.attributes??{})):[];let _=e.qwikLoader?typeof e.qwikLoader=="object"?e.qwikLoader.include==="never"?2:0:e.qwikLoader==="inline"?1:e.qwikLoader==="never"?2:0:0;const B=m==null?void 0:m.manifest.qwikLoader;if(_===0&&!B&&(_=1),_===0)k.unshift(v("link",{rel:"modulepreload",href:`${p}${B}`,nonce:w}),v("script",{type:"module",async:!0,src:`${p}${B}`,nonce:w}));else if(_===1){const h=St({debug:e.debug});k.unshift(v("script",{id:"qwikloader",type:"module",async:!0,nonce:w,dangerouslySetInnerHTML:h}))}vt(p,m,e.preloader,k,w);const W=z(),J=[];let D=0,E=0;await Ae(t,{stream:n,containerTagName:l,containerAttributes:u,serverData:e.serverData,base:p,beforeContent:k,beforeClose:async(h,g,ce,H)=>{D=W();const N=z();c=await Ne(h,g,void 0,H);const x=[];wt(p,c,e,m,x);const Ce=JSON.stringify(c.state,void 0,void 0);if(x.push(v("script",{type:"qwik/json",dangerouslySetInnerHTML:At(Ce),nonce:w})),c.funcs.length>0){const j=u[Me];x.push(v("script",{"q:func":"qwik/json",dangerouslySetInnerHTML:It(j,c.funcs),nonce:w}))}const le=Array.from(g.$events$,j=>JSON.stringify(j));if(le.length>0){const j=`(window.qwikevents||(window.qwikevents=[])).push(${le.join(",")})`;x.push(v("script",{dangerouslySetInnerHTML:j,nonce:w}))}return Nt(J,h),E=N(),v(re,{children:x})},manifestHash:(m==null?void 0:m.manifest.manifestHash)||"dev"+Ct()}),l!=="html"&&n.write("<!--/cq-->"),q();const X=c.resources.some(h=>h._cache!==1/0);return{prefetchResources:void 0,snapshotResult:c,flushes:s,manifest:m==null?void 0:m.manifest,size:r,isStatic:!X,timing:{render:D,snapshot:E,firstFlush:i}}}function Ct(){return Math.random().toString(36).slice(2)}function ke(t){const e=t?{...K,...t}:K;if(!e||"mapper"in e)return e;if(e.mapping){const n={};return Object.entries(e.mapping).forEach(([o,r])=>{n[F(o)]=[o,r]}),{mapper:n,manifest:e,injections:e.injections||[]}}}var At=t=>t.replace(/<(\/?script)/gi,"\\x3C$1");function Nt(t,e){var n;for(const o of e){const r=(n=o.$componentQrl$)==null?void 0:n.getSymbol();r&&!t.includes(r)&&t.push(r)}}var xt='document["qFuncs_HASH"]=';function It(t,e){return xt.replace("HASH",t)+`[${e.join(`,
`)}]`}async function on(t){const e=we({},ke(t));be(e)}const jt=S("qc-s"),Rt=S("qc-c"),Ee=S("qc-ic"),Lt=S("qc-h"),Bt=S("qc-l"),Dt=S("qc-n"),Tt=S("qc-a"),Ot=S("qc-p"),Ut=Ue(Fe("s_XYv09pkbRnM")),Ft=()=>{if(!se("containerAttributes"))throw new Error("PrefetchServiceWorker component must be rendered on the server.");Ie();const e=je(Ee);if(e.value&&e.value.length>0){const n=e.value.length;let o=null;for(let r=n-1;r>=0;r--)e.value[r].default&&(o=I(e.value[r].default,{children:o},1,"C1_0"));return I(re,{children:[o,R("script",{"document:onQCInit$":Ut,"document:onQInit$":Re(()=>{((r,s)=>{var i;if(!r._qcs&&s.scrollRestoration==="manual"){r._qcs=!0;const a=(i=s.state)==null?void 0:i._qCityScroll;a&&r.scrollTo(a.x,a.y),document.dispatchEvent(new Event("qcinit"))}})(window,history)},'()=>{((w,h)=>{if(!w._qcs&&h.scrollRestoration==="manual"){w._qcs=true;const s=h.state?._qCityScroll;if(s){w.scrollTo(s.x,s.y);}document.dispatchEvent(new Event("qcinit"));}})(window,history);}')},null,null,2,"C1_1")]},1,"C1_2")}return Le},Qt=oe(C(Ft,"s_Dyc3NVEuHOA")),Gt=(t,e)=>new URL(t,e.href),me=(t,e)=>t.origin===e.origin,de=t=>t.endsWith("/")?t:t+"/",Wt=({pathname:t},{pathname:e})=>{const n=Math.abs(t.length-e.length);return n===0?t===e:n===1&&de(t)===de(e)},Jt=(t,e)=>t.search===e.search,G=(t,e)=>Jt(t,e)&&Wt(t,e),Xt=t=>t&&typeof t.then=="function",Ht=(t,e,n,o)=>{const r=Pe(),i={head:r,withLocale:a=>ue(o,a),resolveValue:a=>{const c=a.__id;if(a.__brand==="server_loader"&&!(c in t.loaders))throw new Error("You can not get the returned data of a loader that has not been executed for this request.");const f=t.loaders[c];if(Xt(f))throw new Error("Loaders returning a promise can not be resolved for the head function.");return f},...e};for(let a=n.length-1;a>=0;a--){const c=n[a]&&n[a].head;c&&(typeof c=="function"?pe(r,ue(o,()=>c(i))):typeof c=="object"&&pe(r,c))}return i.head},pe=(t,e)=>{typeof e.title=="string"&&(t.title=e.title),O(t.meta,e.meta),O(t.links,e.links),O(t.styles,e.styles),O(t.scripts,e.scripts),Object.assign(t.frontmatter,e.frontmatter)},O=(t,e)=>{if(Array.isArray(e))for(const n of e){if(typeof n.key=="string"){const o=t.findIndex(r=>r.key===n.key);if(o>-1){t[o]=n;continue}}t.push(n)}},Pe=()=>({title:"",meta:[],links:[],styles:[],scripts:[],frontmatter:{}}),Vt=()=>ve(se("qwikcity")),he={},U={navCount:0},zt=":root{view-transition-name:none}",Kt=t=>{},Yt=async(t,e)=>{const[n,o,r,s]=ye(),{type:i="link",forceReload:a=t===void 0,replaceState:c=!1,scroll:f=!0}=typeof e=="object"?e:{forceReload:e};U.navCount++;const l=r.value.dest,u=t===void 0?l:typeof t=="number"?t:Gt(t,s.url);if(he.$cbs$&&(a||typeof u=="number"||!G(u,l)||!me(u,l))){const d=U.navCount,y=await Promise.all([...he.$cbs$.values()].map(p=>p(u)));if(d!==U.navCount||y.some(Boolean)){d===U.navCount&&i==="popstate"&&history.pushState(null,"",l);return}}if(typeof u!="number"&&me(u,l)){if(!a&&G(u,l)){if(u.href!==s.url.href){const d=new URL(u.href);r.value.dest=d,s.url=d}return}return r.value={type:i,dest:u,forceReload:a,replaceState:c,scroll:f},n.value=void 0,s.isNavigating=!0,new Promise(d=>{o.r=d})}},Zt=({track:t})=>{const[e,n,o,r,s,i,a,c,f,l,u]=ye();async function d(){const p=t(l),m=t(e),w=Qe(""),q=u.url,A=m?"form":p.type;p.replaceState;let b,k,_=null;if(b=new URL(p.dest,u.url),_=s.loadedRoute,k=s.response,_){const[B,W,J,D]=_,E=J,X=E[E.length-1];p.dest.search&&G(b,q)&&(b.search=p.dest.search),G(b,q)||(u.prevUrl=q),u.url=b,u.params={...W},l.untrackedValue={type:A,dest:b};const P=Ht(k,u,E,w);n.headings=X.headings,n.menu=D,o.value=ve(E),r.links=P.links,r.meta=P.meta,r.styles=P.styles,r.scripts=P.scripts,r.title=P.title,r.frontmatter=P.frontmatter}}return d()},Mt=t=>{Be(C(zt,"s_0S001XID1T8"));const e=Vt();if(!(e!=null&&e.params))throw new Error("Missing Qwik City Env Data for help visit https://github.com/QwikDev/qwik/issues/6237");const n=se("url");if(!n)throw new Error("Missing Qwik URL Env Data");if(e.ev.originalUrl.pathname!==e.ev.url.pathname)throw new Error('enableRequestRewrite is an experimental feature and is not enabled. Please enable the feature flag by adding `experimental: ["enableRequestRewrite"]` to your qwikVite plugin options.');const o=new URL(n),r=T({url:o,params:e.params,isNavigating:!1,prevUrl:void 0},{deep:!1}),s={},i=De(T(e.response.loaders,{deep:!1})),a=V({type:"initial",dest:o,forceReload:!1,replaceState:!1,scroll:!0}),c=T(Pe),f=T({headings:void 0,menu:void 0}),l=V(),u=e.response.action,d=u?e.response.loaders[u]:void 0,y=V(d?{id:u,data:e.response.formData,output:{result:d,status:e.response.status}}:void 0),p=C(Kt,"s_83FaWKCqUKk"),m=C(Yt,"s_nFJdkBsXn4w",[y,s,a,r]);return $(Rt,f),$(Ee,l),$(Lt,c),$(Bt,r),$(Dt,m),$(jt,i),$(Tt,y),$(Ot,p),Te(C(Zt,"s_VqdmCb830JE",[y,f,l,c,e,m,i,s,t,a,r])),I(Oe,null,3,"C1_3")},en=oe(C(Mt,"s_jvybUipfwTA")),tn=()=>I(en,{children:[R("head",null,null,[R("meta",null,{charSet:"utf-8"},null,3,null),R("title",null,null,"Qwik Upload",3,null)],3,null),R("body",null,{lang:"en"},I(Qt,null,3,"Um_0"),1,null)]},1,"Um_1"),nn=oe(C(tn,"s_JBlkrZuAnvk"));function sn(t){return Pt(I(nn,null,3,"cG_0"),{manifest:K,...t,containerAttributes:{lang:"en-us",...t.containerAttributes}})}export{K as m,sn as r,on as s};
