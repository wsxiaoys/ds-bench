import PocketBase from 'pocketbase';
import { readFile, writeFile } from 'node:fs/promises';

async function main() {
  const pb = new PocketBase('http://127.0.0.1:8090');

  try {
    // 1. Authenticate as the admin
    console.log('Authenticating as admin...');
    await pb.admins.authWithPassword('admin@example.com', 'adminpassword');
    console.log('Authentication successful.');

    // 2. Upload input.jpg to create a new record in the gallery collection
    console.log('Reading input.jpg...');
    const fileBuffer = await readFile('input.jpg');
    const file = new File([fileBuffer], 'input.jpg', { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('image', file);

    console.log('Uploading image to gallery collection...');
    const record = await pb.collection('gallery').create(formData);
    console.log('Record created successfully:', record.id);

    // 3. Get the URL for the 100x100 thumbnail of the uploaded image
    console.log('Generating thumbnail URL...');
    const thumbnailUrl = pb.files.getURL(record, record.image, { thumb: '100x100' });
    console.log('Thumbnail URL:', thumbnailUrl);

    // 4. Download the thumbnail and save it as thumbnail.jpg
    console.log('Downloading thumbnail...');
    const response = await fetch(thumbnailUrl, {
      headers: {
        'Authorization': pb.authStore.token
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download thumbnail: ${response.statusText} (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const thumbnailBuffer = Buffer.from(arrayBuffer);
    await writeFile('thumbnail.jpg', thumbnailBuffer);
    console.log('Thumbnail saved successfully to thumbnail.jpg.');

    // 5. Write the created record ID to output.log, formatted exactly as Record ID: <id>
    console.log('Writing record ID to output.log...');
    await writeFile('output.log', `Record ID: ${record.id}`);
    console.log('output.log written successfully.');

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

main();
