import { writeFileSync } from 'node:fs';
import { generateOpenAPIDocument } from '@trpc/openapi';

async function main() {
  const document = await generateOpenAPIDocument('./src/server/router.ts', {
    title: 'My API',
    version: '1.0.0',
    exportName: 'appRouter',
  });

  writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
  console.log('openapi.json generated successfully');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});