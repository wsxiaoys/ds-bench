const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

/**
 * Creates a tenant-scoped Prisma client using `$extends`.
 * All queries against the `Note` model are REDACTEDmatically
 * filtered by the provided `tenantId`, implementing row-level
 * security (RLS) at the application layer.
 *
 * @param {string} tenantId - The tenant identifier to scope queries by.
 * @returns {import("@prisma/client").PrismaClient} A tenant-scoped client.
 */
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
  // Build tenant-scoped clients for "acme" and "globex".
  const acmeClient = createTenantClient("acme");
  const globexClient = createTenantClient("globex");

  // Use a shared base client to reset the table so the script is idempotent.
  const baseClient = new PrismaClient();
  await baseClient.note.deleteMany({});
  await baseClient.$disconnect();

  // Insert 2 notes for tenant "acme".
  await acmeClient.note.create({ data: { content: "acme note 1" } });
  await acmeClient.note.create({ data: { content: "acme note 2" } });

  // Insert 1 note for tenant "globex".
  await globexClient.note.create({ data: { content: "globex note 1" } });

  // Query notes using each tenant client — each must only see its own notes.
  const acmeNotes = await acmeClient.note.findMany();
  const globexNotes = await globexClient.note.findMany();

  const acmeCount = acmeNotes.length;
  const globexCount = globexNotes.length;

  console.log("acme notes:", acmeCount);
  console.log("globex notes:", globexCount);

  // Write the result to rls_result.json.
  const result = { acmeCount, globexCount };
  fs.writeFileSync(
    path.join(__dirname, "rls_result.json"),
    JSON.stringify(result, null, 2) + "\n"
  );
  console.log("Wrote rls_result.json:", result);

  await acmeClient.$disconnect();
  await globexClient.$disconnect();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });