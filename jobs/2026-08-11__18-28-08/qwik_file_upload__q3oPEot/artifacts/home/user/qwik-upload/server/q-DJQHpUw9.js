import T from"better-sqlite3";import{mkdirSync as g,writeFileSync as N}from"node:fs";import{join as p}from"node:path";import{createHash as E}from"node:crypto";const l="/home/user/qwik-upload/uploads",h="/home/user/qwik-upload/db.sqlite";g(l,{recursive:!0});const s=new T(h);s.pragma("journal_mode = WAL");s.exec(`
  CREATE TABLE IF NOT EXISTS files (
    originalName TEXT NOT NULL,
    storedName TEXT NOT NULL UNIQUE,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,
    contentType TEXT NOT NULL
  )
`);function L(t){let r=t.replace(/\\/g,"/");const a=r.lastIndexOf("/");for(a!==-1&&(r=r.substring(a+1));r.includes("..");)r=r.replace(/\.\./g,"");return(!r||r===".")&&(r="file"),r=r.replace(/[\/\\]/g,""),r}async function F(t,r){var f;if(!t||!(t instanceof File)||t.size===0)return{success:!1,errorCode:"no_file"};if(t.size>1048576)return{success:!1,errorCode:"file_too_large"};const a=await t.arrayBuffer(),e=Buffer.from(a);if(e.length>1048576)return{success:!1,errorCode:"file_too_large"};let n="";if(e.length>=8&&e[0]===137&&e[1]===80&&e[2]===78&&e[3]===71&&e[4]===13&&e[5]===10&&e[6]===26&&e[7]===10)n="image/png";else if(e.length>=4&&e[0]===37&&e[1]===80&&e[2]===68&&e[3]===70)n="application/pdf";else return{success:!1,errorCode:"unsupported_type"};let i=typeof r=="string"?r:"";!i&&t.name&&(i=t.name);const d=L(i||"file"),o=E("sha256").update(e).digest("hex"),u=`${o}.${n==="image/png"?"png":"pdf"}`;if(s.prepare("SELECT * FROM files WHERE sha256 = ?").get(o))return{success:!0,dedup:!0};const m=p(l,u);N(m,e);try{return s.prepare(`
      INSERT INTO files (originalName, storedName, size, sha256, contentType)
      VALUES (?, ?, ?, ?, ?)
    `).run(d,u,e.length,o,n),{success:!0,dedup:!1}}catch(c){if(c.code==="SQLITE_CONSTRAINT_UNIQUE"||(f=c.message)!=null&&f.includes("UNIQUE constraint failed"))return{success:!0,dedup:!0};throw c}}function R(){return s.prepare("SELECT originalName, storedName, size, sha256, contentType FROM files").all()}function C(t){return s.prepare("SELECT originalName, storedName, size, sha256, contentType FROM files WHERE storedName = ?").get(t)}function w(t){return p(l,t)}export{C as getFileMetadata,w as getFilePath,R as getFiles,F as handleUpload};
