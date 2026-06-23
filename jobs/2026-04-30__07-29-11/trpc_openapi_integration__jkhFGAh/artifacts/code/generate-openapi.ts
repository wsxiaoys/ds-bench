import fs from 'node:fs';
import path from 'node:path';
import { generateOpenAPIDocument } from '@trpc/openapi';

async function main() {
  const routerFilePath = path.resolve(process.cwd(), 'src/server/router.ts');

  const document = await generateOpenAPIDocument(routerFilePath, {
    exportName: 'AppRouter',
    title: 'My API',
    version: '1.0.0',
  });

  const outputPath = path.resolve(process.cwd(), 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2) + '\n', 'utf8');

  console.log(`OpenAPI document written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
