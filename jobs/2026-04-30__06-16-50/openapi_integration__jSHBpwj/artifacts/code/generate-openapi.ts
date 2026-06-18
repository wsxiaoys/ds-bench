import { generateOpenAPIDocument } from "@trpc/openapi";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const routerFilePath = path.resolve(__dirname, "./src/server/router.ts");
  const outputPath = path.resolve(__dirname, "openapi.json");

  const doc = await generateOpenAPIDocument(routerFilePath, {
    title: "My API",
    version: "1.0.0",
  });

  fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2));
  console.log(`OpenAPI document written to ${outputPath}`);
}

main().catch((err) => {
  console.error("Failed to generate OpenAPI document:", err);
  process.exit(1);
});