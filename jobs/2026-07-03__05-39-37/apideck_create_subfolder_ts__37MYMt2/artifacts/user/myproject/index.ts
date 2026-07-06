import { Apideck } from "@apideck/unify";
import * as fs from "fs";

/**
 * Create a nested folder hierarchy (parent + child) inside a REDACTED drive
 * using the Apideck Unified File Storage API (TypeScript / Node.js SDK).
 *
 * Reads all credentials / configuration from environment variables and the
 * run-id artifact, then writes a JSON log of the created folder IDs.
 */

const SERVICE_ID = "onedrive";
const RUN_ID_PATH = "/logs/artifacts/run-id";
const OUTPUT_LOG_PATH = "/home/user/myproject/output.log";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

async function main(): Promise<void> {
  // --- Configuration from environment / artifacts ---------------------------
  const appId = requireEnv("APIDECK_APP_ID");
  const apiKey = requireEnv("APIDECK_API_KEY");
  const consumerId = requireEnv("APIDECK_CONSUMER_ID");
  const driveName = requireEnv("APIDECK_FILE_STORAGE_DRIVE_NAME");
  const runId = fs.readFileSync(RUN_ID_PATH, "utf8").trim();

  const parentFolderName = `apideck-parent-${runId}`;
  const childFolderName = `apideck-child-${runId}`;

  console.log(`[config] appId=${appId}`);
  console.log(`[config] consumerId=${consumerId}`);
  console.log(`[config] driveName=${driveName}`);
  console.log(`[config] runId=${runId}`);

  // --- Initialise the SDK --------------------------------------------------
  const apideck = new Apideck({
    apiKey,
    appId,
    consumerId,
  });

  // --- Step 1: Resolve the target drive by name ----------------------------
  console.log(`\n[step 1] Listing drives in REDACTED to find "${driveName}"...`);

  let driveId: string | undefined;

  const drivesIterator = await apideck.fileStorage.drives.list({
    serviceId: SERVICE_ID,
  });

  for await (const page of drivesIterator) {
    const drives = page.getDrivesResponse?.data ?? [];
    console.log(`  received ${drives.length} drive(s) in this page`);
    for (const drive of drives) {
      console.log(`  - id=${drive.id} name="${drive.name}"`);
      if (drive.name === driveName) {
        driveId = drive.id;
      }
    }
    if (driveId) {
      break;
    }
  }

  if (!driveId) {
    throw new Error(
      `Could not find a drive with name "${driveName}" in REDACTED.`,
    );
  }

  console.log(`[step 1] Resolved drive id = ${driveId}`);

  // --- Step 2: Create the parent folder at the drive root ------------------
  console.log(
    `\n[step 2] Creating parent folder "${parentFolderName}" at drive root...`,
  );

  const parentResponse = await apideck.fileStorage.folders.create({
    serviceId: SERVICE_ID,
    driveId,
    createFolderRequest: {
      name: parentFolderName,
      parentFolderId: "root",
    },
  });

  const parentCreateData = parentResponse.createFolderResponse?.data;
  const parentFolderId = parentCreateData?.id;
  if (!parentFolderId) {
    throw new Error(
      `Parent folder creation did not return an id. Response: ${JSON.stringify(parentResponse)}`,
    );
  }

  console.log(`[step 2] Created parent folder id = ${parentFolderId}`);

  // --- Step 3: Create the child folder inside the parent -------------------
  console.log(
    `\n[step 3] Creating child folder "${childFolderName}" inside parent ${parentFolderId}...`,
  );

  const childResponse = await apideck.fileStorage.folders.create({
    serviceId: SERVICE_ID,
    driveId,
    createFolderRequest: {
      name: childFolderName,
      parentFolderId, // the id returned by the parent-folder create call
    },
  });

  const childCreateData = childResponse.createFolderResponse?.data;
  const childFolderId = childCreateData?.id;
  if (!childFolderId) {
    throw new Error(
      `Child folder creation did not return an id. Response: ${JSON.stringify(childResponse)}`,
    );
  }

  console.log(`[step 3] Created child folder id = ${childFolderId}`);

  // --- Step 4: Write the JSON log file -------------------------------------
  const logPayload = {
    drive_id: driveId,
    parent_folder_id: parentFolderId,
    parent_folder_name: parentFolderName,
    child_folder_id: childFolderId,
    child_folder_name: childFolderName,
  };

  fs.writeFileSync(OUTPUT_LOG_PATH, JSON.stringify(logPayload, null, 2) + "\n", "utf8");

  console.log(`\n[done] Wrote log to ${OUTPUT_LOG_PATH}:`);
  console.log(JSON.stringify(logPayload, null, 2));
}

main().catch((err: unknown) => {
  console.error("Script failed:", err);
  if (err instanceof Error) {
    console.error(err.stack);
  }
  process.exit(1);
});