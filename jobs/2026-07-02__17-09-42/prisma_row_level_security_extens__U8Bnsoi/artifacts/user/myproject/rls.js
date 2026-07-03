const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

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
        }
      }
    }
  });
}

(async () => {
  const acmeClient = createTenantClient('acme');
  const globexClient = createTenantClient('globex');

  await acmeClient.note.create({ data: { content: 'Acme note 1' } });
  await acmeClient.note.create({ data: { content: 'Acme note 2' } });
  await globexClient.note.create({ data: { content: 'Globex note 1' } });

  const acmeNotes = await acmeClient.note.findMany();
  const globexNotes = await globexClient.note.findMany();

  const result = {
    acmeCount: acmeNotes.length,
    globexCount: globexNotes.length
  };

  fs.writeFileSync(
    '/home/user/myproject/rls_result.json',
    JSON.stringify(result)
  );

  await acmeClient.$disconnect();
  await globexClient.$disconnect();
})();
