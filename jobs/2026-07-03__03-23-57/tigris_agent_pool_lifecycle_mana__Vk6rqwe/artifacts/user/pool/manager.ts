import { createWorkspace, teardownWorkspace, Workspace } from '@tigrisdata/agent-kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';

export interface WorkspaceState {
  name: string;
  bucket: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface PoolState {
  workspaces: WorkspaceState[];
}

const STATE_FILE_PATH = '/home/user/pool/pool-state.json';

/**
 * Provision exactly <N> Tigris workspaces concurrently.
 * Named pool-<N>-1, pool-<N>-2, ..., pool-<N>-<N> (1-based).
 * Created with ttl: { days: 1 } and credentials: { role: "Editor" }.
 * Writes pool-state.json on success, throws on failure.
 */
export async function provisionPool(n: number): Promise<void> {
  if (isNaN(n) || n <= 0) {
    throw new Error(`Invalid pool size: ${n}. Must be a positive integer.`);
  }

  const promises: Promise<any>[] = [];
  for (let i = 1; i <= n; i++) {
    const name = `pool-${n}-${i}`;
    promises.push(createWorkspace(name, {
      ttl: { days: 1 },
      credentials: { role: 'Editor' }
    }));
  }

  const results = await Promise.all(promises);

  const workspaces: WorkspaceState[] = [];
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const expectedName = `pool-${n}-${i + 1}`;
    if (res.error) {
      throw new Error(`Failed to create workspace ${expectedName}: ${res.error.message || res.error}`);
    }
    const ws = res.data;
    if (!ws) {
      throw new Error(`No data returned for workspace ${expectedName}`);
    }
    if (!ws.credentials) {
      throw new Error(`No credentials returned for workspace ${expectedName}`);
    }
    workspaces.push({
      name: expectedName,
      bucket: ws.bucket,
      credentials: {
        accessKeyId: ws.credentials.accessKeyId,
        secretAccessKey: ws.credentials.secretAccessKey
      }
    });
  }

  const state: PoolState = { workspaces };
  await fs.writeFile(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Look up the workspace at 1-based agent-index, and upload task.txt with body <text>
 * using the workspace's scoped credentials against Tigris S3.
 */
export async function assignTask(agentIndex: number, text: string): Promise<void> {
  let stateContent: string;
  try {
    stateContent = await fs.readFile(STATE_FILE_PATH, 'utf-8');
  } catch (err) {
    throw new Error(`pool-state.json is missing or inaccessible: ${err}`);
  }

  const state: PoolState = JSON.parse(stateContent);
  if (!state.workspaces || !Array.isArray(state.workspaces)) {
    throw new Error('Invalid state structure in pool-state.json');
  }

  const index = agentIndex - 1; // Convert 1-based index to 0-based
  if (index < 0 || index >= state.workspaces.length) {
    throw new Error(`Agent index ${agentIndex} is out of range (pool size: ${state.workspaces.length})`);
  }

  const ws = state.workspaces[index];
  if (!ws.credentials || !ws.credentials.accessKeyId || !ws.credentials.secretAccessKey) {
    throw new Error(`Workspace ${ws.name} does not have valid credentials`);
  }

  const s3 = new S3Client({
    endpoint: 'REDACTED',
    region: 'REDACTED',
    credentials: {
      accessKeyId: ws.credentials.accessKeyId,
      secretAccessKey: ws.credentials.secretAccessKey
    }
  });

  const command = new PutObjectCommand({
    Bucket: ws.bucket,
    Key: 'task.txt',
    Body: text
  });

  await s3.send(command);
}

/**
 * Read pool-state.json and print pool size and bucket names.
 */
export async function status(): Promise<void> {
  let stateContent: string;
  try {
    stateContent = await fs.readFile(STATE_FILE_PATH, 'utf-8');
  } catch (err) {
    throw new Error(`pool-state.json is missing or inaccessible: ${err}`);
  }

  const state: PoolState = JSON.parse(stateContent);
  const workspaces = state.workspaces || [];
  console.log(`pool size: ${workspaces.length}`);
  for (const ws of workspaces) {
    console.log(ws.bucket);
  }
}

/**
 * Read pool-state.json and tear down every recorded workspace via teardownWorkspace
 * using Promise.allSettled. Remove pool-state.json afterwards.
 */
export async function teardownPool(): Promise<void> {
  let stateContent: string;
  try {
    stateContent = await fs.readFile(STATE_FILE_PATH, 'utf-8');
  } catch (err) {
    throw new Error(`pool-state.json is missing or inaccessible: ${err}`);
  }

  const state: PoolState = JSON.parse(stateContent);
  const workspaces = state.workspaces || [];

  const promises = workspaces.map((ws) => {
    return teardownWorkspace({
      bucket: ws.bucket,
      credentials: ws.credentials
    });
  });

  const results = await Promise.allSettled(promises);

  // Always attempt to delete the state file
  try {
    await fs.unlink(STATE_FILE_PATH);
  } catch (err) {
    console.error(`Failed to delete ${STATE_FILE_PATH}: ${err}`);
  }

  let failedCount = 0;
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const wsName = workspaces[i].name;
    if (res.status === 'rejected') {
      console.error(`Teardown failed for workspace ${wsName}: ${res.reason}`);
      failedCount++;
    } else {
      const tigrisRes = res.value;
      if (tigrisRes.error) {
        console.error(`Teardown failed for workspace ${wsName}: ${tigrisRes.error.message || tigrisRes.error}`);
        failedCount++;
      }
    }
  }

  if (failedCount > 0) {
    throw new Error(`${failedCount} workspace teardown(s) failed.`);
  }
}
