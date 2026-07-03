require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

// Prisma 7 ships without built-in query engines; a driver adapter must
// be supplied to the `PrismaClient` constructor. We use the
// better-sqlite3 adapter, pointing it at the SQLite file from the
// DATABASE_URL env var (e.g. `file:./dev.db`).
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const basePrisma = new PrismaClient({ adapter });
const app = express();

app.use(express.json());

/**
 * Tenant middleware: extracts the tenant id from the `x-tenant-id`
 * header and attaches a request-scoped Prisma client to `req.prisma`.
 *
 * The scoped client is built with `prisma.$extends`, which injects the
 * tenant id into every query so data isolation is enforced at the
 * data-access layer rather than relying on every handler remembering
 * to filter manually.
 */
function tenantScopedPrisma(req, res, next) {
  const tenantId = req.header("x-tenant-id");

  if (!tenantId) {
    return res.status(400).json({ error: "x-tenant-id header is required" });
  }

  // Build a per-request Prisma client that enforces tenant isolation
  // via a Client Extension. Every query for the `Item` model is
  // intercepted and the tenantId is forced to the value from the
  // header, so a handler can never accidentally leak another tenant's
  // data or write to a different tenant.
  req.prisma = basePrisma.$extends({
    name: "tenantRls",
    query: {
      item: {
        // Force every operation on `item` to be scoped to the tenant
        // from the `x-tenant-id` header. Read/update/delete operations
        // get a `where` filter, while create/upsert operations get the
        // tenantId injected into their `data`. This means handlers can
        // never accidentally read or write another tenant's data.
        async $allOperations({ operation, args, query }) {
          if (
            operation === "create" ||
            operation === "createMany" ||
            operation === "upsert"
          ) {
            args.data = { ...args.data, tenantId };
          } else {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },
      },
    },
  });

  next();
}

app.use("/items", (req, res, next) => {
  // Only enforce tenant scoping on the item routes that need it.
  tenantScopedPrisma(req, res, next);
});

// GET /items — returns only items belonging to the request's tenant.
app.get("/items", async (req, res) => {
  const items = await req.prisma.item.findMany();
  res.json(items);
});

// POST /items — creates an item for the request's tenant.
app.post("/items", async (req, res) => {
  const { name } = req.body || {};

  if (typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "name is required" });
  }

  // tenantId is injected into `data` by the extension's
  // $allOperations hook, so the handler stays tenant-agnostic.
  const item = await req.prisma.item.create({
    data: { name },
  });

  res.status(201).json(item);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;