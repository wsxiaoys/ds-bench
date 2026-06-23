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

async function main() {
  const acmeClient = createTenantClient('acme');
  const globexClient = createTenantClient('globex');

  // Clean up existing notes to ensure fresh run
  const baseClient = new PrismaClient();
  await baseClient.note.deleteMany({});

  // Insert notes for acme
  await acmeClient.note.create({ data: { content: 'Acme Note 1' } });
  await acmeClient.note.create({ data: { content: 'Acme Note 2' } });

  // Insert notes for globex
  await globexClient.note.create({ data: { content: 'Globex Note 1' } });

  // Query notes for acme
  const acmeNotes = await acmeClient.note.findMany();
  const acmeCount = acmeNotes.length;

  // Query notes for globex
  const globexNotes = await globexClient.note.findMany();
  const globexCount = globexNotes.length;

  const result = { acmeCount, globexCount };
  fs.writeFileSync('rls_result.json', JSON.stringify(result, null, 2));
  
  console.log('Results:', result);

  await acmeClient.$disconnect();
  await globexClient.$disconnect();
  await baseClient.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
