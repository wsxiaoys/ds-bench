import express from 'express';
import { PrismaClient } from './generated/prisma/client/client.ts';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'dev.db');

const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });
const app = express();
app.use(express.json());

const PORT = 3000;

// Middleware to get tenant scoped prisma client
const getTenantPrisma = (tenantId) => {
  return prisma.$extends({
    query: {
      item: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        async findUnique({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        }
      }
    }
  });
};

app.get('/items', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }

  const tenantPrisma = getTenantPrisma(tenantId);
  try {
    const items = await tenantPrisma.item.findMany();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/items', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }

  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const tenantPrisma = getTenantPrisma(tenantId);
  try {
    const item = await tenantPrisma.item.create({
      data: { name }
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
