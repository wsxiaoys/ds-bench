import{d as p,z as e,i as _,m as h,l as x,g as t,D as g,q as d,c as f}from"./q-Dm-n0CeS.js";import{_ as c}from"./q-DoNi8vyY.js";import{useAdminLoader as y}from"./q-C2gUYeEQ.js";import{u as w}from"./q-CeHRC3tv.js";const S=(n,r)=>{const[o]=p();return o.password=r.value},k=Object.freeze(Object.defineProperty({__proto__:null,s_Da3EaCU2z7Q:S},Symbol.toStringTag,{value:"Module"})),A=(n,r)=>{const[o]=p();return o.username=r.value},E=Object.freeze(Object.defineProperty({__proto__:null,s_y3yeCC0L9LQ:A},Symbol.toStringTag,{value:"Module"})),O=(n,r)=>{const[o]=p();return o.role=r.value},C=Object.freeze(Object.defineProperty({__proto__:null,s_7g3f99JA5Cw:O},Symbol.toStringTag,{value:"Module"})),P=async n=>{const[r,o,a,u,i]=p();n.preventDefault(),r.value="",u.value="",a.value=!0;try{const s=await fetch("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:o.username,password:o.password,role:o.role})}),m=await s.json();s.ok?(u.value=`User "${m.username}" created successfully!`,i.value=[...i.value,m],o.username="",o.password="",o.role="viewer"):r.value=m.error||"Failed to add user"}catch{r.value="An unexpected error occurred"}finally{a.value=!1}},j=Object.freeze(Object.defineProperty({__proto__:null,_hW:f,s_AbEj8SdArMk:P},Symbol.toStringTag,{value:"Module"})),z=async()=>{const[n]=p();await fetch("/api/logout",{method:"POST"}),n("/login")},I=Object.freeze(Object.defineProperty({__proto__:null,_hW:f,s_S5rIuE20Yr0:z},Symbol.toStringTag,{value:"Module"})),L=()=>{const n=y(),r=w();if(n.value.forbidden)return e("div",null,{class:"forbidden-container"},[e("style",null,null,`
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            background: white;
            padding: 2.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 {
            color: #dc2626;
            margin-top: 0;
          }
          p {
            color: #4b5563;
            margin-bottom: 1.5rem;
          }
          .btn {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
          }
        `,3,null),e("div",null,{class:"card"},[e("h1",null,null,"403 - Forbidden",3,null),e("p",null,null,"You do not have administrative privileges to access this area.",3,null),e("a",null,{href:"/",class:"btn"},"Back to Dashboard",3,null)],3,null)],3,"Vm_0");const o=_(n.value.users||[]),a=h({username:"",password:"",role:"viewer"}),u=_(""),i=_(""),s=_(!1);x(d(()=>c(()=>import("./q-CS-gqG0J.js"),[]),"s_tqiHi8vns7k",[n,o]));const m=d(()=>c(()=>Promise.resolve().then(()=>j),void 0),"s_AbEj8SdArMk",[u,a,s,i,o]),v=d(()=>c(()=>Promise.resolve().then(()=>I),void 0),"s_S5rIuE20Yr0",[r]);return e("div",null,{class:"admin-dashboard"},[e("style",null,null,`
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #f3f4f6;
          color: #1f2937;
        }
        header {
          background-color: white;
          border-bottom: 1px solid #e5e7eb;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        header h1 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
        }
        nav a {
          color: #4b5563;
          text-decoration: none;
          margin-right: 1.5rem;
          font-weight: 500;
        }
        nav a:hover, nav a.active {
          color: #2563eb;
        }
        .logout-btn {
          background: none;
          border: 1px solid #d1d5db;
          color: #4b5563;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        .logout-btn:hover {
          background-color: #f9fafb;
          color: #111827;
        }
        .container {
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 1rem;
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
        }
        @media (max-width: 768px) {
          .container {
            grid-template-columns: 1fr;
          }
        }
        .section-card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        .section-card h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          font-size: 1.25rem;
          color: #111827;
          border-bottom: 1px solid #f3f4f6;
          padding-bottom: 0.75rem;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        th, td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e5e7eb;
        }
        th {
          background-color: #f9fafb;
          color: #374151;
          font-weight: 600;
        }
        .badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .badge-admin { background-color: #fee2e2; color: #991b1b; }
        .badge-editor { background-color: #fef3c7; color: #92400e; }
        .badge-viewer { background-color: #e0f2fe; color: #075985; }
        
        .form-group {
          margin-bottom: 1rem;
        }
        label {
          display: block;
          margin-bottom: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
        }
        input, select {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.875rem;
          box-sizing: border-box;
        }
        input:focus, select:focus {
          outline: none;
          border-color: #2563eb;
        }
        .submit-btn {
          width: 100%;
          padding: 0.625rem;
          background-color: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
        }
        .submit-btn:hover {
          background-color: #1d4ed8;
        }
        .submit-btn:disabled {
          background-color: #93c5fd;
        }
        .alert {
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }
        .alert-error {
          background-color: #fee2e2;
          border: 1px solid #fca5a5;
          color: #b91c1c;
        }
        .alert-success {
          background-color: #d1fae5;
          border: 1px solid #6ee7b7;
          color: #065f46;
        }
      `,3,null),e("header",null,null,[e("div",null,{style:"display: flex; align-items: center; gap: 2rem;"},[e("h1",null,null,"RBAC Dashboard",3,null),e("nav",null,null,[e("a",null,{href:"/"},"Dashboard",3,null),e("a",null,{href:"/admin",class:"active"},"User Management",3,null)],3,null)],3,null),e("div",null,{style:"display: flex; align-items: center; gap: 1rem;"},[e("span",null,{style:"font-size: 0.875rem; color: #4b5563;"},["Logged in as: ",e("strong",null,null,t(l=>{var b;return(b=l.value.user)==null?void 0:b.username},[n]),3,null)," (",t(l=>{var b;return(b=l.value.user)==null?void 0:b.role},[n]),")"],3,null),e("button",null,{class:"logout-btn",onClick$:v},"Logout",3,null)],3,null)],3,null),e("main",null,{class:"container"},[e("div",null,{class:"section-card"},[e("h2",null,null,"User Directory",3,null),e("table",null,null,[e("thead",null,null,e("tr",null,null,[e("th",null,null,"ID",3,null),e("th",null,null,"Username",3,null),e("th",null,null,"Role",3,null)],3,null),3,null),e("tbody",null,null,o.value.map(l=>e("tr",null,null,[e("td",null,null,g(l,"id"),1,null),e("td",null,null,g(l,"username"),1,null),e("td",null,null,e("span",{class:`badge badge-${l.role}`},null,g(l,"role"),1,null),1,null)],1,l.id)),1,null)],1,null)],1,null),e("div",null,{class:"section-card"},[e("h2",null,null,"Add New User",3,null),u.value&&e("div",null,{class:"alert alert-error"},t(l=>l.value,[u]),3,"Vm_1"),i.value&&e("div",null,{class:"alert alert-success"},t(l=>l.value,[i]),3,"Vm_2"),e("form",null,{onSubmit$:m},[e("div",null,{class:"form-group"},[e("label",null,{for:"username"},"Username",3,null),e("input",null,{type:"text",id:"username",value:t(l=>l.username,[a]),required:!0,placeholder:"Enter username",onInput$:d(()=>c(()=>Promise.resolve().then(()=>E),void 0),"s_y3yeCC0L9LQ",[a])},null,3,null)],3,null),e("div",null,{class:"form-group"},[e("label",null,{for:"password"},"Password",3,null),e("input",null,{type:"password",id:"password",value:t(l=>l.password,[a]),required:!0,placeholder:"Enter password",onInput$:d(()=>c(()=>Promise.resolve().then(()=>k),void 0),"s_Da3EaCU2z7Q",[a])},null,3,null)],3,null),e("div",null,{class:"form-group"},[e("label",null,{for:"role"},"Role",3,null),e("select",null,{id:"role",value:t(l=>l.role,[a]),onChange$:d(()=>c(()=>Promise.resolve().then(()=>C),void 0),"s_7g3f99JA5Cw",[a])},[e("option",null,{value:"viewer"},"Viewer",3,null),e("option",null,{value:"editor"},"Editor",3,null),e("option",null,{value:"admin"},"Admin",3,null)],3,null)],3,null),e("button",null,{type:"submit",class:"submit-btn",disabled:t(l=>l.value,[s])},t(l=>l.value?"Creating...":"Create User",[s]),3,null)],3,null)],1,null)],1,null)],1,"Vm_3")},V=Object.freeze(Object.defineProperty({__proto__:null,s_zqOiQexCVbI:L},Symbol.toStringTag,{value:"Module"}));export{f as _hW,V as i,O as s_7g3f99JA5Cw,P as s_AbEj8SdArMk,S as s_Da3EaCU2z7Q,z as s_S5rIuE20Yr0,A as s_y3yeCC0L9LQ,L as s_zqOiQexCVbI};
