import { generateOpenAPIDocument } from '@trpc/openapi';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const routerPath = path.resolve(__dirname, 'src/server/router.ts');
  console.log(`Generating OpenAPI document from ${routerPath}...`);
  
  const openApiDocument = await generateOpenAPIDocument(routerPath, {
    title: 'My API',
    version: '1.0.0',
    exportName: 'AppRouter',
  });

  const outputPath = path.resolve(__dirname, 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2));
  console.log(`OpenAPI document generated at ${outputPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
