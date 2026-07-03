// Multi-tenant REST API with Row-Level Security (RLS) enforced via Prisma Client Extensions.
// Each request gets a tenant-scoped Prisma client built with `prisma.$extends`
// so that `tenantId` is always applied REDACTEDmatically based on the `x-tenant-id` header.

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

// Base (un-scoped) Prisma client. This is what gets extended per-request.
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
});
const prisma = new PrismaClient({ adapter });

/**
 * Build a Prisma client scoped to a specific tenant.
 *
 * Every read query REDACTEDmatically filters by `tenantId`, every write injects
 * `tenantId` into the data and the where clause, so callers can never reach
 * another tenant's rows even if they pass a raw `where` or `data`.
 */
function getTenantClient(tenantId) {
  return prisma.$extends({
    name: `tenant-${tenantId}`,
    query: {
      item: {
        // ---- Reads: force `tenantId` into the `where` clause ----
        async findMany({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async findFirstOrThrow({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async findUnique({ args, query }) {
          // findUnique requires a unique selector; merge with tenantId.
          // Fall back to findFirst if the user didn't supply a tenantId already.
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async findUniqueOrThrow({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async aggregate({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async groupBy({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },

        // ---- Writes: inject `tenantId` into `data` and `where` ----
        async create({ args, query }) {
          args.data = { ...(args.data || {}), tenantId };
          return query(args);
        },
        async createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d) => ({ ...d, tenantId }));
          } else {
            args.data = { ...(args.data || {}), tenantId };
          }
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async updateMany({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async upsert({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          args.create = { ...(args.create || {}), tenantId };
          args.update = { ...(args.update || {}), tenantId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async deleteMany({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
      },
    },
  });
}

const app = express();
app.use(express.json());

// Lightweight request log so it's easy to see what's happening.
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Health check.
app.get('/', (_req, res) => {
  res.json({ ok: true });
});

// GET /items — list items for the tenant.
app.get('/items', async (req, res) => {
  const tenantId = req.header('x-tenant-id');
  if (!tenantId) {
    return res
      .status(400)
      .json({ error: 'Missing x-tenant-id header' });
  }

  try {
    const tenantPrisma = getTenantClient(tenantId);
    const items = await tenantPrisma.item.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(items);
  } catch (err) {
    console.error('GET /items failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /items — create an item for the tenant.
app.post('/items', async (req, res) => {
  const tenantId = req.header('x-tenant-id');
  if (!tenantId) {
    return res
      .status(400)
      .json({ error: 'Missing x-tenant-id header' });
  }

  const { name } = req.body || {};
  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Body must include { name: string }' });
  }

  try {
    const tenantPrisma = getTenantClient(tenantId);
    const item = await tenantPrisma.item.create({
      data: { name },
    });
    res.status(201).json(item);
  } catch (err) {
    console.error('POST /items failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Multi-tenant API listening on http://localhost:${PORT}`);
});