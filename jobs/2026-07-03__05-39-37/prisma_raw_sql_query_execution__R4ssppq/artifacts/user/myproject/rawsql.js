const { PrismaClient, Prisma } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  // Count users using a raw SQL query (tagged template literal)
  const countResult = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;
  console.log("Count result:", countResult);

  // Update all users' names to uppercase using a raw SQL execution
  await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;
  console.log("Updated all user names to uppercase.");

  // Query all users after the update using the Prisma Client API
  const users = await prisma.user.findMany();
  console.log("Users after update:", users);

  // Write results to rawsql_result.json
  // $queryRaw returns BigInt for integer-like columns, which JSON cannot
  // serialize by default, so use a replacer to convert BigInt values.
  const output = {
    countResult,
    users,
  };

  const outputPath = path.join(__dirname, "rawsql_result.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(output, (_, value) =>
      typeof value === "bigint" ? Number(value) : value
    , 2)
  );
  console.log(`Results written to ${outputPath}`);
}

main()
  .catch((error) => {
    console.error("Error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma known request error code:", error.code);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });