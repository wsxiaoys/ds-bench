import { generateOpenAPIDocument } from '@trpc/openapi';
import fs from 'fs';
import path from 'path';

async function generateOpenAPI() {
  const openApiDocument = await generateOpenAPIDocument('./src/server/router.ts', {
    exportName: 'appRouter',
    title: 'My API',
    version: '1.0.0',
  });

  const outputPath = path.join(process.cwd(), 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2), 'utf-8');

  console.log('OpenAPI specification generated at openapi.json');
}

generateOpenAPI().catch(console.error);