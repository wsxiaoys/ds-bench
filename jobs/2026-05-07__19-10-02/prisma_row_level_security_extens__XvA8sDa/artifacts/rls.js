const { PrismaClient } = require("@prisma/client");

function createTenantClient(tenantId) {
  return new PrismaClient().$extends({
    query: {
      note: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
    },
  });
}

async function main() {
  const acmeClient = createTenantClient("acme");
  const globexClient = createTenantClient("globex");

  await acmeClient.note.create({
    data: { content: "Acme note 1" },
  });
  await acmeClient.note.create({
    data: { content: "Acme note 2" },
  });
  await globexClient.note.create({
    data: { content: "Globex note 1" },
  });

  const acmeNotes = await acmeClient.note.findMany();
  const globexNotes = await globexClient.note.findMany();

  const result = {
    acmeCount: acmeNotes.length,
    globexCount: globexNotes.length,
  };

  const fs = require("fs");
  fs.writeFileSync(
    "/home/user/myproject/rls_result.json",
    `${JSON.stringify(result, null, 2)}\n`
  );

  await acmeClient.$disconnect();
  await globexClient.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
