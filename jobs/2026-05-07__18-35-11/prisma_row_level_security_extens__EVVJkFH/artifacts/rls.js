const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

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
  // Clean up any existing notes so results are deterministic on re-runs
  const base = new PrismaClient();
  await base.note.deleteMany({});
  await base.$disconnect();

  const acmeClient = createTenantClient('acme');
  const globexClient = createTenantClient('globex');

  // Insert 2 notes for acme
  await acmeClient.note.create({ data: { content: 'Acme note 1' } });
  await acmeClient.note.create({ data: { content: 'Acme note 2' } });

  // Insert 1 note for globex
  await globexClient.note.create({ data: { content: 'Globex note 1' } });

  // Each tenant only sees their own notes
  const acmeNotes = await acmeClient.note.findMany();
  const globexNotes = await globexClient.note.findMany();

  const result = {
    acmeCount: acmeNotes.length,
    globexCount: globexNotes.length,
  };

  console.log('Acme notes:', acmeNotes);
  console.log('Globex notes:', globexNotes);
  console.log('Result:', result);

  fs.writeFileSync(
    path.join(__dirname, 'rls_result.json'),
    JSON.stringify(result, null, 2)
  );

  await acmeClient.$disconnect();
  await globexClient.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
