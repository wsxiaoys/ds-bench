import { Apideck } from "@apideck/unify";
import * as fs from "fs";

async function main() {
  try {
    // 1. Initialize Apideck SDK
    const apiKey = process.env.APIDECK_API_KEY;
    const appId = process.env.APIDECK_APP_ID;
    const consumerId = process.env.APIDECK_CONSUMER_ID;
    const driveName = process.env.APIDECK_FILE_STORAGE_DRIVE_NAME;

    if (!apiKey || !appId || !consumerId || !driveName) {
      throw new Error("Missing required environment variables: APIDECK_API_KEY, APIDECK_APP_ID, APIDECK_CONSUMER_ID, APIDECK_FILE_STORAGE_DRIVE_NAME");
    }

    const apideck = new Apideck({
      apiKey,
      appId,
      consumerId,
    });

    // 2. Read runId from file
    const runIdPath = "/logs/artifacts/run-id";
    if (!fs.existsSync(runIdPath)) {
      throw new Error(`Run ID file not found at ${runIdPath}`);
    }
    const runId = fs.readFileSync(runIdPath, "utf8").trim();
    if (!runId) {
      throw new Error("Run ID is empty");
    }

    const parentFolderName = `apideck-parent-${runId}`;
    const childFolderName = `apideck-child-${runId}`;

    console.log(`Resolved Run ID: ${runId}`);
    console.log(`Target Drive Name: ${driveName}`);
    console.log(`Parent Folder Name: ${parentFolderName}`);
    console.log(`Child Folder Name: ${childFolderName}`);

    // 3. Resolve Drive ID
    console.log("Listing drives to resolve Drive ID...");
    const drivesResponse = await apideck.fileStorage.drives.list({
      serviceId: "onedrive",
    });

    let driveId: string | undefined;
    for await (const page of drivesResponse) {
      if (page.getDrivesResponse) {
        for (const drive of page.getDrivesResponse.data) {
          if (drive.name === driveName) {
            driveId = drive.id;
            break;
          }
        }
      }
      if (driveId) {
        break;
      }
    }

    if (!driveId) {
      throw new Error(`Drive with name "${driveName}" not found`);
    }
    console.log(`Resolved Drive ID: ${driveId}`);

    // 4. Create Parent Folder
    console.log(`Creating parent folder "${parentFolderName}" at root...`);
    const parentResponse = await apideck.fileStorage.folders.create({
      serviceId: "onedrive",
      createFolderRequest: {
        name: parentFolderName,
        parentFolderId: "root",
        driveId: driveId,
      },
    });

    const parentFolderId = parentResponse.createFolderResponse?.data?.id;
    if (!parentFolderId) {
      throw new Error("Failed to retrieve parent folder ID from response");
    }
    console.log(`Created parent folder with ID: ${parentFolderId}`);

    // 5. Create Child Folder
    console.log(`Creating child folder "${childFolderName}" inside parent folder...`);
    const childResponse = await apideck.fileStorage.folders.create({
      serviceId: "onedrive",
      createFolderRequest: {
        name: childFolderName,
        parentFolderId: parentFolderId,
        driveId: driveId,
      },
    });

    const childFolderId = childResponse.createFolderResponse?.data?.id;
    if (!childFolderId) {
      throw new Error("Failed to retrieve child folder ID from response");
    }
    console.log(`Created child folder with ID: ${childFolderId}`);

    // 6. Write output.log
    const logData = {
      drive_id: driveId,
      parent_folder_id: parentFolderId,
      parent_folder_name: parentFolderName,
      child_folder_id: childFolderId,
      child_folder_name: childFolderName,
    };

    const logFilePath = "/home/user/myproject/output.log";
    fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2), "utf8");
    console.log(`Successfully wrote log to ${logFilePath}`);
    console.log("Log content:", JSON.stringify(logData, null, 2));

  } catch (error) {
    console.error("An error occurred during execution:", error);
    process.exit(1);
  }
}

main();
