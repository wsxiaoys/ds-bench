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
        }
      }
    }
  });
}

async function main() {
  const acmeClient = createTenantClient('acme');
  const globexClient = createTenantClient('globex');

  // Clear existing notes to ensure exact counts
  const baseClient = new PrismaClient();
  await baseClient.note.deleteMany({});

  // Insert 2 notes for acme
  await acmeClient.note.create({
    data: {
      content: 'Acme Note 1'
    }
  });
  await acmeClient.note.create({
    data: {
      content: 'Acme Note 2'
    }
  });

  // Insert 1 note for globex
  await globexClient.note.create({
    data: {
      content: 'Globex Note 1'
    }
  });

  // Query notes using each client
  const acmeNotes = await acmeClient.note.findMany();
  const globexNotes = await globexClient.note.findMany();

  const acmeCount = acmeNotes.length;
  const globexCount = globexNotes.length;

  console.log(`Acme notes count: ${acmeCount}`);
  console.log(`Globex notes count: ${globexCount}`);

  const result = {
    acmeCount,
    globexCount
  };

  fs.writeFileSync(
    path.join(__dirname, 'rls_result.json'),
    JSON.stringify(result, null, 2)
  );

  // Disconnect clients
  await acmeClient.$disconnect();
  await globexClient.$disconnect();
  await baseClient.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
