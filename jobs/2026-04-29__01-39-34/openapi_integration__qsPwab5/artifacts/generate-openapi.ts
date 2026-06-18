import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateOpenAPIDocument } from '@trpc/openapi';

const outputPath = resolve(process.cwd(), 'openapi.json');

const main = async () => {
  const doc = await generateOpenAPIDocument('./src/server/router.ts', {
    exportName: 'AppRouter',
    title: 'My API',
    version: '1.0.0',
  });

  await writeFile(outputPath, JSON.stringify(doc, null, 2), 'utf8');

  console.log(`OpenAPI document written to: ${outputPath}`);
};

main().catch((error) => {
  console.error('Failed to generate OpenAPI document:', error);
  process.exitCode = 1;
});
