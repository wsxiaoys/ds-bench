import { Apideck } from '@apideck/unify';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const appId = process.env.APIDECK_APP_ID;
  const apiKey = process.env.APIDECK_API_KEY;
  const consumerId = process.env.APIDECK_CONSUMER_ID;
  const driveName = process.env.APIDECK_FILE_STORAGE_DRIVE_NAME;
  const runId = fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();

  if (!appId || !apiKey || !consumerId || !driveName || !runId) {
    throw new Error('Missing required environment variables or run-id file');
  }

  const parentFolderName = `apideck-parent-${runId}`;
  const childFolderName = `apideck-child-${runId}`;

  console.log(`Run ID: ${runId}`);
  console.log(`Drive name: ${driveName}`);

  const apideck = new Apideck({
    apiKey,
    appId,
    consumerId,
  });

  // Step 1: List drives and find the matching drive
  console.log('Listing drives...');
  const drivesIterator = await apideck.fileStorage.drives.list({
    serviceId: 'onedrive',
  });

  let foundDriveId: string | undefined;
  for await (const page of drivesIterator) {
    if (page.getDrivesResponse && page.getDrivesResponse.data) {
      for (const drive of page.getDrivesResponse.data) {
        console.log(`Drive: ${drive.name} (id: ${drive.id})`);
        if (drive.name === driveName) {
          foundDriveId = drive.id;
          break;
        }
      }
    }
    if (foundDriveId) break;
  }

  if (!foundDriveId) {
    throw new Error(`Drive with name "${driveName}" not found`);
  }

  console.log(`Found drive id: ${foundDriveId}`);

  // Step 2: Create parent folder at root
  console.log(`Creating parent folder: ${parentFolderName}`);
  const parentResponse = await apideck.fileStorage.folders.create({
    serviceId: 'onedrive',
    createFolderRequest: {
      name: parentFolderName,
      parentFolderId: 'root',
      driveId: foundDriveId,
    },
  });

  if (!parentResponse.createFolderResponse) {
    throw new Error('Failed to create parent folder: ' + JSON.stringify(parentResponse));
  }

  const parentFolderId = parentResponse.createFolderResponse.data.id;
  console.log(`Created parent folder id: ${parentFolderId}`);

  // Step 3: Create child folder inside parent folder
  console.log(`Creating child folder: ${childFolderName}`);
  const childResponse = await apideck.fileStorage.folders.create({
    serviceId: 'onedrive',
    createFolderRequest: {
      name: childFolderName,
      parentFolderId: parentFolderId,
      driveId: foundDriveId,
    },
  });

  if (!childResponse.createFolderResponse) {
    throw new Error('Failed to create child folder: ' + JSON.stringify(childResponse));
  }

  const childFolderId = childResponse.createFolderResponse.data.id;
  console.log(`Created child folder id: ${childFolderId}`);

  // Step 4: Write log file
  const logData = {
    drive_id: foundDriveId,
    parent_folder_id: parentFolderId,
    parent_folder_name: parentFolderName,
    child_folder_id: childFolderId,
    child_folder_name: childFolderName,
  };

  const logPath = '/home/user/myproject/output.log';
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
  console.log(`Log written to ${logPath}`);
  console.log('Log content:', JSON.stringify(logData, null, 2));
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
