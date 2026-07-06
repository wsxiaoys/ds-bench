import { generateOpenAPIDocument } from '@trpc/openapi';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    const routerPath = path.resolve(__dirname, 'src/server/router.ts');
    const document = await generateOpenAPIDocument(routerPath, {
      title: 'My API',
      version: '1.0.0',
      exportName: 'appRouter',
    });

    const outputPath = path.resolve(__dirname, 'openapi.json');
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');
    console.log('OpenAPI JSON generated successfully at:', outputPath);
  } catch (err) {
    console.error('Failed to generate OpenAPI JSON:', err);
    process.exit(1);
  }
}

main();
