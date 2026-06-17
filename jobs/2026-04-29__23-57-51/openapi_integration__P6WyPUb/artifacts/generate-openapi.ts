import { generateOpenAPIDocument } from '@trpc/openapi';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

async function main() {
  const routerFilePath = resolve(__dirname, './src/server/router.ts');

  const document = await generateOpenAPIDocument(routerFilePath, {
    exportName: 'appRouter',
    title: 'My API',
    version: '1.0.0',
  });

  const outputPath = resolve(__dirname, './openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI document written to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
