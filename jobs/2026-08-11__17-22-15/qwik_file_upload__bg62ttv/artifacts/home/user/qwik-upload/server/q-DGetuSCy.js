import{s as V,k as d,l as le,m as ue,n as z,o as fe,c as me,i as de,e as D,d as C,R as be,Q as pe}from"./q-G4rJckwQ.js";const T={manifestHash:"44syl2",core:"q-7TQ8a7Ks.js",preloader:"q-DoNi8vyY.js",qwikLoader:"q-naDMFAHy.js",bundleGraphAsset:"assets/XacoDkuM-bundle-graph.json",injections:[],mapping:{s_VqdmCb830JE:"q-BwOHZbfG.js",s_ywT8MBPZSLE:"q-CR1WUlRo.js",s_hLIkr6For0A:"q-Bjhtwx-2.js",s_MRI6TE2FBmQ:"q-Cg_F4DXm.js",s_1nvBbqm8rv0:"q-CvqHD3dj.js",s_Dyc3NVEuHOA:"q-Ci9yGK6k.js",s_JBlkrZuAnvk:"q-Db-IcMQY.js",s_X2dN10myrPM:"q-8aneZD3u.js",s_bHZWuyJGORo:"q-CR1WUlRo.js",s_jvybUipfwTA:"q-BwOHZbfG.js",s_kdKHYpe00Bs:"q-DBkCEhZM.js",s_rHy321kICAo:"q-gU1EgwQ3.js",s_0S001XID1T8:"q-BwOHZbfG.js",s_3Y8h14ptAEs:"q-BALiceuk.js",s_IR16AtvBauw:"q-BZEkyV1i.js",s_XYv09pkbRnM:"q-BQtTnS_2.js",s_uk0UpfO8Zdw:"q-CUeMGqBr.js",s_83FaWKCqUKk:"q-BwOHZbfG.js",s_BZn2jV5J03s:"q-CR1WUlRo.js",s_MPvY7ssXksc:"q-DBkCEhZM.js",s_eoVvrfARMeI:"q-DBkCEhZM.js",s_fA0q61zziYY:"q-8aneZD3u.js",s_kUPS7nDpPTU:"q-8aneZD3u.js",s_nFJdkBsXn4w:"q-BwOHZbfG.js",s_spvFRxee2Dk:"q-DBkCEhZM.js",s_ysv6Nj0P0rw:"q-CvqHD3dj.js"}};/**
 * @license
 * @builder.io/qwik/server 1.20.0
 * Copyright Builder.io, Inc. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/QwikDev/qwik/blob/main/LICENSE
 */var he=!1,ye="",ve=(t,...e)=>{const n=ge(he,t,...e);debugger;return n},qe=t=>t,ge=(t,e,...n)=>{const r=e instanceof Error?e:new Error(e);return console.error("%cQWIK ERROR",ye,r.message,...qe(n),r.stack),r},we=(t,...e)=>`Code(${t}) https://github.com/QwikDev/qwik/blob/main/packages/qwik/src/core/error/error.ts#L${8+t}`,_e=11,$e=(t,...e)=>{const n=we(t,...e);return ve(n,...e)},Ee="<sync>";function X(t,e){const n=e==null?void 0:e.mapper,r=t.symbolMapper?t.symbolMapper:(s,i,a)=>{var c;if(n){const u=j(s),l=n[u];if(!l){if(u===Ee)return[u,""];if((c=globalThis.__qwik_reg_symbols)==null?void 0:c.has(u))return[s,"_"];if(a)return[s,`${a}?qrl=${s}`];console.error("Cannot resolve symbol",s,"in",n,a)}return l}};return{isServer:!0,async importSymbol(s,i,a){var l;const c=j(a),u=(l=globalThis.__qwik_reg_symbols)==null?void 0:l.get(c);if(u)return u;throw $e(_e,a)},raf:()=>(console.error("server can not rerender"),Promise.resolve()),nextTick:s=>new Promise(i=>{setTimeout(()=>{i(s())})}),chunkForSymbol(s,i,a){return r(s,n,a)}}}async function ke(t,e){const n=X(t,e);V(n)}var j=t=>{const e=t.lastIndexOf("_");return e>-1?t.slice(e+1):t},Pe="q:instance",L={$DEBUG$:!1,$invPreloadProbability$:.65},Se=Date.now(),Ae=/\.[mc]?js$/,M=0,Ce=1,je=2,Be=3,O,R,Ne=(t,e)=>({$name$:t,$state$:Ae.test(t)?M:Be,$deps$:te?e==null?void 0:e.map(n=>({...n,$factor$:1})):e,$inverseProbability$:1,$createdTs$:Date.now(),$waitedMs$:0,$loadedMs$:0}),Ie=t=>{const e=new Map;let n=0;for(;n<t.length;){const r=t[n++],o=[];let s,i=1;for(;s=t[n],typeof s=="number";)s<0?i=-s/10:o.push({$name$:t[s],$importProbability$:i,$factor$:1}),n++;e.set(r,o)}return e},ee=t=>{let e=F.get(t);if(!e){let n;if(R){if(n=R.get(t),!n)return;n.length||(n=void 0)}e=Ne(t,n),F.set(t,e)}return e},xe=(t,e)=>{e&&("debug"in e&&(L.$DEBUG$=!!e.debug),typeof e.preloadProbability=="number"&&(L.$invPreloadProbability$=1-e.preloadProbability)),!(O!=null||!t)&&(O="",R=Ie(t))},F=new Map,te,B,ne=0,k=[],De=(...t)=>{console.log(`Preloader ${Date.now()-Se}ms ${ne}/${k.length} queued>`,...t)},Te=()=>{F.clear(),B=!1,te=!0,ne=0,k.length=0},Le=()=>{B&&(k.sort((t,e)=>t.$inverseProbability$-e.$inverseProbability$),B=!1)},Oe=()=>{Le();let t=.4;const e=[];for(const n of k){const r=Math.round((1-n.$inverseProbability$)*10);r!==t&&(t=r,e.push(t)),e.push(n.$name$)}return e},re=(t,e,n)=>{if(n!=null&&n.has(t))return;const r=t.$inverseProbability$;if(t.$inverseProbability$=e,!(r-t.$inverseProbability$<.01)&&(O!=null&&t.$state$<je&&(t.$state$===M&&(t.$state$=Ce,k.push(t),L.$DEBUG$&&De(`queued ${Math.round((1-t.$inverseProbability$)*100)}%`,t.$name$)),B=!0),t.$deps$)){n||(n=new Set),n.add(t);const o=1-t.$inverseProbability$;for(const s of t.$deps$){const i=ee(s.$name$);if(i.$inverseProbability$===0)continue;let a;if(o===1||o>=.99&&Q<100)Q++,a=Math.min(.01,1-s.$importProbability$);else{const c=1-s.$importProbability$*o,u=s.$factor$,l=c/u;a=Math.max(.02,i.$inverseProbability$*l),s.$factor$=l}re(i,a,n)}}},K=(t,e)=>{const n=ee(t);n&&n.$inverseProbability$>e&&re(n,e)},Q,Re=(t,e)=>{if(!(t!=null&&t.length))return;Q=0;let n=e?1-e:.4;if(Array.isArray(t))for(let r=t.length-1;r>=0;r--){const o=t[r];typeof o=="number"?n=1-o/10:K(o,n)}else K(t,n)};function Fe(t){const e=[],n=r=>{if(r)for(const o of r)e.includes(o.url)||(e.push(o.url),o.imports&&n(o.imports))};return n(t),e}var Qe=t=>{var r;const e=fe(),n=(r=t==null?void 0:t.qrls)==null?void 0:r.map(o=>{var c;const s=o.$refSymbol$||o.$symbol$,i=o.$chunk$,a=e.chunkForSymbol(s,i,(c=o.dev)==null?void 0:c.file);return a?a[1]:i}).filter(Boolean);return[...new Set(n)]};function Ue(t,e,n){const r=e.prefetchStrategy;if(r===null)return[];if(!(n!=null&&n.manifest.bundleGraph))return Qe(t);if(typeof(r==null?void 0:r.symbolsToPrefetch)=="function")try{const s=r.symbolsToPrefetch({manifest:n.manifest});return Fe(s)}catch(s){console.error("getPrefetchUrls, symbolsToPrefetch()",s)}const o=new Set;for(const s of(t==null?void 0:t.qrls)||[]){const i=j(s.$refSymbol$||s.$symbol$);i&&i.length>=10&&o.add(i)}return[...o]}var He=(t,e)=>{if(!(e!=null&&e.manifest.bundleGraph))return[...new Set(t)];Te();let n=.99;for(const r of t.slice(0,15))Re(r,n),n*=.85;return Oe()},U=(t,e)=>{if(e==null)return null;const n=`${t}${e}`.split("/"),r=[];for(const o of n)o===".."&&r.length>0?r.pop():r.push(o);return r.join("/")},Ze=(t,e,n,r,o)=>{var c;const s=U(t,(c=e==null?void 0:e.manifest)==null?void 0:c.preloader),i="/"+(e==null?void 0:e.manifest.bundleGraphAsset);if(s&&i&&n!==!1){const u=typeof n=="object"?{debug:n.debug,preloadProbability:n.ssrPreloadProbability}:void 0;xe(e==null?void 0:e.manifest.bundleGraph,u);const l=[];n!=null&&n.debug&&l.push("d:1"),n!=null&&n.maxIdlePreloads&&l.push(`P:${n.maxIdlePreloads}`),n!=null&&n.preloadProbability&&l.push(`Q:${n.preloadProbability}`);const h=l.length?`,{${l.join(",")}}`:"",w=`let b=fetch("${i}");import("${s}").then(({l})=>l(${JSON.stringify(t)},b${h}));`;r.push(d("link",{rel:"modulepreload",href:s,nonce:o,crossorigin:"anonymous"}),d("link",{rel:"preload",href:i,as:"fetch",crossorigin:"anonymous",nonce:o}),d("script",{type:"module",async:!0,dangerouslySetInnerHTML:w,nonce:o}))}const a=U(t,e==null?void 0:e.manifest.core);a&&r.push(d("link",{rel:"modulepreload",href:a,nonce:o}))},Ge=(t,e,n,r,o)=>{if(r.length===0||n===!1)return null;const{ssrPreloads:s,ssrPreloadProbability:i}=We(typeof n=="boolean"?void 0:n);let a=s;const c=[],u=[],l=e==null?void 0:e.manifest.manifestHash;if(a){const v=e==null?void 0:e.manifest.preloader,f=e==null?void 0:e.manifest.core,p=He(r,e);let $=4;const P=i*10;for(const y of p)if(typeof y=="string"){if($<P)break;if(y===v||y===f)continue;if(u.push(y),--a===0)break}else $=y}const h=U(t,l&&(e==null?void 0:e.manifest.preloader));let _=u.length?`${JSON.stringify(u)}.map((l,e)=>{e=document.createElement('link');e.rel='modulepreload';e.href=${JSON.stringify(t)}+l;document.head.appendChild(e)});`:"";return h&&(_+=`window.addEventListener('load',f=>{f=_=>import("${h}").then(({p})=>p(${JSON.stringify(r)}));try{requestIdleCallback(f,{timeout:2000})}catch(e){setTimeout(f,200)}})`),_&&c.push(d("script",{type:"module","q:type":"preload",async:!0,dangerouslySetInnerHTML:_,nonce:o})),c.length>0?d(z,{children:c}):null},Je=(t,e,n,r,o)=>{var s;if(n.preloader!==!1){const i=Ue(e,n,r);if(i.length>0){const a=Ge(t,r,n.preloader,i,(s=n.serverData)==null?void 0:s.nonce);a&&o.push(a)}}};function We(t){return{...Ye,...t}}var Ye={ssrPreloads:7,ssrPreloadProbability:.5,debug:!1,maxIdlePreloads:25,preloadProbability:.35},Ke='const t=document,e=window,n=new Set,o=new Set([t]);let r;const s=(t,e)=>Array.from(t.querySelectorAll(e)),a=t=>{const e=[];return o.forEach(n=>e.push(...s(n,t))),e},i=t=>{w(t),s(t,"[q\\\\:shadowroot]").forEach(t=>{const e=t.shadowRoot;e&&i(e)})},c=t=>t&&"function"==typeof t.then,l=(t,e,n=e.type)=>{a("[on"+t+"\\\\:"+n+"]").forEach(o=>{b(o,t,e,n)})},f=e=>{if(void 0===e._qwikjson_){let n=(e===t.documentElement?t.body:e).lastElementChild;for(;n;){if("SCRIPT"===n.tagName&&"qwik/json"===n.getAttribute("type")){e._qwikjson_=JSON.parse(n.textContent.replace(/\\\\x3C(\\/?script)/gi,"<$1"));break}n=n.previousElementSibling}}},p=(t,e)=>new CustomEvent(t,{detail:e}),b=async(e,n,o,r=o.type)=>{const s="on"+n+":"+r;e.hasAttribute("preventdefault:"+r)&&o.preventDefault(),e.hasAttribute("stoppropagation:"+r)&&o.stopPropagation();const a=e._qc_,i=a&&a.li.filter(t=>t[0]===s);if(i&&i.length>0){for(const t of i){const n=t[1].getFn([e,o],()=>e.isConnected)(o,e),r=o.cancelBubble;c(n)&&await n,r&&o.stopPropagation()}return}const l=e.getAttribute(s);if(l){const n=e.closest("[q\\\\:container]"),r=n.getAttribute("q:base"),s=n.getAttribute("q:version")||"unknown",a=n.getAttribute("q:manifest-hash")||"dev",i=new URL(r,t.baseURI);for(const p of l.split("\\n")){const l=new URL(p,i),b=l.href,h=l.hash.replace(/^#?([^?[|]*).*$/,"$1")||"default",q=performance.now();let _,d,y;const w=p.startsWith("#"),g={qBase:r,qManifest:a,qVersion:s,href:b,symbol:h,element:e,reqTime:q};if(w){const e=n.getAttribute("q:instance");_=(t["qFuncs_"+e]||[])[Number.parseInt(h)],_||(d="sync",y=Error("sym:"+h))}else{u("qsymbol",g);const t=l.href.split("#")[0];try{const e=import(t);f(n),_=(await e)[h],_||(d="no-symbol",y=Error(`${h} not in ${t}`))}catch(t){d||(d="async"),y=t}}if(!_){u("qerror",{importError:d,error:y,...g}),console.error(y);break}const m=t.__q_context__;if(e.isConnected)try{t.__q_context__=[e,o,l];const n=_(o,e);c(n)&&await n}catch(t){u("qerror",{error:t,...g})}finally{t.__q_context__=m}}}},u=(e,n)=>{t.dispatchEvent(p(e,n))},h=t=>t.replace(/([A-Z])/g,t=>"-"+t.toLowerCase()),q=async t=>{let e=h(t.type),n=t.target;for(l("-document",t,e);n&&n.getAttribute;){const o=b(n,"",t,e);let r=t.cancelBubble;c(o)&&await o,r||(r=r||t.cancelBubble||n.hasAttribute("stoppropagation:"+t.type)),n=t.bubbles&&!0!==r?n.parentElement:null}},_=t=>{l("-window",t,h(t.type))},d=()=>{const s=t.readyState;if(!r&&("interactive"==s||"complete"==s)&&(o.forEach(i),r=1,u("qinit"),(e.requestIdleCallback??e.setTimeout).bind(e)(()=>u("qidle")),n.has("qvisible"))){const t=a("[on\\\\:qvisible]"),e=new IntersectionObserver(t=>{for(const n of t)n.isIntersecting&&(e.unobserve(n.target),b(n.target,"",p("qvisible",n)))});t.forEach(t=>e.observe(t))}},y=(t,e,n,o=!1)=>{t.addEventListener(e,n,{capture:o,passive:!1})},w=(...t)=>{for(const r of t)"string"==typeof r?n.has(r)||(o.forEach(t=>y(t,r,q,!0)),y(e,r,_,!0),n.add(r)):o.has(r)||(n.forEach(t=>y(r,t,q,!0)),o.add(r))};if(!("__q_context__"in t)){t.__q_context__=0;const r=e.qwikevents;r&&(Array.isArray(r)?w(...r):w("click","input")),e.qwikevents={events:n,roots:o,push:w},y(t,"readystatechange",d),d()}',Ve=`const doc = document;
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
}`;function ze(t={}){return t.debug?Ve:Ke}function x(){if(typeof performance>"u")return()=>0;const t=performance.now();return()=>(performance.now()-t)/1e6}function Xe(t){let e=t.base;return typeof t.base=="function"&&(e=t.base(t)),typeof e=="string"?(e.endsWith("/")||(e+="/"),e):"/build/"}var Me="<!DOCTYPE html>";async function et(t,e){var G,J;let n=e.stream,r=0,o=0,s=0,i=0,a="",c;const u=((G=e.streaming)==null?void 0:G.inOrder)??{strategy:"auto",maximunInitialChunk:5e4,maximunChunk:3e4},l=e.containerTagName??"html",h=e.containerAttributes??{},w=n,_=x(),v=Xe(e),f=oe(e.manifest),p=(J=e.serverData)==null?void 0:J.nonce;function $(){a&&(w.write(a),a="",r=0,s++,s===1&&(i=_()))}function P(m){const b=m.length;r+=b,o+=b,a+=m}switch(u.strategy){case"disabled":n={write:P};break;case"direct":n=w;break;case"auto":let m=0,b=!1;const W=u.maximunChunk??0,I=u.maximunInitialChunk??0;n={write(q){q==="<!--qkssr-f-->"?b||(b=!0):q==="<!--qkssr-pu-->"?m++:q==="<!--qkssr-po-->"?m--:P(q),m===0&&(b||r>=(s===0?I:W))&&(b=!1,$())}};break}l==="html"?n.write(Me):n.write("<!--cq-->"),f||console.warn("Missing client manifest, loading symbols in the client might 404. Please ensure the client build has run and generated the manifest for the server build."),await ke(e,f);const y=f==null?void 0:f.manifest.injections,S=y?y.map(m=>d(m.tag,m.attributes??{})):[];let A=e.qwikLoader?typeof e.qwikLoader=="object"?e.qwikLoader.include==="never"?2:0:e.qwikLoader==="inline"?1:e.qwikLoader==="never"?2:0:0;const N=f==null?void 0:f.manifest.qwikLoader;if(A===0&&!N&&(A=1),A===0)S.unshift(d("link",{rel:"modulepreload",href:`${v}${N}`,nonce:p}),d("script",{type:"module",async:!0,src:`${v}${N}`,nonce:p}));else if(A===1){const m=ze({debug:e.debug});S.unshift(d("script",{id:"qwikloader",type:"module",async:!0,nonce:p,dangerouslySetInnerHTML:m}))}Ze(v,f,e.preloader,S,p);const se=x(),ie=[];let H=0,Z=0;await le(t,{stream:n,containerTagName:l,containerAttributes:h,serverData:e.serverData,base:v,beforeContent:S,beforeClose:async(m,b,W,I)=>{H=se();const q=x();c=await ue(m,b,void 0,I);const g=[];Je(v,c,e,f,g);const ce=JSON.stringify(c.state,void 0,void 0);if(g.push(d("script",{type:"qwik/json",dangerouslySetInnerHTML:nt(ce),nonce:p})),c.funcs.length>0){const E=h[Pe];g.push(d("script",{"q:func":"qwik/json",dangerouslySetInnerHTML:st(E,c.funcs),nonce:p}))}const Y=Array.from(b.$events$,E=>JSON.stringify(E));if(Y.length>0){const E=`(window.qwikevents||(window.qwikevents=[])).push(${Y.join(",")})`;g.push(d("script",{dangerouslySetInnerHTML:E,nonce:p}))}return rt(ie,m),Z=q(),d(z,{children:g})},manifestHash:(f==null?void 0:f.manifest.manifestHash)||"dev"+tt()}),l!=="html"&&n.write("<!--/cq-->"),$();const ae=c.resources.some(m=>m._cache!==1/0);return{prefetchResources:void 0,snapshotResult:c,flushes:s,manifest:f==null?void 0:f.manifest,size:o,isStatic:!ae,timing:{render:H,snapshot:Z,firstFlush:i}}}function tt(){return Math.random().toString(36).slice(2)}function oe(t){const e=t?{...T,...t}:T;if(!e||"mapper"in e)return e;if(e.mapping){const n={};return Object.entries(e.mapping).forEach(([r,o])=>{n[j(r)]=[r,o]}),{mapper:n,manifest:e,injections:e.injections||[]}}}var nt=t=>t.replace(/<(\/?script)/gi,"\\x3C$1");function rt(t,e){var n;for(const r of e){const o=(n=r.$componentQrl$)==null?void 0:n.getSymbol();o&&!t.includes(o)&&t.push(o)}}var ot='document["qFuncs_HASH"]=';function st(t,e){return ot.replace("HASH",t)+`[${e.join(`,
`)}]`}async function ut(t){const e=X({},oe(t));V(e)}const it=()=>D(pe,{children:[C("head",null,null,[C("meta",null,{charSet:"utf-8"},null,3,null),C("title",null,null,"Qwik Upload",3,null)],3,null),C("body",null,{lang:"en"},D(be,null,3,"Um_0"),1,null)]},1,"Um_1"),at=me(de(it,"s_JBlkrZuAnvk"));function ft(t){return et(D(at,null,3,"cG_0"),{manifest:T,...t,containerAttributes:{lang:"en-us",...t.containerAttributes}})}export{T as m,ft as r,ut as s};
