'use strict';

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const app = express();
app.use(express.json());

// Base Prisma client (shared adapter / connection pool)
const baseAdapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const basePrisma = new PrismaClient({ adapter: baseAdapter });

/**
 * Creates a tenant-scoped Prisma client using $extends.
 * Every query issued through the returned client is automatically
 * filtered / augmented with the caller's tenantId, enforcing row-level
 * data isolation at the ORM layer.
 *
 * @param {string} tenantId - The tenant identifier from x-tenant-id header
 * @returns Extended PrismaClient scoped to the given tenantId
 */
function createScopedClient(tenantId) {
  return basePrisma.$extends({
    query: {
      item: {
        // Enforce tenantId on all read operations
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findUnique({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        // Enforce tenantId on write operations
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        async createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((item) => ({ ...item, tenantId }));
          } else {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
    },
  });
}

// Middleware: require x-tenant-id header on every request
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    return res.status(400).json({ error: 'Missing or empty x-tenant-id header' });
  }
  // Attach scoped client to the request object
  req.prisma = createScopedClient(tenantId.trim());
  req.tenantId = tenantId.trim();
  next();
});

// GET /items — return items belonging to the tenant
app.get('/items', async (req, res) => {
  try {
    const items = await req.prisma.item.findMany();
    res.json(items);
  } catch (err) {
    console.error('GET /items error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /items — create an item for the tenant
app.post('/items', async (req, res) => {
  const { name } = req.body ?? {};

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Request body must include a non-empty "name" field' });
  }

  try {
    const item = await req.prisma.item.create({
      data: { name: name.trim() },
    });
    res.status(201).json(item);
  } catch (err) {
    console.error('POST /items error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await basePrisma.$disconnect();
  process.exit(0);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
