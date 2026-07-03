#!/usr/bin/env bash
# Idempotent setup: ensures the source bucket exists with snapshots enabled
# and uploads seed1.txt / seed2.txt. Run REDACTEDmatically at task start.
set -euo pipefail

cd "$(dirname "$0")"

RUN_ID="$(cat /logs/artifacts/run-id)"
# Normalize: lowercase, replace any non [a-z0-9.-] character with a hyphen.
NORMALIZED="$(printf '%s' "$RUN_ID" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9.\-]+/-/g')"
BUCKET="harbor-isolation-${NORMALIZED}"
echo "source bucket: ${BUCKET}"

export TIGRIS_STORAGE_ACCESS_KEY_ID
export TIGRIS_STORAGE_SECRET_ACCESS_KEY

TMP_SCRIPT="$(mktemp /home/user/isolation/.setup-tmp.XXXXXX.mjs)"
trap 'rm -f "$TMP_SCRIPT"' EXIT

cat > "$TMP_SCRIPT" <<'NODE_EOF'
import { createBucket, getBucketInfo, put } from '@tigrisdata/storage';
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';

const bucket = process.env.BUCKET;
console.log('setup: bucket =', JSON.stringify(bucket));

const admin = new S3Client({
  endpoint: 'REDACTED',
  region: 'REDACTED',
  credentials: {
    accessKeyId: process.env.TIGRIS_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

// Idempotency: check if the bucket already exists.
let bucketExists = false;
try {
  const info = await getBucketInfo(bucket);
  bucketExists = !info.error;
  if (bucketExists) console.log('setup: bucket already exists');
} catch (e) {
  // Treat as not existing.
}

if (!bucketExists) {
  let created;
  for (let attempt = 0; attempt < 15; attempt++) {
    created = await createBucket(bucket, { enableSnapshot: true });
    if (!created.error) break;
    const msg = created.error.message ?? '';
    if (!/recently deleted|unavailable/i.test(msg)) {
      throw new Error('createBucket: ' + msg);
    }
    console.log('setup: bucket pending deletion, retrying in 5s (attempt ' + (attempt + 1) + ')');
    await new Promise(r => setTimeout(r, 5000));
  }
  if (created.error) throw new Error('createBucket: ' + created.error.message);
  console.log('setup: createBucket ok');
}

// Ensure seed1.txt and seed2.txt exist.
await admin.send(new PutObjectCommand({ Bucket: bucket, Key: 'seed1.txt', Body: 'seed-1' }));
await admin.send(new PutObjectCommand({ Bucket: bucket, Key: 'seed2.txt', Body: 'seed-2' }));

console.log('setup complete for ' + bucket);
NODE_EOF

BUCKET="$BUCKET" node "$TMP_SCRIPT"
