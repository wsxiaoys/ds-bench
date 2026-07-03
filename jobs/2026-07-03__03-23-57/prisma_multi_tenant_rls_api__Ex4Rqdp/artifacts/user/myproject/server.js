const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

// Instantiate the driver adapter for SQLite
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db'
});

// Pass the adapter to PrismaClient
const prisma = new PrismaClient({ adapter });
const app = express();

app.use(express.json());

// Middleware to enforce x-tenant-id header and create a scoped Prisma Client
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }

  // Create a scoped client per request using prisma.$extends
  req.prisma = prisma.$extends({
    query: {
      item: {
        async findMany({ args, query }) {
          args.where = args.where || {};
          args.where.tenantId = tenantId;
          return query(args);
        },
        async create({ args, query }) {
          args.data = args.data || {};
          args.data.tenantId = tenantId;
          return query(args);
        }
      }
    }
  });

  next();
});

// GET /items — returns only items belonging to the tenant in the x-tenant-id header
app.get('/items', async (req, res) => {
  try {
    const items = await req.prisma.item.findMany();
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /items — creates an item for the tenant in the x-tenant-id header (body: { name })
app.post('/items', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required and must be a string' });
    }

    const item = await req.prisma.item.create({
      data: {
        name
      }
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
