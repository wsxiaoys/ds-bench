import{_ as d}from"./q-DoNi8vyY.js";import{i as b,m as y,l as k,q as u,z as e,D as p,g as m,d as _,c as f}from"./q-Dm-n0CeS.js";import{useDashboardLoader as w}from"./q-DjVncuJf.js";import{u as P}from"./q-CeHRC3tv.js";const N=()=>{const n=w(),l=P(),o=n.value.user,r=o.role==="editor"||o.role==="admin",a=b(n.value.contents||[]),i=y({title:"",body:""}),s=b(""),c=b(""),g=b(!1);k(u(()=>d(()=>import("./q-Dmbh5SzW.js"),[]),"s_j2yjBVQWBQs",[a,n]));const v=u(()=>d(()=>Promise.resolve().then(()=>M),void 0),"s_NZR3EBk4Mow",[a,s,i,g,c]),h=u(()=>d(()=>Promise.resolve().then(()=>A),void 0),"s_0QphwwIQJ4c",[a]),x=u(()=>d(()=>Promise.resolve().then(()=>B),void 0),"s_ZDB0vxaas6M",[l]);return e("div",null,{class:"dashboard"},[e("style",null,null,`
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
        .content-item {
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          margin-bottom: 1.5rem;
          position: relative;
          background-color: #f9fafb;
        }
        .content-item h3 {
          margin-top: 0;
          margin-bottom: 0.5rem;
          color: #111827;
          font-size: 1.125rem;
        }
        .content-item p {
          margin: 0;
          color: #4b5563;
          line-height: 1.5;
        }
        .delete-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background-color: #fee2e2;
          color: #b91c1c;
          border: none;
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
        }
        .delete-btn:hover {
          background-color: #fca5a5;
        }
        
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
        input, textarea {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.875rem;
          box-sizing: border-box;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #2563eb;
        }
        textarea {
          resize: vertical;
          min-height: 100px;
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
        .no-content {
          text-align: center;
          color: #6b7280;
          padding: 3rem 1rem;
        }
      `,3,null),e("header",null,null,[e("div",null,{style:"display: flex; align-items: center; gap: 2rem;"},[e("h1",null,null,"RBAC Dashboard",3,null),e("nav",null,null,[e("a",null,{href:"/",class:"active"},"Dashboard",3,null),o.role==="admin"&&e("a",null,{href:"/admin"},"User Management",3,"50_0")],1,null)],1,null),e("div",null,{style:"display: flex; align-items: center; gap: 1rem;"},[e("span",null,{style:"font-size: 0.875rem; color: #4b5563;"},["Logged in as: ",e("strong",null,null,p(o,"username"),1,null)," (",p(o,"role"),")"],1,null),e("button",null,{class:"logout-btn",onClick$:x},"Logout",3,null)],1,null)],1,null),e("main",{style:r?"":"grid-template-columns: 1fr;"},{class:"container"},[e("div",null,{class:"section-card"},[e("h2",null,null,"Dashboard Content",3,null),a.value.length===0?e("div",null,{class:"no-content"},"No content items available.",3,"50_1"):e("div",null,null,a.value.map(t=>e("div",null,{class:"content-item"},[e("h3",null,null,p(t,"title"),1,null),e("p",null,null,p(t,"body"),1,null),r&&e("button",{onClick$:u(()=>d(()=>Promise.resolve().then(()=>E),void 0),"s_Q48h0k08kR8",[t,h])},{class:"delete-btn"},"Delete",2,"50_2")],1,t.id)),1,null)],1,null),r&&e("div",null,{class:"section-card"},[e("h2",null,null,"Publish New Content",3,null),s.value&&e("div",null,{class:"alert alert-error"},m(t=>t.value,[s]),3,"50_3"),c.value&&e("div",null,{class:"alert alert-success"},m(t=>t.value,[c]),3,"50_4"),e("form",null,{onSubmit$:v},[e("div",null,{class:"form-group"},[e("label",null,{for:"title"},"Title",3,null),e("input",null,{type:"text",id:"title",value:m(t=>t.title,[i]),required:!0,placeholder:"Enter title",onInput$:u(()=>d(()=>Promise.resolve().then(()=>D),void 0),"s_XG07nsV6Uag",[i])},null,3,null)],3,null),e("div",null,{class:"form-group"},[e("label",null,{for:"body"},"Body",3,null),e("textarea",null,{id:"body",value:m(t=>t.body,[i]),required:!0,placeholder:"Enter body text",onInput$:u(()=>d(()=>Promise.resolve().then(()=>j),void 0),"s_W5ksBrPPRY0",[i])},null,3,null)],3,null),e("button",null,{type:"submit",class:"submit-btn",disabled:m(t=>t.value,[g])},m(t=>t.value?"Publishing...":"Publish Content",[g]),3,null)],3,null)],1,"50_5")],1,null)],1,"50_6")},S=()=>{const[n,l]=_();return l(n.id)},E=Object.freeze(Object.defineProperty({__proto__:null,s_Q48h0k08kR8:S},Symbol.toStringTag,{value:"Module"})),O=(n,l)=>{const[o]=_();return o.title=l.value},D=Object.freeze(Object.defineProperty({__proto__:null,s_XG07nsV6Uag:O},Symbol.toStringTag,{value:"Module"})),R=(n,l)=>{const[o]=_();return o.body=l.value},j=Object.freeze(Object.defineProperty({__proto__:null,s_W5ksBrPPRY0:R},Symbol.toStringTag,{value:"Module"})),T=async n=>{const[l,o,r,a,i]=_();n.preventDefault(),o.value="",i.value="",a.value=!0;try{const s=await fetch("/api/content",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:r.title,body:r.body})}),c=await s.json();s.ok?(i.value="Content published successfully!",l.value=[...l.value,c],r.title="",r.body=""):o.value=c.error||"Failed to add content"}catch{o.value="An unexpected error occurred"}finally{a.value=!1}},M=Object.freeze(Object.defineProperty({__proto__:null,_hW:f,s_NZR3EBk4Mow:T},Symbol.toStringTag,{value:"Module"})),z=async n=>{const[l]=_();if(confirm("Are you sure you want to delete this content?"))try{const o=await fetch(`/api/content/${n}`,{method:"DELETE"});if(o.ok)l.value=l.value.filter(r=>r.id!==n);else{const r=await o.json();alert(r.error||"Failed to delete content")}}catch{alert("An unexpected error occurred")}},A=Object.freeze(Object.defineProperty({__proto__:null,_hW:f,s_0QphwwIQJ4c:z},Symbol.toStringTag,{value:"Module"})),I=async()=>{const[n]=_();await fetch("/api/logout",{method:"POST"}),n("/login")},B=Object.freeze(Object.defineProperty({__proto__:null,_hW:f,s_ZDB0vxaas6M:I},Symbol.toStringTag,{value:"Module"}));export{f as _hW,z as s_0QphwwIQJ4c,T as s_NZR3EBk4Mow,S as s_Q48h0k08kR8,R as s_W5ksBrPPRY0,N as s_WGm41GRlPRA,O as s_XG07nsV6Uag,I as s_ZDB0vxaas6M};
