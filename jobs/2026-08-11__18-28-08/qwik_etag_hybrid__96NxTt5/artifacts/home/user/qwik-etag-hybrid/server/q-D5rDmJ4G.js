import a from"better-sqlite3";import{join as i}from"path";import{existsSync as E,mkdirSync as T}from"fs";const d="__CATALOG_SERVER_SECRET__",r="/home/user/qwik-etag-hybrid/data",m=i(r,"catalog.db");let t=null;function o(){if(t)return t;globalThis.__catalog_sentinel=d,E(r)||T(r,{recursive:!0});const e=new a(m);if(e.pragma("journal_mode = WAL"),e.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      priceCents INTEGER NOT NULL,
      stock INTEGER NOT NULL
    )
  `),e.prepare("SELECT COUNT(*) as count FROM products").get().count===0){const n=e.prepare("INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)");e.transaction(()=>{n.run("Premium Wireless Headphones",9999,50),n.run("Ergonomic Office Chair",14950,15),n.run("Mechanical Gaming Keyboard",7999,30)})()}return t=e,t}function l(){return o().prepare("SELECT id, name, priceCents, stock FROM products ORDER BY id ASC").all()}function C(e){const s=o().prepare("INSERT INTO products (name, priceCents, stock) VALUES (?, ?, ?)").run(e.name,e.priceCents,e.stock);return{id:Number(s.lastInsertRowid),name:e.name,priceCents:e.priceCents,stock:e.stock}}export{d as SENTINEL,C as addProduct,l as getAllProducts,o as getDb};
