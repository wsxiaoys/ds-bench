const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

const createTenantClient = (tenantId) => {
  return prisma.$extends({
    query: {
      item: {
        async findMany({ args, query }) {
          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...(args.data || {}), tenantId };
          return query(args);
        },
      },
    },
  });
};

const getTenantId = (req, res) => {
  const tenantId = req.header("x-tenant-id");
  if (!tenantId) {
    res.status(400).json({ error: "Missing x-tenant-id header" });
    return null;
  }
  return tenantId;
};

app.get("/items", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) {
    return;
  }

  const tenantPrisma = createTenantClient(tenantId);

  try {
    const items = await tenantPrisma.item.findMany();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

app.post("/items", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) {
    return;
  }

  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Missing name in request body" });
    return;
  }

  const tenantPrisma = createTenantClient(tenantId);

  try {
    const item = await tenantPrisma.item.create({
      data: { name },
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to create item" });
  }
});

app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
