import { generateOpenAPIDocument } from '@trpc/openapi';
import * as fs from 'fs';

async function main() {
  const openApiDocument = await generateOpenAPIDocument('./src/server/router.ts', {
    title: 'My API',
    version: '1.0.0',
  });

  fs.writeFileSync('openapi.json', JSON.stringify(openApiDocument, null, 2));
  console.log('OpenAPI document generated at openapi.json');
}

main().catch(console.error);
