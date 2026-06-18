const { PrismaClient } = require('@prisma/client');

// Factory function to create a tenant-scoped Prisma client
function createTenantClient(tenantId) {
  return new PrismaClient().$extends({
    query: {
      note: {
        // Automatically filter findMany queries by tenantId
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        // Automatically add tenantId to create operations
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        }
      }
    }
  });
}

async function main() {
  // Create tenant 'acme' client
  const acmeClient = createTenantClient('acme');
  
  // Create tenant 'globex' client
  const globexClient = createTenantClient('globex');
  
  // Clear existing notes for clean test
  await acmeClient.note.deleteMany({});
  await globexClient.note.deleteMany({});
  
  // Insert 2 notes for acme tenant
  await acmeClient.note.create({
    data: { content: 'Acme note 1' }
  });
  await acmeClient.note.create({
    data: { content: 'Acme note 2' }
  });
  
  // Insert 1 note for globex tenant
  await globexClient.note.create({
    data: { content: 'Globex note 1' }
  });
  
  // Query notes using each tenant client
  const acmeNotes = await acmeClient.note.findMany();
  const globexNotes = await globexClient.note.findMany();
  
  console.log('Acme notes:', acmeNotes);
  console.log('Globex notes:', globexNotes);
  
  // Verify each tenant only sees its own notes
  console.log(`Acme count: ${acmeNotes.length} (expected: 2)`);
  console.log(`Globex count: ${globexNotes.length} (expected: 1)`);
  
  // Write result to JSON file
  const result = {
    acmeCount: acmeNotes.length,
    globexCount: globexNotes.length
  };
  
  const fs = require('fs');
  fs.writeFileSync('/home/user/myproject/rls_result.json', JSON.stringify(result, null, 2));
  console.log('Result written to rls_result.json');
  
  // Cleanup
  await acmeClient.$disconnect();
  await globexClient.$disconnect();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });