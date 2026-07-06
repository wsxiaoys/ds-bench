import { Apideck } from "@apideck/unify";
import * as fs from "fs";
import * as path from "path";

// ------------------------------------------------------------------
// 1. Read configuration from environment variables / files
// ------------------------------------------------------------------
const APP_ID = process.env.APIDECK_APP_ID;
const API_KEY = process.env.APIDECK_API_KEY;
const CONSUMER_ID = process.env.APIDECK_CONSUMER_ID;
const DRIVE_NAME = process.env.APIDECK_FILE_STORAGE_DRIVE_NAME;
const RUN_ID_FILE = "/logs/artifacts/run-id";

function readRunId(): string {
  if (!fs.existsSync(RUN_ID_FILE)) {
    throw new Error(`Run-id file not found at ${RUN_ID_FILE}`);
  }
  return fs.readFileSync(RUN_ID_FILE, "utf8").trim();
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const runId = readRunId();
const parentFolderName = `apideck-parent-${runId}`;
const childFolderName = `apideck-child-${runId}`;

console.log(`[boot] app_id=${APP_ID}`);
console.log(`[boot] consumer_id=${CONSUMER_ID}`);
console.log(`[boot] drive_name=${DRIVE_NAME}`);
console.log(`[boot] run_id=${runId}`);
console.log(`[boot] parent_folder_name=${parentFolderName}`);
console.log(`[boot] child_folder_name=${childFolderName}`);

// ------------------------------------------------------------------
// 2. Initialize the Apideck SDK
// ------------------------------------------------------------------
const apideck = new Apideck({
  apiKey: requireEnv("APIDECK_API_KEY", API_KEY),
  appId: requireEnv("APIDECK_APP_ID", APP_ID),
  consumerId: requireEnv("APIDECK_CONSUMER_ID", CONSUMER_ID),
});

const SERVICE_ID = "onedrive";

// ------------------------------------------------------------------
// 3. Resolve the target drive id by listing drives (paginated)
// ------------------------------------------------------------------
async function resolveDriveId(targetName: string): Promise<string> {
  console.log(`[drives] listing drives for service=${SERVICE_ID}`);
  const iterator = await apideck.fileStorage.drives.list({
    serviceId: SERVICE_ID,
    limit: 200,
  });

  for await (const page of iterator) {
    const drivesResp = page.getDrivesResponse;
    if (!drivesResp) {
      const err = page.unexpectedErrorResponse;
      if (err) {
        throw new Error(
          `Unexpected error listing drives: ${JSON.stringify(err)}`,
        );
      }
      continue;
    }
    console.log(
      `[drives] page: count=${drivesResp.data?.length ?? 0} ` +
        `next_cursor=${page.getDrivesResponse?.meta?.cursors?.next ?? "<none>"}`,
    );
    for (const drive of drivesResp.data ?? []) {
      console.log(`[drives]   candidate: id=${drive.id} name=${drive.name}`);
      if (drive.name === targetName) {
        console.log(`[drives] matched drive id=${drive.id} name=${drive.name}`);
        return drive.id;
      }
    }
  }
  throw new Error(
    `Drive with name "${targetName}" not found for service "${SERVICE_ID}"`,
  );
}

// ------------------------------------------------------------------
// 4. Create the parent folder at the drive root
// ------------------------------------------------------------------
async function createParentFolder(driveId: string): Promise<string> {
  console.log(
    `[folder:parent] creating name=${parentFolderName} drive_id=${driveId} parent_folder_id=root`,
  );
  const res = await apideck.fileStorage.folders.create({
    serviceId: SERVICE_ID,
    createFolderRequest: {
      name: parentFolderName,
      driveId,
      parentFolderId: "root",
    },
  });
  if (res.unexpectedErrorResponse) {
    throw new Error(
      `Unexpected error creating parent folder: ${JSON.stringify(
        res.unexpectedErrorResponse,
      )}`,
    );
  }
  const created = res.createFolderResponse;
  if (!created) {
    throw new Error("No createFolderResponse returned for parent folder");
  }
  const id = created.data?.id;
  if (!id) {
    throw new Error(
      `Parent folder created but no id returned: ${JSON.stringify(created)}`,
    );
  }
  console.log(`[folder:parent] created id=${id}`);
  return id;
}

// ------------------------------------------------------------------
// 5. Create the child folder inside the parent folder
// ------------------------------------------------------------------
async function createChildFolder(
  driveId: string,
  parentFolderId: string,
): Promise<string> {
  console.log(
    `[folder:child] creating name=${childFolderName} drive_id=${driveId} parent_folder_id=${parentFolderId}`,
  );
  const res = await apideck.fileStorage.folders.create({
    serviceId: SERVICE_ID,
    createFolderRequest: {
      name: childFolderName,
      driveId,
      parentFolderId,
    },
  });
  if (res.unexpectedErrorResponse) {
    throw new Error(
      `Unexpected error creating child folder: ${JSON.stringify(
        res.unexpectedErrorResponse,
      )}`,
    );
  }
  const created = res.createFolderResponse;
  if (!created) {
    throw new Error("No createFolderResponse returned for child folder");
  }
  const id = created.data?.id;
  if (!id) {
    throw new Error(
      `Child folder created but no id returned: ${JSON.stringify(created)}`,
    );
  }
  console.log(`[folder:child] created id=${id}`);
  return id;
}

// ------------------------------------------------------------------
// 6. Main
// ------------------------------------------------------------------
async function main(): Promise<void> {
  const driveId = await resolveDriveId(
    requireEnv("APIDECK_FILE_STORAGE_DRIVE_NAME", DRIVE_NAME),
  );
  const parentFolderId = await createParentFolder(driveId);
  const childFolderId = await createChildFolder(driveId, parentFolderId);

  const log = {
    drive_id: driveId,
    parent_folder_id: parentFolderId,
    parent_folder_name: parentFolderName,
    child_folder_id: childFolderId,
    child_folder_name: childFolderName,
  };

  const outPath = path.resolve("/home/user/myproject/output.log");
  fs.writeFileSync(outPath, JSON.stringify(log, null, 2));
  console.log(`[done] wrote ${outPath}`);
  console.log(JSON.stringify(log, null, 2));
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});