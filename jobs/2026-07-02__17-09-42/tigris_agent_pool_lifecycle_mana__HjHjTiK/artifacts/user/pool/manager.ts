import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  createWorkspace,
  teardownWorkspace,
  type Workspace,
} from '@tigrisdata/agent-kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const POOL_DIR = '/home/user/pool';
const STATE_FILE = join(POOL_DIR, 'pool-state.json');
const S3_ENDPOINT = 'REDACTED';

export interface PoolEntry {
  name: string;
  bucket: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface PoolState {
  workspaces: PoolEntry[];
}

export class PoolError extends Error {
  status: number;
  constructor(message: string, status = 1) {
    super(message);
    this.status = status;
  }
}

async function loadState(): Promise<PoolState> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw) as PoolState;
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      throw new PoolError(`pool state not found at ${STATE_FILE}`);
    }
    throw new PoolError(`failed to read pool state: ${err?.message ?? String(err)}`);
  }
}

export async function provisionPool(n: number): Promise<PoolState> {
  if (!Number.isInteger(n) || n <= 0) {
    throw new PoolError(`provision requires a positive integer N, got ${n}`);
  }

  const promises: Promise<Workspace>[] = [];
  for (let i = 1; i <= n; i++) {
    const name = `pool-${n}-${i}`;
    promises.push(
      createWorkspace(name, {
        ttl: { days: 1 },
        credentials: { role: 'Editor' },
      }).then((res) => {
        if (res.error || !res.data) {
          throw new PoolError(
            `createWorkspace(${name}) failed: ${res.error?.message ?? 'unknown error'}`,
          );
        }
        return res.data;
      }),
    );
  }

  const workspaces = await Promise.all(promises);

  const entries: PoolEntry[] = workspaces.map((w, i) => ({
    name: `pool-${n}-${i + 1}`,
    bucket: w.bucket,
    credentials: w.credentials,
  }));

  const state: PoolState = { workspaces: entries };
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

export async function assignTask(agentIndex: number, text: string): Promise<void> {
  if (!Number.isInteger(agentIndex) || agentIndex < 1) {
    throw new PoolError(`agent index must be a positive integer, got ${agentIndex}`);
  }

  const state = await loadState();
  const entry = state.workspaces[agentIndex - 1];
  if (!entry) {
    throw new PoolError(
      `agent index ${agentIndex} is out of range (pool size: ${state.workspaces.length})`,
    );
  }
  if (!entry.credentials) {
    throw new PoolError(`workspace ${entry.name} has no scoped credentials`);
  }

  const client = new S3Client({
    region: 'REDACTED',
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: entry.credentials.accessKeyId,
      secretAccessKey: entry.credentials.secretAccessKey,
    },
    forcePathStyle: false,
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: entry.bucket,
        Key: 'task.txt',
        Body: text,
      }),
    );
  } catch (err: any) {
    throw new PoolError(`PutObject failed: ${err?.message ?? String(err)}`);
  } finally {
    client.destroy();
  }
}

export async function status(): Promise<PoolState> {
  const state = await loadState();
  const lines: string[] = [];
  lines.push(`pool size: ${state.workspaces.length}`);
  for (const ws of state.workspaces) {
    lines.push(ws.bucket);
  }
  process.stdout.write(lines.join('\n') + '\n');
  return state;
}

export async function teardownPool(): Promise<{ ok: boolean; failures: number }> {
  const state = await loadState();

  const settled = await Promise.allSettled(
    state.workspaces.map(async (entry) => {
      const workspace: Workspace = {
        bucket: entry.bucket,
        credentials: entry.credentials,
      };
      const res = await teardownWorkspace(workspace);
      if (res.error) {
        throw new Error(
          `teardownWorkspace(${entry.name}) failed: ${res.error.message}`,
        );
      }
      return entry.name;
    }),
  );

  // Always remove the state file, regardless of partial failures.
  try {
    await fs.unlink(STATE_FILE);
  } catch (err: any) {
    if (err && err.code !== 'ENOENT') {
      throw new PoolError(
        `failed to remove ${STATE_FILE}: ${err?.message ?? String(err)}`,
      );
    }
  }

  let failures = 0;
  for (const r of settled) {
    if (r.status === 'rejected') {
      failures++;
      process.stderr.write(`${r.reason?.message ?? String(r.reason)}\n`);
    }
  }
  return { ok: failures === 0, failures };
}