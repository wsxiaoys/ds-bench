const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const app = express();
const PORT = 3000;

// Create base Prisma client with SQLite adapter
const datasourceUrl = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaBetterSqlite3({ url: datasourceUrl });
const prisma = new PrismaClient({ adapter });

// Middleware to parse JSON
app.use(express.json());

// Create a tenant-scoped Prisma client
function createScopedClient(tenantId) {
  return prisma.$extends({
    query: {
      item: {
        // Automatically filter all Item queries by tenantId
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
        async create({ args, query }) {
          // Automatically set tenantId on create
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          // Ensure tenantId cannot be changed and filter by tenantId
          args.where = { ...args.where, tenantId };
          delete args.data.tenantId;
          return query(args);
        },
        async delete({ args, query }) {
          // Ensure delete operations respect tenant isolation
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
    },
  });
}

// GET /items - Returns only items belonging to the tenant in the x-tenant-id header
app.get('/items', async (req, res) => {
  const tenantId = req.header('x-tenant-id');

  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }

  try {
    // Create a scoped client for this request
    const scopedPrisma = createScopedClient(tenantId);

    // Fetch items - tenantId is automatically applied by the extension
    const items = await scopedPrisma.item.findMany();

    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST /items - Creates an item for the tenant in the x-tenant-id header
app.post('/items', async (req, res) => {
  const tenantId = req.header('x-tenant-id');
  const { name } = req.body;

  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }

  if (!name) {
    return res.status(400).json({ error: 'name is required in request body' });
  }

  try {
    // Create a scoped client for this request
    const scopedPrisma = createScopedClient(tenantId);

    // Create item - tenantId is automatically set by the extension
    const item = await scopedPrisma.item.create({
      data: { name },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Multi-tenant RLS API is running' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});