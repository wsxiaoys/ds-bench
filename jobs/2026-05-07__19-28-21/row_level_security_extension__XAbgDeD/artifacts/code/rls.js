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
  // Clear the database first to ensure clean state
  const prisma = new PrismaClient();
  await prisma.note.deleteMany();
  
  const acmeClient = createTenantClient('acme');
  const globexClient = createTenantClient('globex');

  // Insert 2 notes for acme
  await acmeClient.note.create({ data: { content: 'Acme Note 1' } });
  await acmeClient.note.create({ data: { content: 'Acme Note 2' } });

  // Insert 1 note for globex
  await globexClient.note.create({ data: { content: 'Globex Note 1' } });

  // Query notes using each tenant client
  const acmeNotes = await acmeClient.note.findMany({});
  const globexNotes = await globexClient.note.findMany({});

  const result = {
    acmeCount: acmeNotes.length,
    globexCount: globexNotes.length
  };

  fs.writeFileSync('rls_result.json', JSON.stringify(result, null, 2));
  console.log('Results written to rls_result.json');
  
  await prisma.$disconnect();
}

main().catch(console.error);
