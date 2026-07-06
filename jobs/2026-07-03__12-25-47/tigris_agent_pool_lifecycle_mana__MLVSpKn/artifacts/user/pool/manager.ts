import { createWorkspace, teardownWorkspace } from "@tigrisdata/agent-kit";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type PoolEntry = {
  name: string;
  bucket: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
};

export type PoolState = {
  workspaces: PoolEntry[];
};

const STATE_PATH = resolve("/home/user/pool/pool-state.json");

export async function provisionPool(n: number): Promise<void> {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`provision requires a positive integer, got ${n}`);
  }

  const promises = [];
  for (let i = 1; i <= n; i++) {
    const name = `pool-${n}-${i}`;
    promises.push(
      createWorkspace(name, {
        ttl: { days: 1 },
        credentials: { role: "Editor" },
      }).then((res) => {
        if (res.error) {
          throw new Error(`createWorkspace ${name} failed: ${String(res.error)}`);
        }
        if (!res.data) {
          throw new Error(`createWorkspace ${name} returned no data`);
        }
        if (!res.data.credentials) {
          throw new Error(`createWorkspace ${name} returned no credentials`);
        }
        return {
          name,
          bucket: res.data.bucket,
          credentials: {
            accessKeyId: res.data.credentials.accessKeyId,
            secretAccessKey: res.data.credentials.secretAccessKey,
          },
        } satisfies PoolEntry;
      }),
    );
  }

  const workspaces = await Promise.all(promises);

  const state: PoolState = { workspaces };
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

export async function assignTask(agentIndex: number, text: string): Promise<void> {
  if (!existsSync(STATE_PATH)) {
    throw new Error(`pool-state.json not found at ${STATE_PATH}`);
  }

  const raw = await readFile(STATE_PATH, "utf8");
  const state = JSON.parse(raw) as PoolState;

  const idx = agentIndex - 1;
  if (!Number.isInteger(agentIndex) || idx < 0 || idx >= state.workspaces.length) {
    throw new Error(
      `agent index ${agentIndex} out of range (1..${state.workspaces.length})`,
    );
  }

  const entry = state.workspaces[idx];

  const client = new S3Client({
    region: "REDACTED",
    endpoint: "REDACTED",
    credentials: {
      accessKeyId: entry.credentials.accessKeyId,
      secretAccessKey: entry.credentials.secretAccessKey,
    },
    forcePathStyle: false,
  });

  await client.send(
    new PutObjectCommand({
      Bucket: entry.bucket,
      Key: "task.txt",
      Body: text,
    }),
  );
}

export async function status(): Promise<void> {
  if (!existsSync(STATE_PATH)) {
    throw new Error(`pool-state.json not found at ${STATE_PATH}`);
  }

  const raw = await readFile(STATE_PATH, "utf8");
  const state = JSON.parse(raw) as PoolState;

  const count = state.workspaces.length;
  console.log(`pool size: ${count}`);
  for (const w of state.workspaces) {
    console.log(w.bucket);
  }
}

export async function teardownPool(): Promise<void> {
  if (!existsSync(STATE_PATH)) {
    throw new Error(`pool-state.json not found at ${STATE_PATH}`);
  }

  const raw = await readFile(STATE_PATH, "utf8");
  const state = JSON.parse(raw) as PoolState;

  const results = await Promise.allSettled(
    state.workspaces.map((entry) =>
      teardownWorkspace({
        bucket: entry.bucket,
        credentials: {
          accessKeyId: entry.credentials.accessKeyId,
          secretAccessKey: entry.credentials.secretAccessKey,
        },
      }).then((res) => {
        if (res.error) {
          throw new Error(`teardown ${entry.name} failed: ${String(res.error)}`);
        }
      }),
    ),
  );

  await unlink(STATE_PATH);

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    const errs = failures.map((f) => (f as PromiseRejectedResult).reason).join("\n");
    throw new Error(`${failures.length} teardown(s) failed:\n${errs}`);
  }
}
