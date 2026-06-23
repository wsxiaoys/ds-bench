const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const basePrisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());

// Middleware to enforce tenant isolation
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }

  req.prisma = basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          args = args || {};
          if (operation === 'create') {
            args.data = { ...args.data, tenantId };
          } else if (operation === 'createMany') {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(d => ({ ...d, tenantId }));
            } else {
              args.data = { ...args.data, tenantId };
            }
          } else if (operation === 'upsert') {
            args.where = { ...args.where, tenantId };
            args.create = { ...args.create, tenantId };
          } else if (
            [
              'findUnique',
              'findUniqueOrThrow',
              'findFirst',
              'findFirstOrThrow',
              'findMany',
              'update',
              'updateMany',
              'delete',
              'deleteMany',
              'count',
              'aggregate',
              'groupBy'
            ].includes(operation)
          ) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        }
      }
    }
  });

  next();
});

app.get('/items', async (req, res) => {
  try {
    const items = await req.prisma.item.findMany();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/items', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const item = await req.prisma.item.create({
      data: { name }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
