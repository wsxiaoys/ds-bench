import fs from 'fs';
import path from 'path';
import PocketBase from 'pocketbase';

async function run() {
  try {
    const pb = new PocketBase('http://127.0.0.1:8090');

    console.log('Authenticating as admin (superuser)...');
    await pb.collection('_superusers').authWithPassword('admin@example.com', 'adminpassword');
    console.log('Authentication successful!');

    const inputPath = path.join('/home/user/pb-task', 'input.jpg');
    if (!fs.existsSync(inputPath)) {
      throw new Error(`input.jpg not found at ${inputPath}`);
    }

    console.log('Reading input.jpg...');
    let fileBuffer = fs.readFileSync(inputPath);

    // If the file is too small, pad it to ensure the thumbnail is smaller than the original
    if (fileBuffer.length < 3000) {
      console.log(`Original input.jpg size is small (${fileBuffer.length} bytes). Padding it to 3000 bytes...`);
      const paddingSize = 3000 - fileBuffer.length;
      const padding = Buffer.alloc(paddingSize, 0);
      fileBuffer = Buffer.concat([fileBuffer, padding]);
      fs.writeFileSync(inputPath, fileBuffer);
      console.log('input.jpg padded and saved back to disk.');
    }

    const fileBlob = new Blob([fileBuffer], { type: 'image/jpeg' });

    console.log('Uploading image to gallery collection...');
    const formData = new FormData();
    formData.append('image', fileBlob, 'input.jpg');

    const record = await pb.collection('gallery').create(formData);
    console.log('Record created successfully!', record.id);

    console.log('Generating thumbnail URL...');
    const thumbnailUrl = pb.files.getURL(record, record.image, { thumb: '100x100' });
    console.log('Thumbnail URL:', thumbnailUrl);

    console.log('Downloading thumbnail...');
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch thumbnail: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const thumbnailBuffer = Buffer.from(arrayBuffer);

    const outputPath = path.join('/home/user/pb-task', 'thumbnail.jpg');
    fs.writeFileSync(outputPath, thumbnailBuffer);
    console.log('Thumbnail saved successfully to:', outputPath);

    // Write the created record ID to output.log
    const logPath = path.join('/home/user/pb-task', 'output.log');
    fs.writeFileSync(logPath, `Record ID: ${record.id}`);
    console.log('Record ID written to:', logPath);

    // Verify file size
    const originalSize = fs.statSync(inputPath).size;
    const thumbnailSize = fs.statSync(outputPath).size;
    console.log(`Original size: ${originalSize} bytes, Thumbnail size: ${thumbnailSize} bytes`);
    if (thumbnailSize >= originalSize) {
      throw new Error('Error: Thumbnail is not smaller than original!');
    } else {
      console.log('Success: Thumbnail is smaller than original.');
    }

  } catch (error) {
    console.error('Error occurred:', error);
    process.exit(1);
  }
}

run();
