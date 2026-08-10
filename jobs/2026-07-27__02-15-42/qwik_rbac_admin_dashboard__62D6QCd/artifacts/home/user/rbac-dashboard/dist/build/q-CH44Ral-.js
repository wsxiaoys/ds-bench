import{d,m as p,i as c,z as r,g as s,q as i,c as m}from"./q-Dm-n0CeS.js";import{_ as u}from"./q-DoNi8vyY.js";import{u as b}from"./q-CeHRC3tv.js";const g=(l,e)=>{const[n]=d();return n.password=e.value},f=Object.freeze(Object.defineProperty({__proto__:null,s_LAxLHhv5Pzc:g},Symbol.toStringTag,{value:"Module"})),v=(l,e)=>{const[n]=d();return n.username=e.value},x=Object.freeze(Object.defineProperty({__proto__:null,s_ksRAwHb3bRY:v},Symbol.toStringTag,{value:"Module"})),h=async l=>{const[e,n,t,a]=d();l.preventDefault(),e.value="",t.value=!0;try{const o=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:n.username,password:n.password})}),_=await o.json();o.ok?a("/"):e.value=_.error||"Login failed"}catch{e.value="An unexpected error occurred"}finally{t.value=!1}},w=Object.freeze(Object.defineProperty({__proto__:null,_hW:m,s_7kjvtn2PjUs:h},Symbol.toStringTag,{value:"Module"})),y=()=>{const l=b(),e=p({username:"",password:""}),n=c(""),t=c(!1),a=i(()=>u(()=>Promise.resolve().then(()=>w),void 0),"s_7kjvtn2PjUs",[n,e,t,l]);return r("div",null,{class:"login-container"},[r("style",null,null,`
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .login-card {
          background: white;
          padding: 2.5rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          width: 100%;
          max-width: 400px;
          box-sizing: border-box;
        }
        h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          color: #111827;
          font-size: 1.75rem;
          font-weight: 700;
          text-align: center;
        }
        .form-group {
          margin-bottom: 1.25rem;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
          color: #374151;
          font-weight: 500;
          font-size: 0.875rem;
        }
        input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 1rem;
          box-sizing: border-box;
          transition: border-color 0.15s ease-in-out;
        }
        input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        button {
          width: 100%;
          padding: 0.75rem;
          background-color: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease-in-out;
        }
        button:hover {
          background-color: #1d4ed8;
        }
        button:disabled {
          background-color: #93c5fd;
          cursor: not-allowed;
        }
        .error {
          background-color: #fee2e2;
          border: 1px solid #fca5a5;
          color: #b91c1c;
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 1.25rem;
          font-size: 0.875rem;
        }
      `,3,null),r("div",null,{class:"login-card"},[r("h2",null,null,"RBAC Admin Portal",3,null),n.value&&r("div",null,{class:"error"},s(o=>o.value,[n]),3,"YA_0"),r("form",null,{onSubmit$:a},[r("div",null,{class:"form-group"},[r("label",null,{for:"username"},"Username",3,null),r("input",null,{type:"text",id:"username",value:s(o=>o.username,[e]),required:!0,placeholder:"Enter username",onInput$:i(()=>u(()=>Promise.resolve().then(()=>x),void 0),"s_ksRAwHb3bRY",[e])},null,3,null)],3,null),r("div",null,{class:"form-group"},[r("label",null,{for:"password"},"Password",3,null),r("input",null,{type:"password",id:"password",value:s(o=>o.password,[e]),required:!0,placeholder:"Enter password",onInput$:i(()=>u(()=>Promise.resolve().then(()=>f),void 0),"s_LAxLHhv5Pzc",[e])},null,3,null)],3,null),r("button",null,{type:"submit",disabled:s(o=>o.value,[t])},s(o=>o.value?"Logging in...":"Sign In",[t]),3,null)],3,null)],1,null)],1,"YA_1")},k=Object.freeze(Object.defineProperty({__proto__:null,s_iKS70r97dlI:y},Symbol.toStringTag,{value:"Module"}));export{m as _hW,k as i,h as s_7kjvtn2PjUs,g as s_LAxLHhv5Pzc,y as s_iKS70r97dlI,v as s_ksRAwHb3bRY};
