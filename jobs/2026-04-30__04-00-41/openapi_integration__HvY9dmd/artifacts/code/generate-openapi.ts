import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateOpenAPIDocument } from '@trpc/openapi';

async function main() {
  const routerFilePath = resolve(__dirname, 'src/server/router.ts');

  const document = await generateOpenAPIDocument(routerFilePath, {
    exportName: 'appRouter',
    title: 'My API',
    version: '1.0.0',
  });

  const outputPath = resolve(__dirname, 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`OpenAPI document written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
