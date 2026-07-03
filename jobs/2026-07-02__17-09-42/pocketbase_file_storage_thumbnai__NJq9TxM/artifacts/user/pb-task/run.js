const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const PocketBase = require('pocketbase/cjs');

const PB_URL = 'http://127.0.0.1:8090';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'adminpassword';
const COLLECTION = 'gallery';
const FILE_FIELD = 'image';
const THUMB_SIZE = '100x100';

const PROJECT_DIR = __dirname;
const INPUT_PATH = path.join(PROJECT_DIR, 'input.jpg');
const THUMB_PATH = path.join(PROJECT_DIR, 'thumbnail.jpg');
const OUTPUT_LOG = path.join(PROJECT_DIR, 'output.log');

async function main() {
    const pb = new PocketBase(PB_URL);

    // 1. Authenticate as admin
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

    // 2. Upload input.jpg to gallery collection
    const formData = new FormData();
    const fileBuffer = await fsp.readFile(INPUT_PATH);
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    formData.append(FILE_FIELD, blob, 'input.jpg');

    const record = await pb.collection(COLLECTION).create(formData);

    const recordId = record.id;
    console.log('Created record ID:', recordId);

    // 3. Build the 100x100 thumbnail URL
    const imageFilename = record[FILE_FIELD];
    const thumbUrl = pb.files.getURL(record, imageFilename, { 'thumb': THUMB_SIZE });
    console.log('Thumbnail URL:', thumbUrl);

    // 4. Download the thumbnail and save it as thumbnail.jpg
    const thumbResponse = await fetch(thumbUrl);
    if (!thumbResponse.ok) {
        throw new Error(`Failed to fetch thumbnail: ${thumbResponse.status} ${thumbResponse.statusText}`);
    }
    const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer());
    await fsp.writeFile(THUMB_PATH, thumbBuffer);
    console.log('Saved thumbnail to:', THUMB_PATH);

    // 5. Write record ID to output.log
    await fsp.writeFile(OUTPUT_LOG, `Record ID: ${recordId}\n`);
    console.log('Wrote output.log');
}

main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});