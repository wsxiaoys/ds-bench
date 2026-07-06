import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createWorkspace, teardownWorkspace } from '@tigrisdata/agent-kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const STATE_FILE = '/home/user/pool/pool-state.json';
export const TIGRIS_S3_ENDPOINT = 'REDACTED';
export const TIGRIS_S3_REGION = 'REDACTED';

/** Shape of each entry persisted in pool-state.json. */
export interface PoolEntry {
  name: string;
  bucket: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

/** Shape of the persisted pool-state.json file. */
export interface PoolState {
  workspaces: PoolEntry[];
}

async function readState(): Promise<PoolState> {
  if (!existsSync(STATE_FILE)) {
    throw new Error(`pool-state.json not found at ${STATE_FILE}`);
  }
  const raw = await readFile(STATE_FILE, 'utf8');
  const parsed = JSON.parse(raw) as PoolState;
  if (!parsed || !Array.isArray(parsed.workspaces)) {
    throw new Error('pool-state.json is malformed');
  }
  return parsed;
}

/**
 * Provision exactly `count` Tigris workspaces concurrently (single Promise.all
 * over createWorkspace calls). Workspaces are named pool-<count>-<i> for the
 * 1-based index `i`. Each workspace is created with ttl { days: 1 } and
 * credentials { role: 'Editor' }.
 *
 * On success, writes pool-state.json. On any failure, throws and does NOT
 * write the state file.
 */
export async function provisionPool(count: number): Promise<PoolState> {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`provision count must be a non-negative integer, got: ${count}`);
  }

  // Build all createWorkspace promises up front so they run concurrently via
  // a single Promise.all (sequential awaits are NOT acceptable).
  const creationPromises = Array.from({ length: count }, (_, i) => {
    const index = i + 1; // 1-based
    const name = `pool-${count}-${index}`;
    return createWorkspace(name, {
      ttl: { days: 1 },
      credentials: { role: 'Editor' },
    }).then((res) => {
      if ('error' in res && res.error) {
        throw new Error(
          `failed to create workspace ${name}: ${res.error.message ?? res.error}`,
        );
      }
      const workspace = res.data!;
      if (!workspace.credentials) {
        throw new Error(
          `workspace ${name} was created without scoped credentials`,
        );
      }
      return {
        name,
        bucket: workspace.bucket,
        credentials: {
          accessKeyId: workspace.credentials.accessKeyId,
          secretAccessKey: workspace.credentials.secretAccessKey,
        },
      } as PoolEntry;
    });
  });

  // Single Promise.all — provisioning MUST be concurrent.
  const workspaces = await Promise.all(creationPromises);

  const state: PoolState = { workspaces };
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return state;
}

/**
 * Upload a single object whose key is `task.txt` and body is `text` to the
 * workspace bucket belonging to the agent at 1-based `agentIndex`. Uses the
 * workspace's scoped Editor credentials against the Tigris S3 endpoint.
 */
export async function assignTask(agentIndex: number, text: string): Promise<void> {
  const state = await readState();

  if (!Number.isInteger(agentIndex) || agentIndex < 1 || agentIndex > state.workspaces.length) {
    throw new Error(
      `agent index ${agentIndex} out of range (pool size: ${state.workspaces.length})`,
    );
  }

  const entry = state.workspaces[agentIndex - 1];
  if (!entry.credentials) {
    throw new Error(`workspace ${entry.name} has no scoped credentials recorded`);
  }

  const s3 = new S3Client({
    endpoint: TIGRIS_S3_ENDPOINT,
    region: TIGRIS_S3_REGION,
    credentials: {
      accessKeyId: entry.credentials.accessKeyId,
      secretAccessKey: entry.credentials.secretAccessKey,
    },
  });

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: entry.bucket,
        Key: 'task.txt',
        Body: text,
      }),
    );
  } finally {
    s3.destroy();
  }
}

/**
 * Print pool status to stdout: first line `pool size: <count>`, then one
 * bucket name per line in the same order as the workspaces array.
 */
export async function status(): Promise<void> {
  // Exit code 0 when pool-state.json exists, even if the pool is empty.
  const state = await readState();
  const lines: string[] = [`pool size: ${state.workspaces.length}`];
  for (const entry of state.workspaces) {
    lines.push(entry.bucket);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

/**
 * Tear down every recorded workspace via teardownWorkspace using Promise.allSettled
 * so a single failure does not short-circuit the others. After all teardown
 * attempts have settled, removes pool-state.json from disk regardless of
 * partial errors. Returns 0 if every teardown succeeded, non-zero otherwise.
 */
export async function teardownPool(): Promise<number> {
  const state = await readState();

  // Build all teardownWorkspace promises up front so they run concurrently via
  // a single Promise.allSettled — a single failure must NOT short-circuit others.
  const teardownPromises = state.workspaces.map((entry) =>
    teardownWorkspace({
      bucket: entry.bucket,
      credentials: {
        accessKeyId: entry.credentials.accessKeyId,
        secretAccessKey: entry.credentials.secretAccessKey,
      },
    }).then((res) => {
      if ('error' in res && res.error) {
        throw new Error(
          `failed to tear down workspace ${entry.name} (${entry.bucket}): ${res.error.message ?? res.error}`,
        );
      }
    }),
  );

  const results = await Promise.allSettled(teardownPromises);

  // Always remove the state file after all teardown attempts have settled,
  // regardless of partial errors.
  try {
    await unlink(STATE_FILE);
  } catch (err: any) {
    if (err && err.code !== 'ENOENT') {
      // Surface unlink failures but don't mask teardown results below.
      process.stderr.write(`warning: failed to remove ${STATE_FILE}: ${err.message ?? err}\n`);
    }
  }

  const failures = results.filter((r) => r.status === 'rejected');
  for (const f of failures) {
    if (f.status === 'rejected') {
      process.stderr.write(`teardown error: ${f.reason?.message ?? f.reason}\n`);
    }
  }

  return failures.length === 0 ? 0 : 1;
}