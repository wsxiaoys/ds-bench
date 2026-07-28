import m from"better-sqlite3";import{existsSync as N,mkdirSync as g,writeFileSync as h}from"node:fs";import{join as n}from"node:path";import{createHash as L}from"node:crypto";const f="/home/user/qwik-upload",O=n(f,"db.sqlite"),a=n(f,"uploads");let i=null;function u(){return i||(N(a)||g(a,{recursive:!0}),i=new m(O),i.pragma("journal_mode = WAL"),i.exec(`
      CREATE TABLE IF NOT EXISTS files (
        originalName TEXT NOT NULL,
        storedName TEXT NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL UNIQUE,
        contentType TEXT NOT NULL
      )
    `)),i}function y(){return u().prepare("SELECT originalName, storedName, size, sha256, contentType FROM files").all()}function b(t){return u().prepare("SELECT originalName, storedName, size, sha256, contentType FROM files WHERE storedName = ?").get(t)}function z(t){return n(a,t)}function A(t){if(!t)return"file";const s=t.split(/[/\\]/);let e=s[s.length-1]||"file";return(e==="."||e==="..")&&(e="file"),e=e.replace(/\.\./g,""),e=e.replace(/"/g,""),e=e.trim(),e||(e="file"),e}function C(t,s,e){var E;const r=L("sha256").update(t).digest("hex"),T=t.length,o=`${r}.${e==="image/png"?"png":"pdf"}`,d=n(a,o),c=u(),p=c.prepare("SELECT originalName, storedName, size, sha256, contentType FROM files WHERE sha256 = ?").get(r);if(p)return{success:!0,dedup:!0,file:p};N(d)||h(d,t);try{return c.prepare(`
      INSERT INTO files (originalName, storedName, size, sha256, contentType)
      VALUES (?, ?, ?, ?, ?)
    `).run(s,o,T,r,e),{success:!0,dedup:!1,file:{originalName:s,storedName:o,size:T,sha256:r,contentType:e}}}catch(l){if(l.code==="SQLITE_CONSTRAINT_UNIQUE"||(E=l.message)!=null&&E.includes("UNIQUE constraint failed"))return{success:!0,dedup:!0,file:c.prepare("SELECT originalName, storedName, size, sha256, contentType FROM files WHERE sha256 = ?").get(r)};throw l}}export{u as getDb,b as getFileByStoredName,z as getFilePath,y as getFiles,A as sanitizeFilename,C as saveFile};
