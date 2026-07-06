import { put } from '@tigrisdata/storage';

const runId = 'zrg4u3bn42';
const bucketName = `harbor-interop-${runId}`;

const body = JSON.stringify({
  created_by: 'cli',
  modified_by: 'sdk',
  run: runId
});

async function main() {
  console.log(`Uploading manifest.json to bucket: ${bucketName}...`);
  const result = await put('manifest.json', body, {
    contentType: 'application/json',
    config: {
      bucket: bucketName,
    },
  });

  if (result.error) {
    console.error('Upload failed:', result.error);
    process.exit(1);
  } else {
    console.log('Upload succeeded:', result.data);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
