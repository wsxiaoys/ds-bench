const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

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

async function main() {
  // First, ensure the database is set up and clear any existing data
  const base = new PrismaClient();
  await base.note.deleteMany({});
  await base.$disconnect();

  // Create tenant 'acme' client and insert 2 notes
  const acme = createTenantClient('acme');
  await acme.note.create({ data: { content: 'Acme note 1' } });
  await acme.note.create({ data: { content: 'Acme note 2' } });

  // Create tenant 'globex' client and insert 1 note
  const globex = createTenantClient('globex');
  await globex.note.create({ data: { content: 'Globex note 1' } });

  // Query notes using each tenant client
  const acmeNotes = await acme.note.findMany();
  const globexNotes = await globex.note.findMany();

  console.log('Acme notes:', acmeNotes);
  console.log('Globex notes:', globexNotes);

  const result = {
    acmeCount: acmeNotes.length,
    globexCount: globexNotes.length
  };

  fs.writeFileSync(
    path.join(__dirname, 'rls_result.json'),
    JSON.stringify(result)
  );

  console.log('Result:', result);

  await acme.$disconnect();
  await globex.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
